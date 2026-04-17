// Matches page rendering and match card utilities
function renderMatches() {
  const list = document.getElementById('matchList');
  const bar = document.getElementById('tbabar');
  let matches = [];
  if (tbaData) {
    if (bar) bar.style.display = 'flex';
    document.getElementById('tbabarTxt').textContent = `${tbaEvt} · ${tbaData.matches.length} qual matches`;
    matches = tbaData.matches.map(m => ({
      num: m.match_number,
      red: m.alliances.red.team_keys.map(k => parseInt(k.replace('frc', ''))),
      blue: m.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', ''))),
      redScore: m.alliances.red.score,
      blueScore: m.alliances.blue.score,
      done: m.alliances.red.score !== null && m.alliances.red.score >= 0
    }));
  } else {
    if (bar) bar.style.display = 'none';
    const byM = {};
    rawRows.forEach(r => {
      if (!r.matchNumber || isNS(r)) return;
      const mn_ = parseInt(r.matchNumber);
      if (!byM[mn_]) byM[mn_] = { num: mn_, teams: [] };
      byM[mn_].teams.push(parseInt(r.teamNumber));
    });
    matches = Object.values(byM).sort((a, b) => a.num - b.num).map(m => ({ num: m.num, red: m.teams.slice(0, 3), blue: m.teams.slice(3, 6), redScore: -1, blueScore: -1, done: false }));
  }
  document.getElementById('mBadge').textContent = matches.length;

  let calHtml = '';
  if (cal.ready) {
    const pct = ((cal.scalar - 1) * 100).toFixed(1);
    const sign = cal.scalar >= 1 ? '+' : '';
    const q = cal.r2 !== null ? (cal.r2 > 0.75 ? 'good' : cal.r2 > 0.45 ? 'ok' : 'poor') : 'poor';
    const qLabel = { good: 'High confidence', ok: 'Moderate confidence', poor: 'Low confidence' }[q];
    calHtml = `<div class="calbanner" style="flex-direction:column; align-items:stretch;">
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;width:100%">
        <div><div style="font-size:9px;color:var(--mut);text-transform:uppercase;letter-spacing:.4px;margin-bottom:2px">Global Scalar</div><div class="calscalar">${cal.scalar.toFixed(3)}×</div></div>
        <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--dim);margin-bottom:2px">Scouted scores ${sign}${pct}% vs TBA on average</div>
        <div style="font-size:10px;color:var(--mut)">${cal.n} alliance data points · R²=${cal.r2 !== null ? cal.r2.toFixed(3) : '—'} · RMSE≈${cal.rmse !== null ? cal.rmse.toFixed(1) : '—'} pts · Per-team scalars computed for ${Object.values(cal.teamScalars).filter(ts => !ts.fallback).length} teams</div></div>
        <span class="calq cq-${q}">${qLabel}</span>
      </div>
      <div class="cwrap" style="height:220px; margin-top:14px;"><canvas id="calChart"></canvas></div>
    </div>`;
  }

  list.innerHTML = calHtml + matches.map(m => buildMCard(m)).join('');
  if (cal.ready) setTimeout(renderCalChart, 50);
}

function renderCalChart() {
  if (!cal.ready || !cal.pts.length) return;
  const ctx = document.getElementById('calChart')?.getContext('2d');
  if (!ctx) return;
  if (chartInsts['calChart']) chartInsts['calChart'].destroy();
  const ptsRed = cal.pts.filter(p => p.alliance === 'red');
  const ptsBlue = cal.pts.filter(p => p.alliance === 'blue');
  const maxS = Math.max(...cal.pts.map(p => p.scouted));
  chartInsts['calChart'] = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        { label: 'Red', data: ptsRed.map(p => ({ x: p.scouted, y: p.tba, match: p.match })), backgroundColor: 'rgba(239,68,68,0.7)', pointRadius: 5 },
        { label: 'Blue', data: ptsBlue.map(p => ({ x: p.scouted, y: p.tba, match: p.match })), backgroundColor: 'rgba(59,130,246,0.7)', pointRadius: 5 },
        { label: 'Trend', data: [{ x: 0, y: 0 }, { x: maxS + 20, y: (maxS + 20) * cal.scalar }], type: 'line', borderColor: 'rgba(0,212,170,0.8)', pointRadius: 0, borderDash: [5, 5] }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Scouted Total Score', color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(30,58,95,.3)' }, ticks: { color: '#64748b' } },
        y: { title: { display: true, text: 'TBA Actual Score', color: '#64748b', font: { size: 11 } }, grid: { color: 'rgba(30,58,95,.3)' }, ticks: { color: '#64748b' } }
      },
      plugins: {
        legend: { labels: { color: '#94a3b8' } },
        tooltip: {
          callbacks: {
            title: items => { const d = items[0]?.raw; return d && d.match != null ? `Qual Match ${d.match}` : ''; },
            label: item => { const d = item.raw; return [`Scouted: ${d.x}`, `TBA: ${d.y}`]; }
          }
        }
      }
    }
  });
}

