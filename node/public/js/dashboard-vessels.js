function makeDoughnutImpl(canvasId, value, max, cutout=72){
  const canvas = $(canvasId);

  if(!canvas) return null;

  const ctx = canvas.getContext("2d");

  return new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Active", "Remaining"],
      datasets: [{
        data: [
          value,
          Math.max(0, max - value)
        ],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: `${cutout}%`,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true
        }
      }
    }
  });
}

function setShipsImpl(){
  const vessels = LIVE.summary?.vessels;

  if(!vessels){
    $("activeShips").textContent = "—";
    $("activeShipsSub").textContent = "—";
    $("totalCapacity").textContent = "—";
    $("statPracticable").textContent = "—";
    $("statRestricted").textContent = "—";
    $("statOut").textContent = "—";
    $("capacityPct").textContent = "—";
    $("capacityTons").textContent = "—";
    return;
  }

  const totalCapacityTons = Number(vessels.totalCapacityTons || 0);
  const activeCapacityTons = Number(vessels.activeCapacityTons || 0);
  const operationalPct = pct(
    activeCapacityTons,
    totalCapacityTons
  );

  $("activeShips").textContent = vessels.active;
  $("activeShipsSub").textContent =
    `${vessels.active} / ${vessels.total}`;

  $("totalCapacity").textContent =
    totalCapacityTons.toLocaleString();

  $("statPracticable").textContent =
    vessels.active;

  $("statRestricted").textContent =
    vessels.restricted;

  $("statOut").textContent =
    vessels.outOfService;

  $("capacityPct").textContent =
    `${operationalPct}%`;

  $("capacityTons").textContent =
    `${activeCapacityTons.toLocaleString()} t active`;

  if(capacityChart){
    capacityChart.destroy();
  }

  capacityChart = makeDoughnutImpl(
    "capacityGauge",
    activeCapacityTons,
    totalCapacityTons,
    78
  );
}

function setBothShipsImpl(){
  const vessels = LIVE.summary?.vessels;

  if(!vessels){
    $("bothShipsBar").style.width = "0%";
    $("recoveryPct").textContent = "—";
    return;
  }

  const totalCapacityTons =
    Number(vessels.totalCapacityTons || 0);

  const activeCapacityTons =
    Number(vessels.activeCapacityTons || 0);

  const capacityPct =
    totalCapacityTons > 0
      ? Math.min(
          100,
          (activeCapacityTons / totalCapacityTons) * 100
        )
      : 0;

  $("bothShipsBar").style.width =
    `${capacityPct}%`;

  $("recoveryPct").textContent =
    `${vessels.active} / ${vessels.total}`;
}


window.makeDoughnutImpl = makeDoughnutImpl;
window.setShipsImpl = setShipsImpl;
window.setBothShipsImpl = setBothShipsImpl;
