// Teams page and detail rendering
function setTView(mode) {
  tViewMode = mode;
  document.querySelectorAll('#tv-avg, #tv-max, #tv-min, #tv-corr').forEach(b => b.classList.remove('on'));
  document.getElementById('tv-' + mode)?.classList.add('on');
  renderTeams();
}

// Helper for debugging sorts from the console
function debugPrintSorted() {
  try {
    const rows = getFilteredTeams().map(t => ({ teamNumber: t.teamNumber, name: t.teamName, val: getTeamVal(t, sortKey) }));
    console.log('[sort] debugPrintSorted', { sortKey, sortDir, rows });
    return rows;
  } catch (e) {
    console.error('[sort] debugPrintSorted error', e);
    return null;
  }
}

function getTeamVal(t, key) {
  if (key === 'teamNumber' || key === 'validCount' || key === 'climbRate') return t[key];
  if (key === 'auto' || key === 'teleop' || key === 'endgame' || key === 'total') {
    if (tViewMode === 'avg') return t[key + 'Avg'];
    if (tViewMode === 'max') return t[key + 'Max'];
    if (tViewMode === 'min') return t[key + 'Min'];
    if (tViewMode === 'corr') return cal.ready ? corrected(t[key + 'Avg'], t.teamNumber) : t[key + 'Avg'];
  }
  if (key === 'dprMulti' || key === 'dprPoints') return t[key];
  return t[key] ?? null;
}

function setSort(k) {
  const prevKey = sortKey;
  const prevDir = sortDir;
  if (sortKey === k) sortDir *= -1;
  else { sortKey = k; sortDir = -1; }
  console.log('[sort] setSort', { requested: k, prevKey, prevDir, newKey: sortKey, newDir: sortDir });
  document.querySelectorAll('.sort-controls .sbtn').forEach(b => {
    b.classList.remove('on');
    b.textContent = b.textContent.replace(/ [\u2191\u2193]$/, '');
  });
  const btn = document.getElementById('sk-' + k);
  if (btn) { btn.classList.add('on'); btn.textContent = btn.textContent.replace(/ [\u2191\u2193]$/, '') + (sortDir > 0 ? ' \u2191' : ' \u2193'); }
  renderTeams();
}

function setDprSort() {
  if (sortKey === 'dprMulti' || sortKey === 'dprPoints') {
    dprSortMetric = dprSortMetric === 'dprMulti' ? 'dprPoints' : 'dprMulti';
    sortKey = dprSortMetric;
  } else {
    sortKey = dprSortMetric;
    sortDir = 1;
  }
  document.querySelectorAll('.sort-controls .sbtn').forEach(b => {
    b.classList.remove('on');
    b.textContent = b.textContent.replace(/ [\u2191\u2193]$/, '');
  });
  const btn = document.getElementById('sk-dprMulti');
  const label = dprSortMetric === 'dprMulti' ? 'DPR x' : 'DPR pts';
  if (btn) { btn.classList.add('on'); btn.textContent = label + (sortDir > 0 ? ' \u2191' : ' \u2193'); }
  renderTeams();
}

function getFilteredTeams() {
  const q = (document.getElementById('tSearch')?.value || '').toLowerCase();
  let a = allTeams.filter(t => !q || String(t.teamNumber).includes(q) || t.teamName.toLowerCase().includes(q));
  try {
    const samplePre = a.slice(0, 8).map(t => ({ teamNumber: t.teamNumber, val: getTeamVal(t, sortKey) }));
    console.log('[sort] preSort sample', { sortKey, sortDir, samplePre });
  } catch (e) { console.debug('[sort] preSort sample error', e); }
  const sorted = [...a].sort((a, b) => {
    let av = getTeamVal(a, sortKey);
    let bv = getTeamVal(b, sortKey);
    if (av == null) av = sortDir > 0 ? 1e9 : -1e9;
    if (bv == null) bv = sortDir > 0 ? 1e9 : -1e9;
    return (av - bv) * sortDir;
  });
  try {
    const samplePost = sorted.slice(0, 8).map(t => ({ teamNumber: t.teamNumber, val: getTeamVal(t, sortKey) }));
    console.log('[sort] postSort sample', { sortKey, sortDir, samplePost });
  } catch (e) { console.debug('[sort] postSort sample error', e); }
  return sorted;
}

