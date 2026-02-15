import { dirname, join } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { DateTime } from "luxon";
import { beforeAll, describe, expect, it } from "vitest";
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { AsyncLocalStorageContextManager } from "@opentelemetry/context-async-hooks";
import { context, trace } from "@opentelemetry/api";
import type { Quote } from "./types.js";
import { KeywordCipherGenerator } from "./cipher/keyword-cipher.js";
import type { KeywordSource } from "./cipher/types.js";
import { InMemoryQuoteSource } from "./quotes/in-memory-source.js";
import { KEYWORDS } from "./data/keywords.js";
import { validateSolution } from "./validation.js";
import { traced, withSpan } from "./tracing.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const quotesPath = join(__dirname, "../../../resources/quotes.json");

describe("game-tracing span tree integration tests", () => {
  let quoteSource: InMemoryQuoteSource;
  let generator: KeywordCipherGenerator;
  let allQuotes: Quote[];
  let exporter: InMemorySpanExporter;
  const keywordSource: KeywordSource = { getKeywords: async () => KEYWORDS };

  beforeAll(async () => {
    // Set up context manager for parent-child span propagation
    const contextManager = new AsyncLocalStorageContextManager();
    context.setGlobalContextManager(contextManager);

    // Set up in-memory OTel SDK
    exporter = new InMemorySpanExporter();
    const tracerProvider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    trace.setGlobalTracerProvider(tracerProvider);

    // Load quotes
    const content = await readFile(quotesPath, "utf8");
    allQuotes = JSON.parse(content);
    quoteSource = new InMemoryQuoteSource(allQuotes);
    generator = new KeywordCipherGenerator(quoteSource, keywordSource);
  });

  describe("game-tracing.AC4.1: generateDailyPuzzle span tree", () => {
    it("creates correct span tree with all child spans", async () => {
      // Reset exporter before test
      exporter.reset();

      // Call generateDailyPuzzle
      const date = DateTime.fromISO("2026-02-14");
      const puzzle = await generator.generateDailyPuzzle(date);

      // Force flush (not strictly needed for in-memory, but good practice)
      await exporter.forceFlush();

      // Collect all exported spans
      const allSpans = exporter.getFinishedSpans();

      // Verify we have spans
      expect(allSpans.length).toBeGreaterThan(0);

      // Extract span names for easier assertion
      const spanNames = allSpans.map((s) => s.name);

      // Verify key span names exist
      expect(spanNames).toContain("KeywordCipherGenerator.generateDailyPuzzle");
      expect(spanNames).toContain("KeywordCipherGenerator.generatePuzzle");
      expect(spanNames).toContain("buildCipherAlphabet");
      expect(spanNames).toContain("buildCipherMapping");
      expect(spanNames).toContain("eliminateSelfMappings");
      expect(spanNames).toContain("encryptText");
      expect(spanNames).toContain("generateHints");

      // Verify parent-child relationships via parentSpanContext
      const spansByName = new Map(allSpans.map((s) => [s.name, s]));

      // generateDailyPuzzle should be root or near-root
      const genDailySpan = spansByName.get("KeywordCipherGenerator.generateDailyPuzzle");
      expect(genDailySpan).toBeDefined();

      // generatePuzzle should be child of generateDailyPuzzle
      const genPuzzleSpan = spansByName.get("KeywordCipherGenerator.generatePuzzle");
      expect(genPuzzleSpan).toBeDefined();
      if (genPuzzleSpan && genDailySpan) {
        const parentCtx = genPuzzleSpan.parentSpanContext;
        expect(parentCtx).toBeDefined();
        expect(parentCtx?.spanId).toBe(genDailySpan.spanContext().spanId);
      }

      // buildCipherAlphabet should be child of generatePuzzle
      const buildAlphabetSpan = spansByName.get("buildCipherAlphabet");
      expect(buildAlphabetSpan).toBeDefined();
      if (buildAlphabetSpan && genPuzzleSpan) {
        const parentCtx = buildAlphabetSpan.parentSpanContext;
        expect(parentCtx).toBeDefined();
        expect(parentCtx?.spanId).toBe(genPuzzleSpan.spanContext().spanId);
      }

      // buildCipherMapping should be child of generatePuzzle
      const buildMappingSpan = spansByName.get("buildCipherMapping");
      expect(buildMappingSpan).toBeDefined();
      if (buildMappingSpan && genPuzzleSpan) {
        const parentCtx = buildMappingSpan.parentSpanContext;
        expect(parentCtx).toBeDefined();
        expect(parentCtx?.spanId).toBe(genPuzzleSpan.spanContext().spanId);
      }

      // eliminateSelfMappings should be child of buildCipherMapping
      const eliminateSpan = spansByName.get("eliminateSelfMappings");
      expect(eliminateSpan).toBeDefined();
      if (eliminateSpan && buildMappingSpan) {
        const parentCtx = eliminateSpan.parentSpanContext;
        expect(parentCtx).toBeDefined();
        expect(parentCtx?.spanId).toBe(buildMappingSpan.spanContext().spanId);
      }

      // encryptText should be child of generatePuzzle
      const encryptSpan = spansByName.get("encryptText");
      expect(encryptSpan).toBeDefined();
      if (encryptSpan && genPuzzleSpan) {
        const parentCtx = encryptSpan.parentSpanContext;
        expect(parentCtx).toBeDefined();
        expect(parentCtx?.spanId).toBe(genPuzzleSpan.spanContext().spanId);
      }

      // generateHints should be child of generatePuzzle
      const hintsSpan = spansByName.get("generateHints");
      expect(hintsSpan).toBeDefined();
      if (hintsSpan && genPuzzleSpan) {
        const parentCtx = hintsSpan.parentSpanContext;
        expect(parentCtx).toBeDefined();
        expect(parentCtx?.spanId).toBe(genPuzzleSpan.spanContext().spanId);
      }

      // Puzzle should be valid
      expect(puzzle.encryptedText).toBeDefined();
      expect(puzzle.mapping).toBeDefined();
      expect(puzzle.hints).toBeDefined();
    });
  });

  describe("game-tracing.AC4.2: validateSolution span creation", () => {
    it("creates validateSolution span when called", async () => {
      // Reset exporter
      exporter.reset();

      // Call validateSolution
      const quote = allQuotes[0]!;
      const isValid = validateSolution(quote.text, quote.text);

      // Force flush
      await exporter.forceFlush();

      // Verify span was created
      const spans = exporter.getFinishedSpans();
      const spanNames = spans.map((s) => s.name);

      expect(spanNames).toContain("validateSolution");
      expect(isValid).toBe(true);
    });
  });

  describe("game-tracing.AC4.3: custom attributes on spans", () => {
    it("allows setting custom attributes via span parameter in withSpan", async () => {
      // Reset exporter
      exporter.reset();

      // Create a test-local function wrapped with withSpan that sets a custom attribute
      const testAttributeKey = "test.custom.key";
      const testAttributeValue = "test.custom.value";

      const testFunction = withSpan("testAttributeSpan", (span, value: string) => {
        span.setAttribute(testAttributeKey, value);
        return value;
      });

      // Call the test function
      testFunction(testAttributeValue);

      await exporter.forceFlush();

      // Verify the span was created with the custom attribute
      const spans = exporter.getFinishedSpans();
      const testSpan = spans.find((s) => s.name === "testAttributeSpan");

      expect(testSpan).toBeDefined();
      expect(testSpan?.attributes).toBeDefined();
      expect(testSpan?.attributes?.[testAttributeKey]).toBe(testAttributeValue);
    });

    it("allows setting custom attributes via span parameter in @traced decorated methods", async () => {
      // Reset exporter
      exporter.reset();

      // The @traced decorator wraps methods and creates spans automatically.
      // To set custom attributes, create a helper function wrapped with withSpan
      // that receives the span parameter and returns a value
      const testAttributeKey = "test.traced.key";
      const testAttributeValue = "test.traced.value";

      const tracedHelper = withSpan("tracedHelperSpan", (span, message: string) => {
        span.setAttribute(testAttributeKey, message);
        return message;
      });

      class TestTracedClass {
        @traced
        async testMethod(): Promise<string> {
          // Call the traced helper to set custom attributes
          const result = tracedHelper(testAttributeValue);
          return result;
        }
      }

      // Call the traced method
      const testClass = new TestTracedClass();
      await testClass.testMethod();

      await exporter.forceFlush();

      // Verify both the traced method span and the helper span were created
      const spans = exporter.getFinishedSpans();

      // Check the helper span was created with the attribute
      const helperSpan = spans.find((s) => s.name === "tracedHelperSpan");
      expect(helperSpan).toBeDefined();
      expect(helperSpan?.attributes).toBeDefined();
      expect(helperSpan?.attributes?.[testAttributeKey]).toBe(testAttributeValue);

      // Check the traced method span was also created
      const methodSpan = spans.find((s) => s.name === "TestTracedClass.testMethod");
      expect(methodSpan).toBeDefined();
    });
  });
});
