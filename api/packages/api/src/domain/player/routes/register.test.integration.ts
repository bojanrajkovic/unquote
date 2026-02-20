import { describe, it, expect } from "vitest";

import { createTestContainer } from "../../../../tests/helpers/index.js";
import { createTestFastify } from "../../../../tests/helpers/fastify.js";
import { registerRoute } from "./register.js";

describe("register route (POST /)", () => {
  it("AC1.1: returns 201 with claimCode from mock store", async () => {
    // arrange
    const container = createTestContainer();
    const fastify = await createTestFastify(container, registerRoute);

    // act
    const response = await fastify.inject({
      method: "POST",
      url: "/",
    });

    // assert
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body).toHaveProperty("claimCode", "TEST-CODE-0000");

    await fastify.close();
  });

  it("AC1.2: returns 503 when playerStore is null", async () => {
    // arrange
    const container = createTestContainer({ playerStore: null });
    const fastify = await createTestFastify(container, registerRoute);

    // act
    const response = await fastify.inject({
      method: "POST",
      url: "/",
    });

    // assert
    expect(response.statusCode).toBe(503);

    await fastify.close();
  });
});