function getDeltaBadge(t) {
  if (!cal.ready || t.totalAvg === null) return '';
  const raw = t.totalAvg;
  const corr = tCorr(t);
  if (corr === null) return '';
  const delta = corr - raw;
  const color = delta > 0 ? 'var(--grn)' : delta < 0 ? 'var(--red)' : 'var(--mut)';
  const absDelta = Math.abs(delta);
  const deltaStr = delta > 0 ? `+${(Math.round(absDelta * 10) / 10)}` : `${(Math.round(absDelta * 10) / 10)}`;
  return `<span style="font-size:10px;font-weight:700;color:${color};margin-left:4px">${deltaStr}</span>`;
}

function renderTeams() {
  const teams = getFilteredTeams();
  document.getElementById('tBadge').textContent = allTeams.length;
  document.getElementById('tBody').innerHTML = teams.map(t => {
    const vC = tViewMode === 'corr';
    const au = getTeamVal(t, 'auto');
    const te = getTeamVal(t, 'teleop');
    const en = getTeamVal(t, 'endgame');
    const tot = getTeamVal(t, 'total');
    return `
      <tr class="cl" onclick="toggleDet(${t.teamNumber})">
        <td class="tnum">${t.teamNumber}</td>
        <td style="font-weight:500">${t.teamName} ${renderTeamScheduleStrengthBadge(t.teamNumber)}</td>
        <td><span class="badge">${t.validCount}</span></td>
        <td class="sv ${sc(au, vC ? 12 : 10, 4)}">${fmt(au)}</td>
        <td class="sv ${sc(te, vC ? 48 : 40, 15)}">${fmt(te)}</td>
        <td class="sv ${sc(en, vC ? 12 : 10, 4)}">${fmt(en)}</td>
        <td class="sv ${sc(tot, vC ? 70 : 60, 25)}" style="font-size:14px;font-weight:700">${fmt(tot)}${getDeltaBadge(t)}</td>
        <td>${t.climbRate !== null ? `<div class="cbar"><div class="cbar-bg"><div class="cbar-fill" style="width:${Math.round(t.climbRate * 100)}%"></div></div><span style="font-size:10px;color:var(--dim)">${Math.round(t.climbRate * 100)}%</span></div>` : '—'}</td>
        <td class="sv md">${(dprSortMetric === 'dprPoints' && t.dprPoints !== null && t.dprPoints > 0) ? ('-' + Math.round(t.dprPoints) + 'pts') : (t.dprMulti !== null && t.dprMulti < 1 ? t.dprMulti.toFixed(2) + '×' : '—')}</td>
        <td>${rt(t.topRole) || '—'}</td>
        <td>${rp(t.drivingProf)}</td>
      </tr>
      <tr class="drow"><td colspan="11"><div class="dpanel" id="dp-${t.teamNumber}">${buildDetHTML(t)}</div></td></tr>
    `;
  }).join('');
}

function toggleDet(tn) {
  const p = document.getElementById('dp-' + tn);
  if (!p) return;
  const was = p.classList.contains('on');
  document.querySelectorAll('.dpanel.on').forEach(x => x.classList.remove('on'));
  if (!was) { p.classList.add('on'); requestAnimationFrame(() => initDetChart(tn)); }
}

