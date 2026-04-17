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

const scoutedAllCorrected = teams => {
  let s = 0, c = 0;
  teams.forEach(tn => {
    const t = allTeams.find(x => x.teamNumber === tn);
    if (t && t.totalAvg !== null) {
      s += cal.ready ? corrected(t.totalAvg, tn) : t.totalAvg;
      c++;
    }
  });
  return c ? s : null;
};

function getMatchDetails(matchNum) {
  if (!tbaData) return null;
  const match = tbaData.matches.find(m => m.match_number === matchNum);
  if (!match) return null;
  return {
    matchNum,
    redTeams: match.alliances.red.team_keys.map(k => parseInt(k.replace('frc', ''))),
    blueTeams: match.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', ''))),
    redScore: match.alliances.red.score,
    blueScore: match.alliances.blue.score
  };
}

function buildMatchLogTable(matchNum, side, teams) {
  const rows = teams.map(tn => {
    const t = allTeams.find(x => x.teamNumber === tn);
    if (!t || !t.history) return null;
    const hist = t.history.find(h => h.match === matchNum);
    if (!hist) return null;
    return `<tr><td class="tn">${tn}</td><td>${t.teamName.slice(0, 20)}</td><td>${hist.auto}</td><td>${hist.teleop}</td><td>${hist.endgame}</td><td style="font-weight:700;color:var(--acc)">${hist.total}</td></tr>`;
  }).filter(Boolean);

  if (!rows.length) return `<div style="font-size:11px;color:var(--mut);padding:8px">No data available</div>`;

  return `<table class="match-detail-table">
    <thead><tr><th>Team</th><th>Name</th><th>Auto</th><th>Teleop</th><th>Endgame</th><th>Total</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>`;
}

function buildScoutedInfoTable(matchNum, side, teams) {
  const rows = teams.map(tn => {
    const t = allTeams.find(x => x.teamNumber === tn);
    if (!t || !t.history) return null;
    const hist = t.history.find(h => h.match === matchNum);
    if (!hist) return null;
    const roleStr = hist.roles && hist.roles.length ? hist.roles.join(', ') : 'N/A';
    return `<tr><td class="tn">${tn}</td><td>${t.teamName.slice(0, 20)}</td><td>${hist.climb || '—'}</td><td>${hist.startPos || '—'}</td><td>${roleStr}</td></tr>`;
  }).filter(Boolean);

  if (!rows.length) return `<div style="font-size:11px;color:var(--mut);padding:8px">No data available</div>`;

  return `<table class="match-detail-table">
    <thead><tr><th>Team</th><th>Name</th><th>Climb</th><th>Start Pos</th><th>Roles</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>`;
}

function buildMatchScalarsTable(matchNum, side, teams) {
  if (!cal.ready) return `<div style="font-size:11px;color:var(--mut);padding:8px">Calibration not ready</div>`;

  const rows = teams.map(tn => {
    const t = allTeams.find(x => x.teamNumber === tn);
    const ts = cal.teamScalars[tn];
    if (!t || !ts) return null;

    const raw = t.totalAvg || 0;
    const corrected = raw * ts.scalar;
    const fb = ts.fallback ? 'Global' : 'Team';
    const r2Str = ts.r2 !== null ? ts.r2.toFixed(3) : '—';
    const corrColor = corrected > 0 ? 'var(--acc)' : 'var(--mut)';

    return `<tr>
      <td class="tn">${tn}</td>
      <td style="color:var(--dim)">${fmt(raw)}</td>
      <td style="font-weight:700">${ts.scalar.toFixed(3)}×</td>
      <td style="color:${corrColor};font-weight:700">${fmt(corrected)}</td>
      <td style="font-size:9px">${ts.n} pts</td>
      <td>${r2Str}</td>
      <td style="font-size:9px">${fb}</td>
    </tr>`;
  }).filter(Boolean);

  if (!rows.length) return `<div style="font-size:11px;color:var(--mut);padding:8px">No scalars available</div>`;

  return `<table class="match-detail-table">
    <thead><tr><th>Team</th><th>Scouted</th><th>Scalar</th><th>Corrected</th><th>Data</th><th>R²</th><th>Type</th></tr></thead>
    <tbody>${rows.join('')}</tbody>
  </table>`;
}

