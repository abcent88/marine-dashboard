const metrics = require("../metrics");

describe("metrics collector", () => {
  beforeEach(() => {
    metrics.reset();
  });

  test("starts with no counters", () => {
    expect(metrics.getCounters()).toEqual({});
  });

  test("increments a new counter", () => {
    metrics.increment("ais.ingestion.received");

    expect(metrics.getCounters()).toEqual({
      "ais.ingestion.received": 1
    });
  });

  test("increments an existing counter", () => {
    metrics.increment("ais.ingestion.accepted");
    metrics.increment("ais.ingestion.accepted", 2);

    expect(metrics.getCounters()).toEqual({
      "ais.ingestion.accepted": 3
    });
  });

  test("supports multiple counters", () => {
    metrics.increment("ais.ingestion.accepted");
    metrics.increment("ais.ingestion.duplicates", 2);
    metrics.increment("ais.ingestion.rejected", 3);

    expect(metrics.getCounters()).toEqual({
      "ais.ingestion.accepted": 1,
      "ais.ingestion.duplicates": 2,
      "ais.ingestion.rejected": 3
    });
  });

  test("rejects an invalid metric name", () => {
    expect(() => metrics.increment("")).toThrow(
      "Metric name and value must be valid"
    );
  });

  test("rejects an invalid metric value", () => {
    expect(() => metrics.increment("ais.ingestion.accepted", NaN)).toThrow(
      "Metric name and value must be valid"
    );
  });

  test("resets all counters", () => {
    metrics.increment("ais.ingestion.accepted", 5);
    metrics.increment("ais.ingestion.rejected", 2);

    metrics.reset();

    expect(metrics.getCounters()).toEqual({});
  });
});