function buildDetHTML(t) {
  const re = Object.entries(t.roleCounts).sort((a, b) => b[1] - a[1]);
  const mxR = re[0]?.[1] || 1;
  const corr = cal.ready ? tCorr(t) : null;
  const ts = cal.teamScalars?.[t.teamNumber];
  const mRows = t.history.map(m => `<tr><td>M${m.match}</td><td>${fmt(m.auto, 0)}</td><td>${fmt(m.teleop, 0)}</td><td>${fmt(m.endgame, 0)}</td><td style="color:var(--acc);font-weight:700">${fmt(m.total, 0)}</td><td>${m.climb && !isNA(m.climb) ? (m.climb.toLowerCase().includes('success') ? 'S' : m.climb.toLowerCase().includes('fail') ? 'F' : m.climb) : '—'}</td></tr>`).join('');

  const scheduleStrengthHtml = renderTeamScheduleStrengthBadge(t.teamNumber) ? `<div class="scard" style="--cc:#f59e0b"><div class="sclbl">Schedule</div><div class="scval">${getScheduleStrengthLabel(getTeamScheduleStrength(t.teamNumber)) || '—'}</div><div class="scsub">Average opponent strength</div></div>` : '';
  const teamScalarValue = cal.ready ? (cal.teamScalars?.[t.teamNumber]?.scalar || cal.scalar) : null;
  const teamScalarHtml = cal.ready ? `<div class="scard" style="--cc:#8b5cf6"><div class="sclbl">Team Scalar</div><div class="scval">${teamScalarValue ? teamScalarValue.toFixed(3) + '×' : '—'}</div><div class="scsub">Per-team correction factor</div></div><div class="scard" style="--cc:#a855f7"><div class="sclbl">Global Scalar</div><div class="scval">${fmt(cal.scalar, 3)}×</div><div class="scsub">Used when team scalar unavailable</div></div>` : '';
  const perMatchRows = cal.ready ? Object.entries(perMatchScalars[t.teamNumber] || {}).sort((a, b) => a[0] - b[0]).map(([mn, s]) => `<tr><td style="padding:4px 6px;border-bottom:1px solid var(--bdr)">Q${mn}</td><td style="padding:4px 6px;border-bottom:1px solid var(--bdr);text-align:right">${s.toFixed(3)}×</td><td style="padding:4px 6px;border-bottom:1px solid var(--bdr);text-align:right">${fmt(perMatchCorrectedAvgs[t.teamNumber]?.[mn] || 0)}</td></tr>`).join('') : '';
  const perMatchScalarHtml = cal.ready ? `<div class="sec" style="overflow:auto;max-height:190px"><div class="sttl">Per-match Scalars</div><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr><th style="text-align:left;color:var(--mut);padding:4px 6px;border-bottom:1px solid var(--bdr)">Match</th><th style="text-align:right;color:var(--mut);padding:4px 6px;border-bottom:1px solid var(--bdr)">Scalar</th><th style="text-align:right;color:var(--mut);padding:4px 6px;border-bottom:1px solid var(--bdr)">Corrected</th></tr></thead><tbody>${perMatchRows || `<tr><td colspan="3" style="padding:6px;color:var(--mut)">No per-match scalar data</td></tr>`}</tbody></table></div>` : '';

  return `<div class="dcards">
    <div class="scard" style="--cc:#00d4aa"><div class="sclbl">Total Avg</div><div class="scval">${fmt(t.totalAvg)}</div><div class="scsub">Min ${fmt(t.totalMin, 0)} · Max ${fmt(t.totalMax, 0)} · σ ${fmt(t.totalStd, 1)}${corr !== null ? `<br>Corr <span class="corrval">${fmt(corr)}</span><span class="corrtag">×${ts?.scalar.toFixed(2) || '?'} ${ts?.fallback ? '(global)' : '(team)'}</span>` : ''}</div></div>
    ${teamScalarHtml}
    <div class="scard" style="--cc:#6366f1"><div class="sclbl">Auto Avg</div><div class="scval">${fmt(t.autoAvg)}</div><div class="scsub">Min ${fmt(t.autoMin, 0)} · Max ${fmt(t.autoMax, 0)}${cal.ready ? ` · Corr <span class="corrval">${fmt(corrected(t.autoAvg, t.teamNumber))}</span>` : ''}</div></div>
    <div class="scard" style="--cc:#0ea5e9"><div class="sclbl">Teleop Avg</div><div class="scval">${fmt(t.teleopAvg)}</div><div class="scsub">Min ${fmt(t.teleopMin, 0)} · Max ${fmt(t.teleopMax, 0)}${cal.ready ? ` · Corr <span class="corrval">${fmt(corrected(t.teleopAvg, t.teamNumber))}</span>` : ''}</div></div>
    <div class="scard" style="--cc:#f59e0b"><div class="sclbl">Endgame Avg</div><div class="scval">${fmt(t.endgameAvg)}</div><div class="scsub">Min ${fmt(t.endgameMin, 0)} · Max ${fmt(t.endgameMax, 0)}${cal.ready ? ` · Corr <span class="corrval">${fmt(corrected(t.endgameAvg, t.teamNumber))}</span>` : ''}</div></div>
    <div class="scard" style="--cc:#10b981"><div class="sclbl">Climb</div><div class="scval">${t.climbRate !== null ? Math.round(t.climbRate * 100) + '%' : '—'}</div><div class="scsub">${t.climbSuccess}/${t.climbAttempts} attempts</div></div>
    <div class="scard" style="--cc:#ef4444"><div class="sclbl">DPR (Defense)</div><div class="scval">${t.dprMulti !== null && t.dprMulti < 1 ? t.dprMulti.toFixed(2) + '×' : '—'}</div><div class="scsub">${t.dprPoints !== null && t.dprPoints > 0 ? '-' + Math.abs(Math.round(t.dprPoints)) + ' pts limit (avg)' : ''}</div></div>
    ${scheduleStrengthHtml}
  </div>
  <div class="dgrid">
    <div class="sec"><div class="sttl">Score/Match</div><div class="cwrap"><canvas id="dc-${t.teamNumber}"></canvas></div></div>
    <div class="sec"><div class="sttl">Rank Prediction</div>${renderTeamRankPrediction(t.teamNumber) || '<span style="font-size:11px;color:var(--mut)">No TBA data</span>'}</div>
    <div class="sec" style="overflow:auto;max-height:190px"><div class="sttl">Match Log</div><table style="width:100%;border-collapse:collapse;font-size:11px"><thead><tr><th style="text-align:left;color:var(--mut);padding:3px 6px;border-bottom:1px solid var(--bdr)">M</th><th style="color:var(--mut);padding:3px 6px;border-bottom:1px solid var(--bdr);text-align:right">Au</th><th style="color:var(--mut);padding:3px 6px;border-bottom:1px solid var(--bdr);text-align:right">Te</th><th style="color:var(--mut);padding:3px 6px;border-bottom:1px solid var(--bdr);text-align:right">En</th><th style="color:var(--mut);padding:3px 6px;border-bottom:1px solid var(--bdr);text-align:right">Tot</th><th style="color:var(--mut);padding:3px 6px;border-bottom:1px solid var(--bdr);text-align:right">Cl</th></tr></thead><tbody>${mRows}</tbody></table></div>
    <div class="sec"><div class="sttl">Roles</div>${re.map(([role, cnt]) => `<div class="rrow"><span style="font-size:10px;min-width:80px">${rt(role)}</span><div class="rbg"><div class="rfill" style="width:${Math.round(cnt / mxR * 100)}%;background:${roleColor(role)}"></div></div><span style="font-size:10px;color:var(--mut)">${cnt}</span></div>`).join('') || '<span style="font-size:11px;color:var(--mut)">No data</span>'}</div>
    ${perMatchScalarHtml}
    <div class="sec"><div class="sttl">Scout Info</div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:6px;margin-bottom:8px">
        <div><div style="font-size:9px;color:var(--mut);margin-bottom:2px">Driving</div>${rp(t.drivingProf)}</div>
        <div><div style="font-size:9px;color:var(--mut);margin-bottom:2px">Defense</div>${rp(t.defenseEff)}</div>
        <div><div style="font-size:9px;color:var(--mut);margin-bottom:2px">Intake</div>${rp(t.intakeSpeed)}</div>
        <div><div style="font-size:9px;color:var(--mut);margin-bottom:2px">Fuel</div>${rp(t.fuelThroughput)}</div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
        <div>${t.strengths.slice(0, 3).map(s => `<div class="snote s"><div style="font-size:9px;font-weight:700;color:var(--grn);margin-bottom:2px">Strength</div>${s}</div>`).join('') || '—'}</div>
        <div>${t.weaknesses.slice(0, 3).map(s => `<div class="snote w"><div style="font-size:9px;font-weight:700;color:var(--red);margin-bottom:2px">Weakness</div>${s}</div>`).join('') || '—'}</div>
      </div>
    </div>
  </div>`;
}

