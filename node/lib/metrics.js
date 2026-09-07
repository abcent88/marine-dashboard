const counters = new Map();

function increment(name, value = 1) {
  if (!name || !Number.isFinite(value)) {
    throw new TypeError("Metric name and value must be valid");
  }

  counters.set(name, (counters.get(name) || 0) + value);
}

function getCounters() {
  return Object.fromEntries(counters);
}

function reset() {
  counters.clear();
}

module.exports = {
  increment,
  getCounters,
  reset
};