function buildAllianceCalcBreakdown(matchNum, side, teams) {
  if (!cal.ready || !tbaData) return '';

  const match = tbaData.matches.find(m => m.match_number === matchNum);
  if (!match) return '';

  const isSameAlliance = (side === 'red' && match.alliances.red.team_keys.some(k => {
    const tn = parseInt(k.replace('frc', ''));
    return teams.includes(tn);
  })) || (side === 'blue' && match.alliances.blue.team_keys.some(k => {
    const tn = parseInt(k.replace('frc', ''));
    return teams.includes(tn);
  }));

  if (!isSameAlliance) return '';

  const tbaScore = side === 'red' ? match.alliances.red.score : match.alliances.blue.score;
  if (tbaScore === null || tbaScore < 0) return '';

  let rawTotal = 0, correctedTotal = 0;
  teams.forEach(tn => {
    const t = allTeams.find(x => x.teamNumber === tn);
    if (t) {
      rawTotal += t.totalAvg || 0;
      const corrected = (t.totalAvg || 0) * (cal.teamScalars[tn]?.scalar || 1);
      correctedTotal += corrected;
    }
  });

  const error = Math.abs(correctedTotal - tbaScore);
  const errorColor = error < 5 ? 'var(--grn)' : error < 15 ? 'var(--yel)' : 'var(--red)';

  return `<div style="background:var(--surf2);padding:10px;border-radius:6px;margin-top:8px;font-size:10px">
    <div style="margin-bottom:6px;color:var(--dim);font-weight:700">${side === 'red' ? 'Red' : 'Blue'} Alliance Correction:</div>
    <div style="display:grid;gap:8px">
      <div style="display:flex;justify-content:space-between">
        <span>Raw scouted total:</span>
        <span style="font-weight:700;color:var(--mut)">${fmt(rawTotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between">
        <span>Per-team corrected:</span>
        <span style="font-weight:700;color:var(--acc)">${fmt(correctedTotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--bdr);padding-top:6px">
        <span>TBA actual score:</span>
        <span style="font-weight:700;color:#0ea5e9">${tbaScore}</span>
      </div>
      <div style="display:flex;justify-content:space-between;color:${errorColor};font-weight:700">
        <span>Error:</span>
        <span>${error < 1 ? '✓ Perfect!' : fmt(error) + ' pts'}</span>
      </div>
    </div>
  </div>`;
}

function toggleMatchDetails(matchNum) {
  const detailEl = document.getElementById(`match-details-${matchNum}`);
  if (!detailEl) return;
  const isOpen = detailEl.style.display !== 'none';
  detailEl.style.display = isOpen ? 'none' : 'block';
}

function buildMCard(m) {
  const sR = scoutedAllCorrected(m.red);
  const sB = scoutedAllCorrected(m.blue);
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
  const detailsHtml = tbaData ? `<div class="match-details" id="match-details-${m.num}" style="display:none">
    <div class="match-detail-section">
      <div class="match-detail-title">Raw Match Logs</div>
      <div class="match-detail-content" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:10px;color:var(--mut);margin-bottom:6px;font-weight:700">Red Alliance</div>${buildMatchLogTable(m.num, 'red', m.red)}</div>
        <div><div style="font-size:10px;color:var(--mut);margin-bottom:6px;font-weight:700">Blue Alliance</div>${buildMatchLogTable(m.num, 'blue', m.blue)}</div>
      </div>
    </div>
    <div class="match-detail-section">
      <div class="match-detail-title">Scouted Info</div>
      <div class="match-detail-content" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:10px;color:var(--mut);margin-bottom:6px;font-weight:700">Red Alliance</div>${buildScoutedInfoTable(m.num, 'red', m.red)}</div>
        <div><div style="font-size:10px;color:var(--mut);margin-bottom:6px;font-weight:700">Blue Alliance</div>${buildScoutedInfoTable(m.num, 'blue', m.blue)}</div>
      </div>
    </div>
    <div class="match-detail-section">
      <div class="match-detail-title">Scalar Correction & Error Analysis</div>
      <div class="match-detail-content" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div><div style="font-size:10px;color:var(--mut);margin-bottom:6px;font-weight:700">Red Alliance</div>${buildMatchScalarsTable(m.num, 'red', m.red)}${buildAllianceCalcBreakdown(m.num, 'red', m.red)}</div>
        <div><div style="font-size:10px;color:var(--mut);margin-bottom:6px;font-weight:700">Blue Alliance</div>${buildMatchScalarsTable(m.num, 'blue', m.blue)}${buildAllianceCalcBreakdown(m.num, 'blue', m.blue)}</div>
      </div>
    </div>
  </div>` : '';

  return `<div class="mcard"><div class="mhdr" onclick="toggleMatch('mb-${m.num}')">
    <span class="mnum">Q${m.num}</span>${stHtml}${misWarn}
    <div class="alcols"><div class="alblk"><span class="allbl al-r">Red</span>${chipR}</div><div class="alblk"><span class="allbl al-b">Blue</span>${chipB}</div></div>
    ${scHtml}
  </div>
  ${tbaData ? `<button class="match-expand-btn" onclick="event.stopPropagation();toggleMatchDetails(${m.num})" style="width:100%;padding:8px;margin-top:0;border:none;background:var(--surf2);color:var(--acc);font-size:11px;cursor:pointer;border-top:1px solid var(--bdr)">▼ Details</button>` : ''}
  ${detailsHtml}
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