function fillDetail(numId, nmId, cId, rId, tn) {
  const t = allTeams.find(x => x.teamNumber === tn);
  if (!t) return;
  document.getElementById(numId).textContent = t.teamNumber;
  document.getElementById(nmId).textContent = t.teamName;
  document.getElementById(cId).innerHTML = detCards(t);
  document.getElementById(rId).innerHTML = detRow(t);
}

function detCards(t) {
  const corr = cal.ready ? tCorr(t) : null;
  const ts = cal.teamScalars?.[t.teamNumber];
  const scTag = ts ? `<span class="corrtag">×${ts.scalar.toFixed(2)} ${ts.fallback ? '(g)' : '(t)'}</span>` : '';
  return `
    <div class="bdcard" style="--cc:#00d4aa"><div class="bdlbl">Total Avg</div><div class="bdval">${fmt(t.totalAvg)}</div><div class="bdsub">${fmt(t.totalStd, 1)}${corr !== null ? ` · Corr <span class="corrval">${fmt(corr)}</span>${scTag}` : ''}</div></div>
    <div class="bdcard" style="--cc:#6366f1"><div class="bdlbl">Auto</div><div class="bdval">${fmt(t.autoAvg)}</div><div class="bdsub">${fmt(t.autoMin, 0)}–${fmt(t.autoMax, 0)}</div></div>
    <div class="bdcard" style="--cc:#0ea5e9"><div class="bdlbl">Teleop</div><div class="bdval">${fmt(t.teleopAvg)}</div><div class="bdsub">${fmt(t.teleopMin, 0)}–${fmt(t.teleopMax, 0)}</div></div>
    <div class="bdcard" style="--cc:#f59e0b"><div class="bdlbl">Endgame</div><div class="bdval">${fmt(t.endgameAvg)}</div><div class="bdsub">${fmt(t.endgameMin, 0)}–${fmt(t.endgameMax, 0)}</div></div>
    <div class="bdcard" style="--cc:#10b981"><div class="bdlbl">Climb</div><div class="bdval">${t.climbRate !== null ? Math.round(t.climbRate * 100) + '%' : '—'}</div><div class="bdsub">${t.climbSuccess}/${t.climbAttempts}</div></div>
    <div class="bdcard" style="--cc:#818cf8"><div class="bdlbl">σ</div><div class="bdval">${fmt(t.totalStd, 1)}</div><div class="bdsub">${t.validCount} matches</div></div>`;
}

