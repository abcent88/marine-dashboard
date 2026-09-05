function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function nowTime() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function moneyShort(n) {
  const abs = Math.abs(n);

  if (abs >= 1e9) return `$${(n / 1e9).toFixed(3)}B`;
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(3)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;

  return `$${n.toFixed(0)}`;
}

function pct(a, b) {
  return b === 0 ? 0 : Math.round((a / b) * 100);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.MarineDashboardUtils = {
  clamp,
  nowTime,
  moneyShort,
  pct,
  escapeHtml
};