const scoutedAll = teams => {
  let s = 0, c = 0;
  teams.forEach(tn => { const t = allTeams.find(x => x.teamNumber === tn); if (t && t.totalAvg !== null) { s += t.totalAvg; c++; } });
  return c ? s : null;
};

function buildMCard(m) {
  const sR = scoutedAll(m.red);
  const sB = scoutedAll(m.blue);
  const allHave = [...m.red, ...m.blue].every(tn => allTeams.find(x => x.teamNumber === tn));
  const misWarn = allHave ? '' : `<span style="font-size:9px;color:var(--yel);margin-left:5px">Missing data</span>`;
  const chipR = m.red.map(tn => `<span class="tchip${allTeams.find(x => x.teamNumber === tn) ? '' : ' nd'}" onclick="event.stopPropagation();jumpTeam(${tn})">${tn}</span>`).join('');
  const chipB = m.blue.map(tn => `<span class="tchip${allTeams.find(x => x.teamNumber === tn) ? '' : ' nd'}" onclick="event.stopPropagation();jumpTeam(${tn})">${tn}</span>`).join('');
  let stHtml = '', scHtml = '';
  if (m.done) {
    const rw = m.redScore > m.blueScore;
    const winnerFlipped = (sR !== null && sB !== null) && ((sR > sB) !== rw);
    const dW = winnerFlipped ? `<span class="divwarn">Divergence</span>` : '';
    stHtml = `<span class="mst mst-c">Done</span>`;
    scHtml = `<div class="mscores"><div><div class="msv-v ${rw ? 'rw' : ''}">${m.redScore}</div><div class="msv-l">Red TBA</div></div><span style="color:var(--mut);font-weight:700">—</span><div><div class="msv-v ${!rw ? 'bw' : ''}">${m.blueScore}</div><div class="msv-l">Blue TBA</div></div>${dW}</div>`;
  } else if (sR !== null || sB !== null) {
    stHtml = `<span class="mst mst-p">Predicted</span>`;
    scHtml = `<div class="mscores"><div><div class="msv-v pr">${sR !== null ? Math.round(sR) : '?'}</div><div class="msv-l">Est Red</div></div><span style="color:var(--mut)">VS</span><div><div class="msv-v pr">${sB !== null ? Math.round(sB) : '?'}</div><div class="msv-l">Est Blue</div></div></div>`;
  } else {
    stHtml = `<span class="mst mst-u">Upcoming</span>`;
    scHtml = `<div class="mscores"><span style="font-size:11px;color:var(--mut)">No data</span></div>`;
  }
  return `<div class="mcard"><div class="mhdr" onclick="toggleMatch('mb-${m.num}')">
    <span class="mnum">Q${m.num}</span>${stHtml}${misWarn}
    <div class="alcols"><div class="alblk"><span class="allbl al-r">Red</span>${chipR}</div><div class="alblk"><span class="allbl al-b">Blue</span>${chipB}</div></div>
    ${scHtml}
  </div>
  <div class="mbody" id="mb-${m.num}">${buildMBody(m, sR, sB)}</div></div>`;
}

function buildMBody(m, sR, sB) {
  const side = (tns, color, tbaScore, scouted) => `<div class="alsec ${color}"><div class="alst">${color === 'red' ? 'Red' : 'Blue'}</div>
    ${tns.map(tn => {
      const t = allTeams.find(x => x.teamNumber === tn);
      return `<div class="altr"><span style="font-weight:700;color:var(--txt);min-width:38px;font-size:12px">${tn}</span><span style="font-size:11px;color:var(--dim);flex:1">${t ? t.teamName : 'Unknown'}</span>${t ? `<span style="font-size:10px;color:var(--mut)">${fmt(t.autoAvg)}+${fmt(t.teleopAvg)}+${fmt(t.endgameAvg)}</span><span style="font-size:12px;font-weight:700;color:var(--acc)">${fmt(t.totalAvg)}</span>${rt(t.topRole)}` : ''}</div>`;
    }).join('')}
    ${m.done && scouted !== null ? `<div style="display:flex;gap:5px;margin-top:6px;font-size:11px;color:var(--mut)"><span>TBA: <strong style="color:${color === 'red' ? '#f87171' : '#60a5fa'}">${tbaScore}</strong></span><span>Scout est: <strong style="color:var(--acc)">${Math.round(scouted)}</strong></span><strong style="color:${Math.abs(tbaScore - scouted) > 25 ? 'var(--yel)' : 'var(--grn)'}">Δ${Math.round(Math.abs(tbaScore - scouted))}</strong></div>` : ''}
  </div>`;
  return `<div class="aldet">${side(m.red, 'red', m.redScore, sR)}${side(m.blue, 'blue', m.blueScore, sB)}</div>`;
}

function toggleMatch(id) {
  document.getElementById(id)?.classList.toggle('on');
}
