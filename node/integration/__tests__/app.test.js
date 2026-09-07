const request = require("supertest");
const { app } = require("../../server");

describe("Marine Dashboard Express application", () => {
  test("GET /health returns a healthy service response", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        service: "marine-dashboard-node",
        status: "healthy"
      })
    );
    expect(response.body.time).toEqual(expect.any(String));
  });

  test("GET /api/unknown-route returns the standard API 404 response", async () => {
    const response = await request(app).get("/api/unknown-route");

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      success: false,
      message: "API route not found"
    });
  });

  test("GET /api/vessels without authentication is rejected", async () => {
    const response = await request(app).get("/api/vessels");

    expect(response.status).toBe(401);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false
      })
    );
  });

  test("responses include a request correlation ID", async () => {
    const response = await request(app).get("/health");

    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.headers["x-request-id"].length).toBeGreaterThan(0);
  });

  test("valid incoming request ID is preserved", async () => {
    const requestId = "integration-test-request-123";

    const response = await request(app)
      .get("/health")
      .set("X-Request-Id", requestId);

    expect(response.status).toBe(200);
    expect(response.headers["x-request-id"]).toBe(requestId);
  });
});
