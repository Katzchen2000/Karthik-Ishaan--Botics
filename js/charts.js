// Chart utilities and chart page rendering
function getVal(t, key, useCorr) {
  if (key === 'climbRate') return t.climbRate !== null ? t.climbRate * 100 : null;
  const raw = t[key] ?? null;
  return (useCorr && cal.ready && raw !== null) ? corrected(raw, t.teamNumber) : raw;
}

function mkBubble(teams, xKey, yKey, rKey, colorBy, canvasId, detIds, useCorr) {
  if (!teams.length) return;
  const rVals = teams.map(t => getVal(t, rKey, useCorr)).filter(v => v != null && v > 0);
  const rMn = rVals.length ? Math.min(...rVals) : 1;
  const rMx = rVals.length ? Math.max(...rVals) : 1;
  const rSc = v => rMx > rMn ? 8 + ((v - rMn) / (rMx - rMn)) * 26 : 16;
  const points = teams.map(t => {
    const x = getVal(t, xKey, useCorr);
    const y = getVal(t, yKey, useCorr);
    const r = getVal(t, rKey, useCorr);
    if (x === null || y === null) return null;
    const base = ['Cycler', 'Scorer', 'Feeder', 'Defender', 'Lobber'].find(b => (t.topRole || '').includes(b)) || 'Other';
    const color = colorBy === 'role' ? RCOL[base] : colorBy === 'driving' ? (DCOL[t.drivingProf] || DCOL[null]) : 'rgba(0,212,170,.75)';
    return { x, y, r: r != null ? rSc(r) : 14, tn: t.teamNumber, teamName: t.teamName, rawR: r, color, base };
  }).filter(Boolean);
  if (chartInsts[canvasId]) { chartInsts[canvasId].destroy(); }
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  const groups = {};
  points.forEach(p => {
    const k = colorBy === 'role' ? p.base : colorBy === 'driving' ? (teams.find(x => x.teamNumber === p.tn)?.drivingProf || 'Unknown') : 'Teams';
    if (!groups[k]) groups[k] = [];
    groups[k].push(p);
  });
  const datasets = Object.entries(groups).map(([lbl, pts]) => ({ label: lbl, data: pts.map(p => ({ x: p.x, y: p.y, r: p.r, tn: p.tn, teamName: p.teamName, rawR: p.rawR })), backgroundColor: pts.map(p => p.color), borderColor: pts.map(p => p.color.replace(/\)$/, '.3)')), borderWidth: 1 }));
  const [nId, nmId, cId, rId, detEl] = detIds;
  chartInsts[canvasId] = new Chart(ctx, {
    type: 'bubble',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 9, padding: 10 } },
        tooltip: {
          callbacks: {
            label: item => {
              const d = item.raw;
              return [`${d.tn} — ${d.teamName}`, `${ALBL[xKey]}: ${d.x.toFixed(1)}`, `${ALBL[yKey]}: ${d.y.toFixed(1)}`, `${ALBL[rKey]}: ${d.rawR != null ? d.rawR.toFixed(1) : '—'}`];
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: ALBL[xKey] + (useCorr && cal.ready ? ' (corr)' : ''), color: '#64748b', font: { size: 10 } }, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(30,58,95,.3)' } },
        y: { title: { display: true, text: ALBL[yKey] + (useCorr && cal.ready ? ' (corr)' : ''), color: '#64748b', font: { size: 10 } }, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(30,58,95,.3)' } }
      },
      onClick: (e, els) => {
        if (!els.length) { document.getElementById(detEl).style.display = 'none'; return; }
        const d = chartInsts[canvasId].data.datasets[els[0].datasetIndex].data[els[0].index];
        document.getElementById(detEl).style.display = 'block';
        fillDetail(nId, nmId, cId, rId, d.tn);
      }
    },
    plugins: [{ id: 'lbl', afterDatasetsDraw(chart) {
      const ctx2 = chart.ctx;
      chart.data.datasets.forEach((ds, di) => {
        ds.data.forEach((d, i) => {
          const meta = chart.getDatasetMeta(di);
          if (meta.hidden) return;
          const el = meta.data[i];
          if (!el) return;
          const r = el.options?.radius || d.r || 12;
          if (r < 11) return;
          ctx2.save();
          ctx2.fillStyle = 'rgba(255,255,255,.88)';
          ctx2.font = `bold ${Math.min(r * 0.6, 12)}px sans-serif`;
          ctx2.textAlign = 'center';
          ctx2.textBaseline = 'middle';
          ctx2.fillText(String(d.tn), el.x, el.y);
          ctx2.restore();
        });
      });
    } }]
  });
}


