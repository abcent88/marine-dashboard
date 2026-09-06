const express = require("express");
const request = require("supertest");

jest.mock("../../db", () => ({
  query: jest.fn()
}));

jest.mock("../../lib/logger", () => ({
  error: jest.fn()
}));

const pool = require("../../db");
const logger = require("../../lib/logger");
const voyageRoutes = require("../voyages");

const app = express();

app.use(express.json());
app.use("/api/voyages", voyageRoutes);

describe("Voyages routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/voyages returns voyages with vessel and port information", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "10",
          vessel_id: "2",
          voyage_number: "VOY-2026-010",
          status: "in_progress",
          departure_at: "2026-09-05T06:00:00.000Z",
          expected_arrival_at: "2026-09-08T18:00:00.000Z",
          actual_arrival_at: null,

          vessel_code: "MV-002",
          vessel_name: "Ocean Pioneer",
          vessel_type: "trawler",

          departure_port_code: "LAG",
          departure_port_name: "Lagos Port",
          departure_port_country: "Nigeria",

          destination_port_code: "DKR",
          destination_port_name: "Port of Dakar",
          destination_port_country: "Senegal"
        },
        {
          id: "11",
          vessel_id: "1",
          voyage_number: "VOY-2026-011",
          status: "planned",
          departure_at: "2026-09-09T07:00:00.000Z",
          expected_arrival_at: "2026-09-13T12:00:00.000Z",
          actual_arrival_at: null,

          vessel_code: "MV-001",
          vessel_name: "Atlantic Star",
          vessel_type: "longliner",

          departure_port_code: "LOS",
          departure_port_name: "Lagos",
          departure_port_country: "Nigeria",

          destination_port_code: "ABJ",
          destination_port_name: "Abidjan Port",
          destination_port_country: "Cote d'Ivoire"
        },
        {
          id: "12",
          vessel_id: "3",
          voyage_number: "VOY-2026-012",
          status: "completed",
          departure_at: "2026-08-20T05:00:00.000Z",
          expected_arrival_at: "2026-08-24T14:00:00.000Z",
          actual_arrival_at: "2026-08-24T13:30:00.000Z",

          vessel_code: "MV-003",
          vessel_name: "Pacific Dawn",
          vessel_type: "carrier",

          departure_port_code: "ACC",
          departure_port_name: "Tema Port",
          departure_port_country: "Ghana",

          destination_port_code: "LAG",
          destination_port_name: "Lagos Port",
          destination_port_country: "Nigeria"
        },
        {
          id: "13",
          vessel_id: "4",
          voyage_number: "VOY-2026-013",
          status: "cancelled",
          departure_at: "2026-09-01T09:00:00.000Z",
          expected_arrival_at: "2026-09-04T15:00:00.000Z",
          actual_arrival_at: null,

          vessel_code: "MV-004",
          vessel_name: "Coastal Runner",
          vessel_type: "support",

          departure_port_code: null,
          departure_port_name: null,
          departure_port_country: null,

          destination_port_code: null,
          destination_port_name: null,
          destination_port_country: null
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/voyages");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(4);

    expect(response.body.data).toEqual([
      {
        id: 10,
        vesselId: 2,
        voyageNumber: "VOY-2026-010",
        status: "in_progress",
        vessel: {
          id: 2,
          code: "MV-002",
          name: "Ocean Pioneer",
          type: "trawler"
        },
        departurePort: {
          code: "LAG",
          name: "Lagos Port",
          country: "Nigeria"
        },
        destinationPort: {
          code: "DKR",
          name: "Port of Dakar",
          country: "Senegal"
        },
        departureAt: "2026-09-05T06:00:00.000Z",
        expectedArrivalAt: "2026-09-08T18:00:00.000Z",
        actualArrivalAt: null
      },
      {
        id: 11,
        vesselId: 1,
        voyageNumber: "VOY-2026-011",
        status: "planned",
        vessel: {
          id: 1,
          code: "MV-001",
          name: "Atlantic Star",
          type: "longliner"
        },
        departurePort: {
          code: "LOS",
          name: "Lagos",
          country: "Nigeria"
        },
        destinationPort: {
          code: "ABJ",
          name: "Abidjan Port",
          country: "Cote d'Ivoire"
        },
        departureAt: "2026-09-09T07:00:00.000Z",
        expectedArrivalAt: "2026-09-13T12:00:00.000Z",
        actualArrivalAt: null
      },
      {
        id: 12,
        vesselId: 3,
        voyageNumber: "VOY-2026-012",
        status: "completed",
        vessel: {
          id: 3,
          code: "MV-003",
          name: "Pacific Dawn",
          type: "carrier"
        },
        departurePort: {
          code: "ACC",
          name: "Tema Port",
          country: "Ghana"
        },
        destinationPort: {
          code: "LAG",
          name: "Lagos Port",
          country: "Nigeria"
        },
        departureAt: "2026-08-20T05:00:00.000Z",
        expectedArrivalAt: "2026-08-24T14:00:00.000Z",
        actualArrivalAt: "2026-08-24T13:30:00.000Z"
      },
      {
        id: 13,
        vesselId: 4,
        voyageNumber: "VOY-2026-013",
        status: "cancelled",
        vessel: {
          id: 4,
          code: "MV-004",
          name: "Coastal Runner",
          type: "support"
        },
        departurePort: null,
        destinationPort: null,
        departureAt: "2026-09-01T09:00:00.000Z",
        expectedArrivalAt: "2026-09-04T15:00:00.000Z",
        actualArrivalAt: null
      }
    ]);

    expect(response.body.generatedAt).toEqual(expect.any(String));
    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/voyages handles voyages with only one port present", async () => {
    pool.query.mockResolvedValueOnce([
      [
        {
          id: "14",
          vessel_id: "5",
          voyage_number: "VOY-2026-014",
          status: "planned",
          departure_at: "2026-09-10T06:00:00.000Z",
          expected_arrival_at: "2026-09-14T12:00:00.000Z",
          actual_arrival_at: null,

          vessel_code: "MV-005",
          vessel_name: "Harbor Star",
          vessel_type: "support",

          departure_port_code: "LAG",
          departure_port_name: "Lagos Port",
          departure_port_country: "Nigeria",

          destination_port_code: null,
          destination_port_name: null,
          destination_port_country: null
        }
      ]
    ]);

    const response = await request(app)
      .get("/api/voyages");

    expect(response.status).toBe(200);

    expect(response.body.data).toEqual([
      {
        id: 14,
        vesselId: 5,
        voyageNumber: "VOY-2026-014",
        status: "planned",
        vessel: {
          id: 5,
          code: "MV-005",
          name: "Harbor Star",
          type: "support"
        },
        departurePort: {
          code: "LAG",
          name: "Lagos Port",
          country: "Nigeria"
        },
        destinationPort: null,
        departureAt: "2026-09-10T06:00:00.000Z",
        expectedArrivalAt: "2026-09-14T12:00:00.000Z",
        actualArrivalAt: null
      }
    ]);
  });

  test("GET /api/voyages handles an empty result set", async () => {
    pool.query.mockResolvedValueOnce([[]]);

    const response = await request(app)
      .get("/api/voyages");

    expect(response.status).toBe(200);

    expect(response.body).toEqual({
      success: true,
      data: [],
      count: 0,
      generatedAt: expect.any(String)
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  test("GET /api/voyages returns 500 when the database query fails", async () => {
    const databaseError = new Error("Database unavailable");

    pool.query.mockRejectedValueOnce(databaseError);

    const response = await request(app)
      .get("/api/voyages");

    expect(response.status).toBe(500);

    expect(response.body).toEqual({
      success: false,
      error: "Unable to load voyages"
    });

    expect(pool.query).toHaveBeenCalledTimes(1);

    expect(logger.error).toHaveBeenCalledWith(
      { err: databaseError },
      "Voyages API error"
    );
  });
});
