import { describe, it, expect } from "vitest";
import { configureContainer } from "../../src/deps/singleton.js";
import { createSilentLogger, defaultTestConfig } from "../helpers/index.js";

describe("configureContainer", () => {
  it("should create a container with all dependencies", () => {
    const container = configureContainer(defaultTestConfig, createSilentLogger());

    expect(container).toBeDefined();
    expect(container.cradle).toBeDefined();
  });

  it("should register config as the provided value", () => {
    const container = configureContainer(defaultTestConfig, createSilentLogger());

    expect(container.cradle.config).toBe(defaultTestConfig);
  });

  it("should register logger as the provided value", () => {
    const logger = createSilentLogger();
    const container = configureContainer(defaultTestConfig, logger);

    expect(container.cradle.logger).toBe(logger);
  });

  it("should register quoteSource with configured file path", () => {
    const container = configureContainer(defaultTestConfig, createSilentLogger());

    expect(container.cradle.quoteSource).toBeDefined();
  });

  it("should register gameGenerator as a singleton", () => {
    const container = configureContainer(defaultTestConfig, createSilentLogger());

    const generator1 = container.cradle.gameGenerator;
    const generator2 = container.cradle.gameGenerator;

    expect(generator1).toBe(generator2);
  });

  it("should have gameGenerator with generatePuzzle method", () => {
    const container = configureContainer(defaultTestConfig, createSilentLogger());

    expect(typeof container.cradle.gameGenerator.generatePuzzle).toBe("function");
  });

  it("should have gameGenerator with generateDailyPuzzle method", () => {
    const container = configureContainer(defaultTestConfig, createSilentLogger());

    expect(typeof container.cradle.gameGenerator.generateDailyPuzzle).toBe("function");
  });
});