function mkBar(teams, metric, sortMode, canvasId, detIds, useCorr, isRank = false) {
  if (!teams.length) return;
  const getV = t => getVal(t, metric, useCorr);
  let sorted = [...teams].filter(t => getV(t) != null);
  if (isRank || sortMode === 'desc') sorted.sort((a, b) => getV(b) - getV(a));
  else if (sortMode === 'asc') sorted.sort((a, b) => getV(a) - getV(b));
  else sorted.sort((a, b) => a.teamNumber - b.teamNumber);
  const labels = isRank ? sorted.map((_, i) => `#${i + 1}`) : sorted.map(t => String(t.teamNumber));
  const [nId, nmId, cId, rId, detEl] = detIds;
  if (chartInsts[canvasId]) chartInsts[canvasId].destroy();
  const ctx = document.getElementById(canvasId)?.getContext('2d');
  if (!ctx) return;
  const isScore = ['totalAvg', 'autoAvg', 'teleopAvg', 'endgameAvg'].includes(metric);
  let datasets;
  if (isScore && !isRank) {
    const sc = useCorr && cal.ready;
    const autoV = sorted.map(t => +(sc ? corrected(t.autoAvg, t.teamNumber) : t.autoAvg || 0).toFixed(2));
    const teleV = sorted.map(t => +(sc ? corrected(t.teleopAvg, t.teamNumber) : t.teleopAvg || 0).toFixed(2));
    const endV = sorted.map(t => +(sc ? corrected(t.endgameAvg, t.teamNumber) : t.endgameAvg || 0).toFixed(2));
    datasets = [
      { label: 'Auto', data: autoV, backgroundColor: 'rgba(99,102,241,.85)', stack: 's', borderWidth: 0, borderRadius: 0 },
      { label: 'Teleop', data: teleV, backgroundColor: 'rgba(14,165,233,.85)', stack: 's', borderWidth: 0, borderRadius: 0 },
      { label: 'Endgame', data: endV, backgroundColor: 'rgba(245,158,11,.85)', stack: 's', borderWidth: 0, borderRadius: { topLeft: 3, topRight: 3 } }
    ];
  } else {
    const colors = sorted.map((_, i) => {
      if (!isRank) return roleColor(sorted[i].topRole);
      const p = i / Math.max(sorted.length - 1, 1);
      return `rgba(${Math.round(16 + p * (239 - 16))},${Math.round(185 * Math.max(0, 1 - p * 1.5))},${Math.round(129 * Math.max(0, 1 - p * 2))},.8)`;
    });
    const values = sorted.map(t => +(getV(t) || 0).toFixed(2));
    datasets = [{ label: ALBL[metric] + (useCorr && cal.ready ? ' (corr)' : ''), data: values, backgroundColor: colors, borderWidth: 0, borderRadius: 3 }];
  }

  chartInsts[canvasId] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 10, padding: 10 }, display: isScore && !isRank },
        tooltip: {
          mode: 'index',
          callbacks: {
            title: items => isRank ? `Rank ${items[0].label} — ${sorted[items[0].dataIndex].teamNumber} ${sorted[items[0].dataIndex].teamName}` : sorted[items[0].dataIndex].teamName,
            footer: items => isScore && !isRank ? `Total: ${items.reduce((s, i) => s + i.raw, 0).toFixed(1)}` : undefined
          }
        }
      },
      scales: {
        x: { stacked: isScore && !isRank, ticks: { color: '#64748b', font: { size: isRank ? 9 : 10 } }, grid: { color: 'rgba(30,58,95,.3)' } },
        y: { stacked: isScore && !isRank, title: { display: true, text: ALBL[metric] + (useCorr && cal.ready ? ' (corr)' : ''), color: '#64748b', font: { size: 10 } }, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(30,58,95,.3)' } }
      },
      onClick: (e, els) => {
        if (!els.length) { document.getElementById(detEl).style.display = 'none'; return; }
        const tn = sorted[els[0].index].teamNumber;
        document.getElementById(detEl).style.display = 'block';
        fillDetail(nId, nmId, cId, rId, tn);
      }
    }
  });
}

function renderBubble() {
  if (!allTeams.length) return;
  document.getElementById('chBadge').textContent = `${allTeams.length} teams`;
  mkBubble(allTeams, document.getElementById('bX').value, document.getElementById('bY').value, document.getElementById('bR').value, document.getElementById('bCol').value, 'bubCanvas', ['bdN', 'bdNm', 'bdC', 'bdR', 'bubDet'], bUseCorr);
}

function renderOPR() {
  if (!allTeams.length) return;
  mkBar(allTeams, document.getElementById('oM').value, document.getElementById('oS').value, 'oprCanvas', ['oN', 'oNm', 'oC', 'oR', 'oprDet'], oUseCorr, false);
}

