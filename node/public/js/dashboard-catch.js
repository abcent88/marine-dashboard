async function setCatchInsightImpl(){
  const name = $("fishName");
  const meta = $("fishMeta");
  const share = $("fishShare");
  const total = $("fishAnnual");
  const score = $("sustainScore");

  try {
    const response = await fetch(`${API_BASE}/api/catch`, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if(!response.ok){
      throw new Error(`Catch API returned HTTP ${response.status}`);
    }

    const result = await response.json();

    if(!result.success || !result.data){
      throw new Error("Invalid catch API response");
    }

    const breakdown = Array.isArray(result.data.speciesBreakdown)
      ? result.data.speciesBreakdown
      : [];

    if(!breakdown.length || Number(result.data.summary?.totalCatchKg || 0) <= 0){
      name.textContent = "No catch recorded";
      meta.textContent = "Live catch data";
      share.textContent = "0%";
      total.textContent = "0 kg";
      score.textContent = "0%";
      renderCatchGaugeImpl(0);
      return;
    }

    const leading = breakdown[0];
    const totalCatchKg = Number(result.data.summary.totalCatchKg || 0);
    const leadingCatchKg = Number(leading.quantityKg || 0);
    const catchShare = totalCatchKg > 0
      ? Math.round((leadingCatchKg / totalCatchKg) * 100)
      : 0;

    name.textContent = leading.species;
    meta.textContent = "Leading species • all recorded catch";
    share.textContent = `${catchShare}%`;
    total.textContent = `${leadingCatchKg.toLocaleString()} kg`;
    score.textContent = `${catchShare}%`;
    renderCatchGaugeImpl(catchShare);

  } catch(error) {
    console.error("Unable to load catch insight:", error);

    name.textContent = "Catch data unavailable";
    meta.textContent = "Live catch data could not be loaded";
    share.textContent = "—";
    total.textContent = "—";
    score.textContent = "—";
    renderCatchGaugeImpl(0);
  }
}

function renderCatchGaugeImpl(value){
  if(sustainChart){
    sustainChart.destroy();
  }

  const ctx = $("sustainGauge").getContext("2d");

  sustainChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Catch share", "Remaining"],
      datasets: [{
        data: [value, 100 - value],
        borderWidth: 0
      }]
    },
    options: {
      rotation: -90,
      circumference: 180,
      cutout: "78%",
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: false
        }
      }
    }
  });
}

function setCaptureImpl(){
  const summary = LIVE.summary;

  if(!summary){
    $("captureTrend").textContent = "—";
    $("captureNow").textContent = "—";
    $("captureTarget").textContent = "—";
    $("captureBar").style.width = "0%";

    const wrap = $("typeBreakdown");
    if(wrap){
      wrap.innerHTML = `<div class="break"><div class="label">Live data unavailable</div><div class="val">—</div></div>`;
    }
    return;
  }

  const operations = summary.operations || {};
  const todayMetric = summary.todayMetric;
  const species = summary.todaySpeciesBreakdown || [];

  const captureKg = Number(operations.captureKg || 0);
  const captureLb = Math.round(captureKg * 2.2046226218);

  $("captureNow").textContent =
    captureLb.toLocaleString();

  if(todayMetric){
    const targetKg = Number(todayMetric.targetCaptureKg || 0);
    const targetLb = Math.round(targetKg * 2.2046226218);

    $("captureTarget").textContent =
      targetLb.toLocaleString();

    const progress =
      targetLb > 0
        ? Math.min(100, (captureLb / targetLb) * 100)
        : 0;

    $("captureBar").style.width =
      `${progress}%`;
  } else {
    $("captureTarget").textContent = "—";
    $("captureBar").style.width = "0%";
  }

  $("captureTrend").textContent = "—";

  const wrap = $("typeBreakdown");

  if(!wrap) return;

  if(species.length === 0){
    wrap.innerHTML = `
      <div class="break">
        <div class="label">No catch recorded today</div>
        <div class="val">0 lb</div>
      </div>
    `;
    return;
  }

  wrap.innerHTML =
    species.map(item => {
      const quantityKg = Number(item.quantityKg || 0);
      const quantityLb = Math.round(quantityKg * 2.2046226218);

      return `
        <div class="break">
          <div class="label">${escapeHtml(item.species || "Unknown")}</div>
          <div class="val">${quantityLb.toLocaleString()} lb</div>
        </div>
      `;
    }).join("");
}


window.renderCatchGaugeImpl = renderCatchGaugeImpl;
window.setCatchInsightImpl = setCatchInsightImpl;
window.setCaptureImpl = setCaptureImpl;
