jest.mock("../../lib/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

const logger = require("../../lib/logger");
const {
  fetchSeaSurfaceTemperature,
  validateCoordinates,
  clearEnvironmentCache
} = require("../environment");

describe("Environment service", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    clearEnvironmentCache();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe("validateCoordinates", () => {
    test("accepts valid coordinates", () => {
      expect(validateCoordinates("4.8123", "4.9012")).toEqual({
        latitude: 4.8123,
        longitude: 4.9012
      });
    });

    test.each([
      [91, 4],
      [-91, 4],
      [4, 181],
      [4, -181],
      ["not-a-number", 4]
    ])("rejects invalid coordinates %s, %s", (latitude, longitude) => {
      expect(validateCoordinates(latitude, longitude)).toBeNull();
    });
  });

  describe("fetchSeaSurfaceTemperature", () => {
    test("returns sea surface temperature from the marine API response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          current: {
            sea_surface_temperature: 27.4,
            time: "2026-09-07T21:15"
          }
        })
      });

      await expect(
        fetchSeaSurfaceTemperature(4.8123, 4.9012)
      ).resolves.toEqual({
        temperatureC: 27.4,
        latitude: 4.8123,
        longitude: 4.9012,
        source: "Open-Meteo Marine API",
        timestamp: "2026-09-07T21:15"
      });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][0]).toContain(
        "sea_surface_temperature"
      );
    });

    test("returns null for an API failure", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 503
      });

      await expect(
        fetchSeaSurfaceTemperature(4.8123, 4.9012)
      ).resolves.toBeNull();

      expect(logger.warn).toHaveBeenCalled();
    });

    test("returns null for an invalid API response", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          current: {}
        })
      });

      await expect(
        fetchSeaSurfaceTemperature(4.8123, 4.9012)
      ).resolves.toBeNull();
    });

    test("does not call the API for invalid coordinates", async () => {
      await expect(
        fetchSeaSurfaceTemperature(91, 4)
      ).resolves.toBeNull();

      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("uses the cache for repeated coordinates", async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          current: {
            sea_surface_temperature: 27.4,
            time: "2026-09-07T21:15"
          }
        })
      });

      const first = await fetchSeaSurfaceTemperature(4.8123, 4.9012);
      const second = await fetchSeaSurfaceTemperature(4.81231, 4.90121);

      expect(first).toEqual(second);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
});