function renderRank() {
  if (!allTeams.length) return;
  mkBar(allTeams, document.getElementById('rM').value, 'desc', 'rankCanvas', ['rN', 'rNm', 'rC', 'rR', 'rankDet'], rUseCorr, true);
}

function getRem() {
  const picked = pickedTeams();
  return allTeams.filter(t => !picked.includes(t.teamNumber));
}

function renderPlBubble() {
  const rem = getRem();
  if (!rem.length) return;
  mkBubble(rem, document.getElementById('plBX').value, document.getElementById('plBY').value, document.getElementById('plBR').value, 'role', 'plBubCanvas', ['plBdN', 'plBdNm', 'plBdC', 'plBdR', 'plBubDet'], false);
}

function renderPlOPR() {
  const rem = getRem();
  if (!rem.length) return;
  mkBar(rem, document.getElementById('plOM').value, document.getElementById('plOS').value, 'plOprCanvas', ['plON', 'plONm', 'plOC', 'plOR', 'plOprDet'], false, false);
}

function setChartTab(tab) {
  activeChartTab = tab;
  ['bubble', 'opr', 'rank', 'deviation'].forEach(t => { document.getElementById('cp-' + t).style.display = t === tab ? 'block' : 'none'; document.getElementById('ct-' + t)?.classList.toggle('on', t === tab); });
  if (tab === 'bubble') renderBubble(); else if (tab === 'opr') renderOPR(); else if (tab === 'rank') renderRank(); else if (tab === 'deviation') renderDeviation();
}

function toggleBCorr() { bUseCorr = !bUseCorr; document.getElementById('bCorrTog').classList.toggle('on', bUseCorr); renderBubble(); }
function toggleOCorr() { oUseCorr = !oUseCorr; document.getElementById('oCorrTog').classList.toggle('on', oUseCorr); renderOPR(); }
function toggleRCorr() { rUseCorr = !rUseCorr; document.getElementById('rCorrTog').classList.toggle('on', rUseCorr); renderRank(); }

function renderPlRank() {
  const rem = getRem();
  if (!rem.length) return;
  mkBar(rem, document.getElementById('plRM').value, 'desc', 'plRankCanvas', ['plRN', 'plRNm', 'plRC', 'plRR', 'plRankDet'], false, true);
}

function renderDeviation() {
  if (!cal.ready || !allTeams.length) return;
  if (chartInsts['devCanvas']) chartInsts['devCanvas'].destroy();
  const ctx = document.getElementById('devCanvas')?.getContext('2d');
  if (!ctx) return;

  const points = allTeams.map(t => {
    const ts = cal.teamScalars[t.teamNumber];
    if (!ts) return null;
    const x = ts.scalar;
    const y = ts.r2 ?? 0.5;
    const r = Math.max(8, Math.min(20, (ts.n || 1) / 2));
    const isConsistent = (y >= 0.7);
    const color = isConsistent ? 'rgba(16,185,129,0.7)' : y >= 0.4 ? 'rgba(245,158,11,0.7)' : 'rgba(239,68,68,0.7)';
    return { x, y, r, tn: t.teamNumber, teamName: t.teamName, n: ts.n, color, consistent: isConsistent };
  }).filter(Boolean);

  chartInsts['devCanvas'] = new Chart(ctx, {
    type: 'bubble',
    data: {
      datasets: [{
        label: 'Team Correction Consistency',
        data: points.map(p => ({ x: p.x, y: p.y, r: p.r, tn: p.tn, teamName: p.teamName, n: p.n })),
        backgroundColor: points.map(p => p.color),
        borderColor: points.map(p => p.color.replace(/\)$/, '.3)')),
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 10 } } },
        tooltip: {
          callbacks: {
            label: item => {
              const d = item.raw;
              const consistency = d.y >= 0.7 ? 'High' : d.y >= 0.4 ? 'Moderate' : 'Low';
              return [`${d.tn} — ${d.teamName}`, `Scalar: ${d.x.toFixed(3)}×`, `R²: ${d.y.toFixed(3)}`, `Data pts: ${d.n}`, `Consistency: ${consistency}`];
            }
          }
        }
      },
      scales: {
        x: { title: { display: true, text: 'Correction Scalar (× multiplier)', color: '#64748b', font: { size: 10 } }, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(30,58,95,.3)' } },
        y: { title: { display: true, text: 'Consistency (R² - scouting accuracy)', color: '#64748b', font: { size: 10 } }, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(30,58,95,.3)' }, min: 0, max: 1 }
      },
      onClick: (e, els) => {
        if (!els.length) return;
        const d = chartInsts['devCanvas'].data.datasets[els[0].datasetIndex].data[els[0].index];
        jumpTeam(d.tn);
      }
    }
  });
}
