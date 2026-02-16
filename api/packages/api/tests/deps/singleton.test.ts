import { describe, it, expect } from "vitest";
import { configureContainer } from "../../src/deps/singleton.js";
import { createSilentLogger, defaultTestConfig, getTestQuotesPath } from "../helpers/index.js";

describe("configureContainer", () => {
  it("should create a container with all dependencies", async () => {
    const config = { ...defaultTestConfig, QUOTES_FILE_PATH: getTestQuotesPath() };
    const { container } = await configureContainer(config, createSilentLogger());

    expect(container).toBeDefined();
    expect(container.cradle).toBeDefined();
  });

  it("should register config as the provided value", async () => {
    const config = { ...defaultTestConfig, QUOTES_FILE_PATH: getTestQuotesPath() };
    const { container } = await configureContainer(config, createSilentLogger());

    expect(container.cradle.config).toBe(config);
  });

  it("should register logger as the provided value", async () => {
    const config = { ...defaultTestConfig, QUOTES_FILE_PATH: getTestQuotesPath() };
    const logger = createSilentLogger();
    const { container } = await configureContainer(config, logger);

    expect(container.cradle.logger).toBe(logger);
  });

  it("should register quoteSource with configured file path", async () => {
    const config = { ...defaultTestConfig, QUOTES_FILE_PATH: getTestQuotesPath() };
    const { container } = await configureContainer(config, createSilentLogger());

    expect(container.cradle.quoteSource).toBeDefined();
  });

  it("should register gameGenerator as a singleton", async () => {
    const config = { ...defaultTestConfig, QUOTES_FILE_PATH: getTestQuotesPath() };
    const { container } = await configureContainer(config, createSilentLogger());

    const generator1 = container.cradle.gameGenerator;
    const generator2 = container.cradle.gameGenerator;

    expect(generator1).toBe(generator2);
  });

  it("should have gameGenerator with generatePuzzle method", async () => {
    const config = { ...defaultTestConfig, QUOTES_FILE_PATH: getTestQuotesPath() };
    const { container } = await configureContainer(config, createSilentLogger());

    expect(typeof container.cradle.gameGenerator.generatePuzzle).toBe("function");
  });

  it("should have gameGenerator with generateDailyPuzzle method", async () => {
    const config = { ...defaultTestConfig, QUOTES_FILE_PATH: getTestQuotesPath() };
    const { container } = await configureContainer(config, createSilentLogger());

    expect(typeof container.cradle.gameGenerator.generateDailyPuzzle).toBe("function");
  });
});
