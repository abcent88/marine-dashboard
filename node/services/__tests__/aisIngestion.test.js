jest.mock("../../db", () => ({
  query: jest.fn()
}));

jest.mock("../../lib/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock("../../lib/metrics", () => ({
  increment: jest.fn(),
  getCounters: jest.fn(),
  reset: jest.fn()
}));

const pool = require("../../db");
const logger = require("../../lib/logger");
const metrics = require("../../lib/metrics");

const {
  AisIngestionError,
  normalizePositionPayload,
  resolveVessel,
  insertPosition,
  ingestPosition
} = require("../aisIngestion");

describe("AIS ingestion service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("normalizePositionPayload", () => {
    test("normalizes a valid AIS position", () => {
      const result = normalizePositionPayload({
        mmsi: " 123456789 ",
        latitude: "5.5",
        longitude: "7.2",
        speedKnots: "12.5",
        headingDegrees: "180",
        positionSource: "AIS",
        sourceDeviceId: " device-01 ",
        sourceEventId: " event-123 ",
        sourceTimestamp: "2026-09-07T10:20:30Z"
      });

      expect(result).toEqual({
        mmsi: "123456789",
        latitude: 5.5,
        longitude: 7.2,
        speedKnots: 12.5,
        headingDegrees: 180,
        positionSource: "ais",
        sourceDeviceId: "device-01",
        sourceEventId: "event-123",
        sourceTimestamp: "2026-09-07 10:20:30"
      });
    });

    test("uses AIS as the default position source", () => {
      const result = normalizePositionPayload({
        mmsi: "123456789",
        latitude: 5,
        longitude: 7
      });

      expect(result.positionSource).toBe("ais");
      expect(result.speedKnots).toBeNull();
      expect(result.headingDegrees).toBeNull();
      expect(result.sourceDeviceId).toBeNull();
      expect(result.sourceEventId).toBeNull();
      expect(result.sourceTimestamp).toBeNull();
    });

    test.each([
      ["missing MMSI", { latitude: 5, longitude: 7 }, "mmsi is required"],
      [
        "invalid latitude",
        { mmsi: "123", latitude: 91, longitude: 7 },
        "latitude must be a number between -90 and 90"
      ],
      [
        "invalid longitude",
        { mmsi: "123", latitude: 5, longitude: 181 },
        "longitude must be a number between -180 and 180"
      ],
      [
        "invalid speed",
        { mmsi: "123", latitude: 5, longitude: 7, speedKnots: -1 },
        "speedKnots must be a non-negative number"
      ],
      [
        "invalid heading",
        { mmsi: "123", latitude: 5, longitude: 7, headingDegrees: 360 },
        "headingDegrees must be between 0 and less than 360"
      ],
      [
        "invalid position source",
        { mmsi: "123", latitude: 5, longitude: 7, positionSource: "radar" },
        "positionSource must be gps or ais"
      ],
      [
        "event without device",
        {
          mmsi: "123",
          latitude: 5,
          longitude: 7,
          sourceEventId: "event-1"
        },
        "sourceDeviceId is required when sourceEventId is provided"
      ],
      [
        "event id too long",
        {
          mmsi: "123",
          latitude: 5,
          longitude: 7,
          sourceDeviceId: "device-1",
          sourceEventId: "x".repeat(151)
        },
        "sourceEventId must be 150 characters or fewer"
      ],
      [
        "invalid source timestamp",
        {
          mmsi: "123",
          latitude: 5,
          longitude: 7,
          sourceTimestamp: "not-a-date"
        },
        "sourceTimestamp must be a valid date/time"
      ]
    ])("rejects %s", (_name, payload, expectedMessage) => {
      expect(() => normalizePositionPayload(payload)).toThrow(
        new AisIngestionError(400, expectedMessage)
      );
    });
  });

  describe("resolveVessel", () => {
    test("returns an active vessel", async () => {
      const vessel = {
        id: 7,
        vessel_code: "MV-001",
        name: "Test Vessel",
        status: "active"
      };

      pool.query.mockResolvedValueOnce([[vessel]]);

      await expect(resolveVessel("123456789")).resolves.toEqual(vessel);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("FROM vessels"),
        ["123456789"]
      );
    });

    test("rejects an unknown vessel", async () => {
      pool.query.mockResolvedValueOnce([[]]);

      await expect(resolveVessel("123456789")).rejects.toEqual(
        new AisIngestionError(
          404,
          "No vessel is registered with this MMSI"
        )
      );
    });

    test("rejects a retired vessel", async () => {
      pool.query.mockResolvedValueOnce([[
        {
          id: 7,
          vessel_code: "MV-001",
          name: "Retired Vessel",
          status: "retired"
        }
      ]]);

      await expect(resolveVessel("123456789")).rejects.toEqual(
        new AisIngestionError(
          409,
          "Cannot record a position for a retired vessel"
        )
      );
    });

    test("rejects an out-of-service vessel", async () => {
      pool.query.mockResolvedValueOnce([[
        {
          id: 8,
          vessel_code: "MV-002",
          name: "Out Of Service Vessel",
          status: "out_of_service"
        }
      ]]);

      await expect(resolveVessel("123456789")).rejects.toEqual(
        new AisIngestionError(
          409,
          "Cannot record a position for an out-of-service vessel"
        )
      );
    });
  });

  describe("insertPosition", () => {
    const vessel = {
      id: 7,
      vessel_code: "MV-001",
      name: "Test Vessel"
    };

    const position = {
      mmsi: "123456789",
      latitude: 5.5,
      longitude: 7.2,
      speedKnots: 12.5,
      headingDegrees: 180,
      positionSource: "ais",
      sourceDeviceId: "device-1",
      sourceEventId: "event-1",
      sourceTimestamp: "2026-09-07 10:20:30"
    };

    test("inserts a new position", async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 42 }]);

      const result = await insertPosition(vessel, position);

      expect(result).toEqual({
        id: 42,
        recordedAt: "2026-09-07 10:20:30",
        duplicate: false
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO vessel_positions"),
        [
          7,
          5.5,
          7.2,
          12.5,
          180,
          "ais",
          "device-1",
          "event-1",
          "2026-09-07 10:20:30",
          "2026-09-07 10:20:30"
        ]
      );
    });

    test("returns the existing position when a duplicate event is detected", async () => {
      pool.query
        .mockRejectedValueOnce({ code: "ER_DUP_ENTRY" })
        .mockResolvedValueOnce([[{ id: 42 }]]);

      const result = await insertPosition(vessel, position);

      expect(result).toEqual({
        id: 42,
        recordedAt: "2026-09-07 10:20:30",
        duplicate: true
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          vesselId: 7,
          sourceDeviceId: "device-1",
          sourceEventId: "event-1",
          positionId: 42
        }),
        "Duplicate AIS/GPS position ignored"
      );
    });

    test("rethrows a duplicate error when the existing row cannot be found", async () => {
      const duplicateError = { code: "ER_DUP_ENTRY" };

      pool.query
        .mockRejectedValueOnce(duplicateError)
        .mockResolvedValueOnce([[]]);

      await expect(insertPosition(vessel, position)).rejects.toBe(
        duplicateError
      );
    });

    test("rethrows non-duplicate database errors", async () => {
      const databaseError = new Error("database unavailable");

      pool.query.mockRejectedValueOnce(databaseError);

      await expect(insertPosition(vessel, position)).rejects.toBe(
        databaseError
      );
    });

    test("generates recordedAt when no source timestamp is supplied", async () => {
      pool.query.mockResolvedValueOnce([{ insertId: 99 }]);

      const positionWithoutTimestamp = {
        ...position,
        sourceTimestamp: null
      };

      const result = await insertPosition(vessel, positionWithoutTimestamp);

      expect(result.id).toBe(99);
      expect(result.duplicate).toBe(false);
      expect(result.recordedAt).toEqual(
        expect.stringMatching(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
      );
    });
  });

  describe("ingestPosition", () => {
    test("normalizes, resolves, persists, and returns the complete result", async () => {
      pool.query
        .mockResolvedValueOnce([[
          {
            id: 7,
            vessel_code: "MV-001",
            name: "Test Vessel",
            status: "active"
          }
        ]])
        .mockResolvedValueOnce([{ insertId: 42 }]);

      const result = await ingestPosition({
        mmsi: "123456789",
        latitude: 5.5,
        longitude: 7.2,
        sourceDeviceId: "device-1",
        sourceEventId: "event-1"
      });

      expect(result).toEqual(expect.objectContaining({
        id: 42,
        vesselId: 7,
        vesselCode: "MV-001",
        vesselName: "Test Vessel",
        mmsi: "123456789",
        latitude: 5.5,
        longitude: 7.2,
        positionSource: "ais",
        sourceDeviceId: "device-1",
        sourceEventId: "event-1",
        duplicate: false
      }));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          vesselId: 7,
          positionId: 42
        }),
        "AIS/GPS position recorded"
      );

      expect(metrics.increment).toHaveBeenCalledWith(
        "ais.ingestion.received"
      );
      expect(metrics.increment).toHaveBeenCalledWith(
        "ais.ingestion.accepted"
      );
    });

    test("returns a duplicate result through the orchestration path", async () => {
      pool.query
        .mockResolvedValueOnce([[
          {
            id: 7,
            vessel_code: "MV-001",
            name: "Test Vessel",
            status: "active"
          }
        ]])
        .mockRejectedValueOnce({ code: "ER_DUP_ENTRY" })
        .mockResolvedValueOnce([[{ id: 42 }]]);

      const result = await ingestPosition({
        mmsi: "123456789",
        latitude: 5.5,
        longitude: 7.2,
        sourceDeviceId: "device-1",
        sourceEventId: "event-1"
      });

      expect(result).toEqual(expect.objectContaining({
        id: 42,
        vesselId: 7,
        vesselCode: "MV-001",
        vesselName: "Test Vessel",
        duplicate: true
      }));

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          vesselId: 7,
          positionId: 42
        }),
        "AIS/GPS position already recorded"
      );

      expect(metrics.increment).toHaveBeenCalledWith(
        "ais.ingestion.received"
      );
      expect(metrics.increment).toHaveBeenCalledWith(
        "ais.ingestion.duplicates"
      );
    });

    test("counts unexpected database errors separately", async () => {
      const databaseError = new Error("database unavailable");

      pool.query.mockRejectedValueOnce(databaseError);

      await expect(ingestPosition({
        mmsi: "123456789",
        latitude: 5.5,
        longitude: 7.2
      })).rejects.toBe(databaseError);

      expect(metrics.increment).toHaveBeenCalledWith(
        "ais.ingestion.received"
      );
      expect(metrics.increment).toHaveBeenCalledWith(
        "ais.ingestion.errors"
      );
      expect(metrics.increment).not.toHaveBeenCalledWith(
        "ais.ingestion.rejected"
      );
    });

    test("does not access the database when validation fails", async () => {
      await expect(ingestPosition({
        latitude: 5,
        longitude: 7
      })).rejects.toEqual(
        new AisIngestionError(400, "mmsi is required")
      );

      expect(pool.query).not.toHaveBeenCalled();

      expect(metrics.increment).toHaveBeenCalledWith(
        "ais.ingestion.received"
      );
      expect(metrics.increment).toHaveBeenCalledWith(
        "ais.ingestion.rejected"
      );
    });
  });
});