function detRow(t) {
  return `<div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center">${rt(t.topRole)}${rp(t.drivingProf)}${rp(t.intakeSpeed)}</div>
    ${t.strengths[0] ? `<div style="margin-top:5px;font-size:11px"><span style="color:var(--grn);font-weight:700">+</span> ${t.strengths[0]}</div>` : ''}
    ${t.weaknesses[0] ? `<div style="margin-top:3px;font-size:11px"><span style="color:var(--red);font-weight:700">-</span> ${t.weaknesses[0]}</div>` : ''}`;
}

function initDetChart(tn) {
  const t = allTeams.find(x => x.teamNumber === tn);
  if (!t || !t.history.length) return;
  if (detCharts[tn]) { detCharts[tn].destroy(); }
  const ctx = document.getElementById('dc-' + tn)?.getContext('2d');
  if (!ctx) return;
  detCharts[tn] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: t.history.map(m => `M${m.match}`),
      datasets: [
        { label: 'Auto', data: t.history.map(m => m.auto), backgroundColor: 'rgba(99,102,241,.8)', stack: 's' },
        { label: 'Teleop', data: t.history.map(m => m.teleop), backgroundColor: 'rgba(14,165,233,.8)', stack: 's' },
        { label: 'Endgame', data: t.history.map(m => m.endgame), backgroundColor: 'rgba(245,158,11,.8)', stack: 's' }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 9 }, boxWidth: 8 } },
        tooltip: { mode: 'index', callbacks: { footer: items => `Total: ${items.reduce((s, i) => s + i.raw, 0)}` } }
      },
      scales: {
        x: { stacked: true, ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(30,58,95,.3)' } },
        y: { stacked: true, ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(30,58,95,.3)' } }
      }
    }
  });
}
