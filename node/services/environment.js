const logger = require("../lib/logger");

const MARINE_API_URL = "https://marine-api.open-meteo.com/v1/marine";
const REQUEST_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 10 * 60 * 1000;
const temperatureCache = new Map();

function validateCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lon = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lon) ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }

  return { latitude: lat, longitude: lon };
}

async function fetchSeaSurfaceTemperature(latitude, longitude) {
  const coordinates = validateCoordinates(latitude, longitude);

  if (!coordinates) {
    return null;
  }

  const cacheKey = `${coordinates.latitude.toFixed(3)},${coordinates.longitude.toFixed(3)}`;
  const cached = temperatureCache.get(cacheKey);

  if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
    return cached.value;
  }

  const params = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: "sea_surface_temperature",
    cell_selection: "sea"
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${MARINE_API_URL}?${params}`, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(
        `Marine API returned HTTP ${response.status}`
      );
    }

    const result = await response.json();
    const temperature = Number(
      result?.current?.sea_surface_temperature
    );

    if (!Number.isFinite(temperature)) {
      return null;
    }

    const value = {
      temperatureC: temperature,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      source: "Open-Meteo Marine API",
      timestamp: result?.current?.time || null
    };

    temperatureCache.set(cacheKey, { cachedAt: Date.now(), value });

    return value;
  } catch (error) {
    logger.warn(
      { err: error },
      "Unable to load sea surface temperature"
    );

    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function clearEnvironmentCache() {
  temperatureCache.clear();
}

module.exports = {
  fetchSeaSurfaceTemperature,
  validateCoordinates,
  clearEnvironmentCache
};
