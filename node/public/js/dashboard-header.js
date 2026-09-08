function setHeaderImpl(){
  const metric = LIVE.summary?.dailyMetric;

  if(!metric){
    $("kpiSales").textContent = "—";
    $("kpiPerf").textContent = "—";
    $("kpiPort").textContent = "—";
    $("kpiTemp").textContent = "—";
    return;
  }

  $("kpiSales").textContent =
    moneyShort(Number(metric.salesAmount || 0));

  $("kpiPerf").textContent =
    `${Number(metric.performancePercent || 0).toFixed(1)}%`;

  const environment = LIVE.summary?.environment;
  const latestPosition = LIVE.summary?.tracking?.positions?.[0];
  const latitude = Number(latestPosition?.latitude);
  const longitude = Number(latestPosition?.longitude);
  const hasCoordinates =
    Number.isFinite(latitude) && Number.isFinite(longitude);

  $("kpiPort").textContent = hasCoordinates
    ? `${latitude.toFixed(3)}°, ${longitude.toFixed(3)}°`
    : "—";

  const temperature = Number(environment?.temperatureC);
  $("kpiTemp").textContent = Number.isFinite(temperature)
    ? `${temperature.toFixed(1)}°C`
    : "—";
}


window.setHeaderImpl = setHeaderImpl;
