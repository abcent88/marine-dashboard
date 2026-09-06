const express = require("express");
const request = require("supertest");

const requestId = require("../requestId");

function createApp() {
  const app = express();

  app.use(requestId);

  app.get("/test", (req, res) => {
    res.json({
      success: true,
      requestId: req.requestId
    });
  });

  return app;
}

describe("Request ID middleware", () => {
  test("generates a request ID when none is supplied", async () => {
    const app = createApp();

    const response = await request(app)
      .get("/test");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBeDefined();
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(response.body.requestId).toBe(
      response.headers["x-request-id"]
    );
  });

  test("preserves a supplied request ID", async () => {
    const app = createApp();

    const response = await request(app)
      .get("/test")
      .set("X-Request-Id", "test-request-123");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe("test-request-123");
    expect(response.body.requestId).toBe("test-request-123");
  });

  test("generates a new UUID for a malformed request ID", async () => {
    const app = createApp();

    const response = await request(app)
      .get("/test")
      .set("X-Request-Id", "invalid request id!");

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(response.headers["x-request-id"]).not.toBe("invalid request id!");
  });

  test("generates a new UUID for an oversized request ID", async () => {
    const app = createApp();
    const oversizedRequestId = "a".repeat(129);

    const response = await request(app)
      .get("/test")
      .set("X-Request-Id", oversizedRequestId);

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
    expect(response.headers["x-request-id"]).not.toBe(oversizedRequestId);
  });

  test("generates different IDs for separate requests", async () => {
    const app = createApp();

    const firstResponse = await request(app)
      .get("/test");

    const secondResponse = await request(app)
      .get("/test");

    expect(firstResponse.headers["x-request-id"]).toBeDefined();
    expect(secondResponse.headers["x-request-id"]).toBeDefined();
    expect(firstResponse.headers["x-request-id"]).not.toBe(
      secondResponse.headers["x-request-id"]
    );
  });
});
