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
    // arrange — set up OTel SDK with in-memory exporter (shared across all tests)
    const contextManager = new AsyncLocalStorageContextManager();
    context.setGlobalContextManager(contextManager);

    exporter = new InMemorySpanExporter();
    const tracerProvider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(exporter)],
    });
    trace.setGlobalTracerProvider(tracerProvider);

    const content = await readFile(quotesPath, "utf8");
    allQuotes = JSON.parse(content);
    quoteSource = new InMemoryQuoteSource(allQuotes);
    generator = new KeywordCipherGenerator(quoteSource, keywordSource);
  });

  it("AC4.1: generateDailyPuzzle creates correct span tree with all child spans", async () => {
    // arrange
    exporter.reset();
    const date = DateTime.fromISO("2026-02-14");

    // act
    const puzzle = await generator.generateDailyPuzzle(date);
    await exporter.forceFlush();

    // assert
    const allSpans = exporter.getFinishedSpans();
    expect(allSpans.length).toBeGreaterThan(0);

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

  it("AC4.2: validateSolution creates a span when called", async () => {
    // arrange
    exporter.reset();
    const quote = allQuotes[0]!;

    // act
    const isValid = validateSolution(quote.text, quote.text);
    await exporter.forceFlush();

    // assert
    const spans = exporter.getFinishedSpans();
    const spanNames = spans.map((s) => s.name);
    expect(spanNames).toContain("validateSolution");
    expect(isValid).toBe(true);
  });

  it("AC4.3: withSpan allows setting custom attributes via span parameter", async () => {
    // arrange
    exporter.reset();
    const testAttributeKey = "test.custom.key";
    const testAttributeValue = "test.custom.value";
    const testFunction = withSpan("testAttributeSpan", (span, value: string) => {
      span.setAttribute(testAttributeKey, value);
      return value;
    });

    // act
    testFunction(testAttributeValue);
    await exporter.forceFlush();

    // assert
    const spans = exporter.getFinishedSpans();
    const testSpan = spans.find((s) => s.name === "testAttributeSpan");
    expect(testSpan).toBeDefined();
    expect(testSpan?.attributes).toBeDefined();
    expect(testSpan?.attributes?.[testAttributeKey]).toBe(testAttributeValue);
  });

  it("AC4.3: @traced decorator creates spans for decorated methods with custom attributes", async () => {
    // arrange
    exporter.reset();
    const testAttributeKey = "test.traced.key";
    const testAttributeValue = "test.traced.value";

    const tracedHelper = withSpan("tracedHelperSpan", (span, message: string) => {
      span.setAttribute(testAttributeKey, message);
      return message;
    });

    class TestTracedClass {
      @traced
      async testMethod(): Promise<string> {
        const result = tracedHelper(testAttributeValue);
        return result;
      }
    }

    // act
    const testClass = new TestTracedClass();
    await testClass.testMethod();
    await exporter.forceFlush();

    // assert
    const spans = exporter.getFinishedSpans();

    const helperSpan = spans.find((s) => s.name === "tracedHelperSpan");
    expect(helperSpan).toBeDefined();
    expect(helperSpan?.attributes).toBeDefined();
    expect(helperSpan?.attributes?.[testAttributeKey]).toBe(testAttributeValue);

    const methodSpan = spans.find((s) => s.name === "TestTracedClass.testMethod");
    expect(methodSpan).toBeDefined();
  });
});
