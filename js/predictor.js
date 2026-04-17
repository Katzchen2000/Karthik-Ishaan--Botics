// Predictor page and Monte Carlo estimation
let lastMCRedScores = [];
let lastMCBlueScores = [];
let lastMCWinPct = 50;
function toggleMC() { useMC = !useMC; document.getElementById('mcTog')?.classList.toggle('on', useMC); runPred(); }
function setTbaCorrectionMode(mode) {
  tbaCorrectionMode = mode || 'none';
  const predSel = document.getElementById('corrModeSel');
  const teamSel = document.getElementById('teamCorrModeSel');
  if (predSel) predSel.value = tbaCorrectionMode;
  if (teamSel) teamSel.value = tbaCorrectionMode;
  renderTeams();
  renderTimeline();
  runPred();
}
function corrModeChanged() {
  setTbaCorrectionMode(document.getElementById('corrModeSel')?.value || 'none');
}
function teamCorrModeChanged() {
  setTbaCorrectionMode(document.getElementById('teamCorrModeSel')?.value || 'none');
}
function predModeChanged() { predMode = document.getElementById('predModeSel')?.value || 'avg'; runPred(); }

function predSlotChanged(al, i) {
  const el = document.getElementById(`${al}${i}`);
  const tn = el ? parseInt(el.value) : NaN;
  const t = tn ? allTeams.find(x => x.teamNumber === tn) : null;
  predDef[`${al}${i}`] = t && (t.topRole === 'Defender' || (t.roleCounts && t.roleCounts['Defender'] > 0));
  runPred();
}

function togglePredDef(al, i) {
  predDef[`${al}${i}`] = !predDef[`${al}${i}`];
  runPred();
}

function buildPredPresets() {
  const makeOpts = () => {
    const opts = ['<option value="">— Select —</option>'];
    const hasAlliance = alliances.some(slots => slots.some(t => t !== null));
    if (hasAlliance) {
      opts.push('<optgroup label="Picklist Alliances">');
      alliances.forEach((slots, ai) => {
        const filled = slots.filter(t => t !== null);
        if (!filled.length) return;
        const names = filled.map(tn => { const t = allTeams.find(x => x.teamNumber === tn); return t ? `${tn} ${t.teamName.slice(0, 10)}` : tn; });
        opts.push(`<option value="alliance-${ai}">A${ai + 1}: ${names.join(', ')}</option>`);
      });
      opts.push('</optgroup>');
    }
    if (tbaData && tbaData.matches.length) {
      opts.push('<optgroup label="Qual Matches (Red side)" id="redMatchGroup">');
      tbaData.matches.forEach(m => {
        const r = m.alliances.red.team_keys.map(k => parseInt(k.replace('frc', ''))).join(', ');
        const done = m.alliances.red.score >= 0 ? ` ✓ ${m.alliances.red.score}` : '';
        opts.push(`<option value="match-${m.match_number}">Q${m.match_number}${done}: [${r}]</option>`);
      });
      opts.push('</optgroup>');
    }
    return opts.join('');
  };
  const makeBlueOpts = () => {
    const opts = ['<option value="">— Select —</option>'];
    const hasAlliance = alliances.some(slots => slots.some(t => t !== null));
    if (hasAlliance) {
      opts.push('<optgroup label="Picklist Alliances">');
      alliances.forEach((slots, ai) => {
        const filled = slots.filter(t => t !== null);
        if (!filled.length) return;
        const names = filled.map(tn => { const t = allTeams.find(x => x.teamNumber === tn); return t ? `${tn} ${t.teamName.slice(0, 10)}` : tn; });
        opts.push(`<option value="alliance-${ai}">A${ai + 1}: ${names.join(', ')}</option>`);
      });
      opts.push('</optgroup>');
    }
    if (tbaData && tbaData.matches.length) {
      opts.push('<optgroup label="Qual Matches (Blue side)">');
      tbaData.matches.forEach(m => {
        const b = m.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', ''))).join(', ');
        const done = m.alliances.blue.score >= 0 ? ` ✓ ${m.alliances.blue.score}` : '';
        opts.push(`<option value="bmatch-${m.match_number}">Q${m.match_number}${done}: [${b}]</option>`);
      });
      opts.push('</optgroup>');
    }
    return opts.join('');
  };
  const rSel = document.getElementById('predRedPreset');
  const bSel = document.getElementById('predBluePreset');
  if (rSel) rSel.innerHTML = makeOpts();
  if (bSel) bSel.innerHTML = makeBlueOpts();
}

function applyPredPreset(side) {
  const selId = side === 'red' ? 'predRedPreset' : 'predBluePreset';
  const v = document.getElementById(selId)?.value;
  if (!v) return;
  if (v.startsWith('alliance-')) {
    const ai = parseInt(v.replace('alliance-', ''));
    const slots = alliances[ai].filter(t => t !== null);
    slots.forEach((tn, i) => { const e = document.getElementById(`${side}${i}`); if (e) { e.value = tn; predSlotChanged(side, i); } });
    for (let i = slots.length; i < 3; i++) { const e = document.getElementById(`${side}${i}`); if (e) { e.value = ''; predSlotChanged(side, i); } }
    runPred();
    return;
  }
  if ((v.startsWith('match-') || v.startsWith('bmatch-')) && tbaData) {
    const isBlue = v.startsWith('bmatch-');
    const mn_ = parseInt(v.replace('bmatch-', '').replace('match-', ''));
    const m = tbaData.matches.find(x => x.match_number === mn_);
    if (!m) return;
    const tns = (isBlue ? m.alliances.blue.team_keys : m.alliances.red.team_keys).map(k => parseInt(k.replace('frc', '')));
    [0, 1, 2].forEach(i => { const e = document.getElementById(`${side}${i}`); if (e) { e.value = tns[i] || ''; predSlotChanged(side, i); } });
    runPred();
  }
}

function clearPredSlots() {
  ['red', 'blue'].forEach(al => [0, 1, 2].forEach(i => { const e = document.getElementById(`${al}${i}`); if (e) { e.value = ''; predSlotChanged(al, i); } }));
  runPred();
}

function renderPredictor() {
  const opts = allTeams.map(t => `<option value="${t.teamNumber}">${t.teamNumber} — ${t.teamName}</option>`).join('');
  const e = '<option value="">— Select —</option>';
  ['red', 'blue'].forEach(al => document.getElementById(al + 'Slots').innerHTML = [0, 1, 2].map(i => `${e}<select class="tsel" id="${al}${i}" onchange="predSlotChanged('${al}', ${i})" style="margin-bottom:6px"><option value="">— Select —</option>${opts}</select>`).join(''));
  buildPredPresets();
  runPred();
}

function getSlots(al) {
  return [0, 1, 2].map(i => {
    const v = document.getElementById(`${al}${i}`)?.value;
    return v ? allTeams.find(t => t.teamNumber === parseInt(v)) : null;
  }).filter(Boolean);
}

function getSlotsWithIdx(al) {
  return [0, 1, 2].map(i => {
    const v = document.getElementById(`${al}${i}`)?.value;
    const t = v ? allTeams.find(x => x.teamNumber === parseInt(v)) : null;
    return t ? { t, i } : null;
  }).filter(Boolean);
}

function normSamp(m, s) {
  let u = 0, v = 0;
  while (!u) u = Math.random();
  while (!v) v = Math.random();
  return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function skewSamp(m, s, skew) {
  const z = normSamp(0, 1);
  const d = skew / Math.sqrt(1 + skew * skew);
  const u0 = d * Math.abs(z) + Math.sqrt(1 - d * d) * normSamp(0, 1);
  return m + s * u0;
}

function teamSkew(t) {
  if (!t.history || t.history.length < 3) return 0;
  const vals = t.history.map(h => h.total);
  const m = vals.reduce((s, v) => s + v, 0) / vals.length;
  const n = vals.length;
  const s2 = vals.reduce((s, v) => s + (v - m) ** 2, 0) / n;
  if (s2 === 0) return 0;
  const s3 = vals.reduce((s, v) => s + (v - m) ** 3, 0) / n;
  return s3 / (s2 ** 1.5);
}

const DEF_SCORE_MULT = 0.5;
function getMatchCorrectedTotals(t) {
  if (!t.history || !t.history.length) return [];
  return t.history.map(h => corrected(h.total, t.teamNumber, h.match));
}
function teamAvgVal(t) {
  if (!cal.ready || t.totalAvg === null) return t.totalAvg || 0;
  if (tbaCorrectionMode === 'none') return t.totalAvg || 0;
  if (tbaCorrectionMode === 'team') return tCorr(t) || 0;
  const values = getMatchCorrectedTotals(t).filter(v => v !== null && !isNaN(v));
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : (t.totalAvg || 0);
}
function teamMaxVal(t) {
  if (!cal.ready || t.totalMax === null) return t.totalMax || 0;
  if (tbaCorrectionMode === 'none') return t.totalMax || 0;
  if (tbaCorrectionMode === 'team') return corrected(t.totalMax, t.teamNumber) || 0;
  const values = getMatchCorrectedTotals(t).filter(v => v !== null && !isNaN(v));
  return values.length ? Math.max(...values) : (t.totalMax || 0);
}
function teamMinVal(t) {
  if (!cal.ready || t.totalMin === null) return t.totalMin || 0;
  if (tbaCorrectionMode === 'none') return t.totalMin || 0;
  if (tbaCorrectionMode === 'team') return corrected(t.totalMin, t.teamNumber) || 0;
  const values = getMatchCorrectedTotals(t).filter(v => v !== null && !isNaN(v));
  return values.length ? Math.min(...values) : (t.totalMin || 0);
}
function teamStdVal(t) { return cal.ready ? (t.totalStd || 0) * (cal.teamScalars[t.teamNumber]?.scalar || cal.scalar) : (t.totalStd || 0); }

function runPred() {
  const R = getSlotsWithIdx('red');
  const B = getSlotsWithIdx('blue');
  const res = document.getElementById('predRes');
  if (!R.length && !B.length) { if (res) res.style.display = 'none'; return; }
  if (res) res.style.display = 'block';

  const primaryVal = t => predMode === 'max' ? teamMaxVal(t) : predMode === 'min' ? teamMinVal(t) : teamAvgVal(t);
  const defMult = (alLabel, si) => !!predDef[`${alLabel}${si}`] ? DEF_SCORE_MULT : 1;
  const alSum = (slots, alLabel, valFn) => slots.reduce((s, { t, i }) => s + valFn(t) * defMult(alLabel, i), 0);
  const alStd = (slots, alLabel) => Math.sqrt(slots.reduce((s, { t, i }) => s + (teamStdVal(t) * defMult(alLabel, i)) ** 2, 0));

  let rPrim = alSum(R, 'red', primaryVal) || 0;
  let bPrim = alSum(B, 'blue', primaryVal) || 0;
  let rAvg = alSum(R, 'red', teamAvgVal) || 0;
  let bAvg = alSum(B, 'blue', teamAvgVal) || 0;
  let rMx = alSum(R, 'red', teamMaxVal) || 0;
  let bMx = alSum(B, 'blue', teamMaxVal) || 0;
  let rMn = alSum(R, 'red', teamMinVal) || 0;
  let bMn = alSum(B, 'blue', teamMinVal) || 0;
  let rSd = alStd(R, 'red') || 0;
  let bSd = alStd(B, 'blue') || 0;

  rPrim = isNaN(rPrim) || !isFinite(rPrim) ? 0 : rPrim;
  bPrim = isNaN(bPrim) || !isFinite(bPrim) ? 0 : bPrim;
  rAvg = isNaN(rAvg) || !isFinite(rAvg) ? 0 : rAvg;
  bAvg = isNaN(bAvg) || !isFinite(bAvg) ? 0 : bAvg;
  rMx = isNaN(rMx) || !isFinite(rMx) ? 0 : rMx;
  bMx = isNaN(bMx) || !isFinite(bMx) ? 0 : bMx;
  rMn = isNaN(rMn) || !isFinite(rMn) ? 0 : rMn;
  bMn = isNaN(bMn) || !isFinite(bMn) ? 0 : bMn;
  rSd = isNaN(rSd) || !isFinite(rSd) ? 0 : rSd;
  bSd = isNaN(bSd) || !isFinite(bSd) ? 0 : bSd;

  const dprMode = document.getElementById('dprMode')?.value || 'off';
  let rDprMulti = 1, bDprMulti = 1;
  let rDprPts = 0, bDprPts = 0;

  if (dprMode !== 'off') {
    const getBestDpr = alLabel => {
      let bM = 1, bP = 0, bR = 0;
      [0, 1, 2].forEach(i => {
        const v = document.getElementById(`${alLabel}${i}`)?.value;
        const t = v ? allTeams.find(x => x.teamNumber === parseInt(v)) : null;
        const isDef = !!predDef[`${alLabel}${i}`];
        if (t && isDef) {
          if (t.dprMulti !== null && t.dprMulti < bM) bM = t.dprMulti;
          if (t.dprPoints !== null && t.dprPoints > bP) bP = t.dprPoints;
          if (t.defenseEff !== null && t.defenseEff > bR) bR = t.defenseEff;
        }
      });
      return { multi: bM, pts: bP, rating: bR };
    };
    const rDpr = getBestDpr('red');
    const bDpr = getBestDpr('blue');
    bDprMulti = rDpr.multi;
    bDprPts = rDpr.pts;
    const rDprRating = rDpr.rating;
    rDprMulti = bDpr.multi;
    rDprPts = bDpr.pts;
    const bDprRating = bDpr.rating;

    if (dprMode === 'multi') {
      rPrim *= rDprMulti; bPrim *= bDprMulti;
      rAvg *= rDprMulti; bAvg *= bDprMulti;
      rMx *= rDprMulti; bMx *= bDprMulti;
      rMn *= rDprMulti; bMn *= bDprMulti;
    } else if (dprMode === 'points') {
      rPrim = Math.max(0, rPrim - rDprPts);
      bPrim = Math.max(0, bPrim - bDprPts);
      rAvg = Math.max(0, rAvg - rDprPts);
      bAvg = Math.max(0, bAvg - bDprPts);
      rMx = Math.max(0, rMx - rDprPts);
      bMx = Math.max(0, bMx - bDprPts);
      rMn = Math.max(0, rMn - rDprPts);
      bMn = Math.max(0, bMn - bDprPts);
    } else if (dprMode === 'rating') {
      const rRM = 1 - (rDprRating * 0.1);
      const bRM = 1 - (bDprRating * 0.1);
      rPrim *= rRM;
      bPrim *= bRM;
      rAvg *= rRM;
      bAvg *= bRM;
      rMx *= rRM;
      bMx *= bRM;
      rMn *= rRM;
      bMn *= bRM;
    }
  }

  let rWin = 50;
  let note = '';
  const hasDprTag = dprMode !== 'off' ? ` · DPR: ${dprMode}` : '';
  const hasDefTag = [...R, ...B].some(({ t, i }) => predDef[`red${i}`] || predDef[`blue${i}`]) ? ' · DEF 0.5x' : '';

  if (useMC && (R.length || B.length)) {
    const mkArr = (slots, alLabel) => slots.map(({ t, i }) => ({
      mean: primaryVal(t) * defMult(alLabel, i),
      std: (teamStdVal(t) || 3) * defMult(alLabel, i),
      skew: teamSkew(t),
      min: 0
    }));
    const rArr = mkArr(R, 'red');
    const bArr = mkArr(B, 'blue');
    let rW = 0, ties = 0;
    let rScores = [], bScores = [];
    const N = 15000;
    for (let j = 0; j < N; j++) {
      let rs = 0, bs = 0;
      for (let k = 0; k < rArr.length; k++) {
        const a = rArr[k];
        rs += Math.max(a.min, a.skew !== 0 ? skewSamp(a.mean, a.std, a.skew) : normSamp(a.mean, a.std));
      }
      for (let k = 0; k < bArr.length; k++) {
        const a = bArr[k];
        bs += Math.max(a.min, a.skew !== 0 ? skewSamp(a.mean, a.std, a.skew) : normSamp(a.mean, a.std));
      }
      if (dprMode === 'multi') { rs *= rDprMulti; bs *= bDprMulti; }
      else if (dprMode === 'points') { rs = Math.max(0, rs - rDprPts); bs = Math.max(0, bs - bDprPts); }
      if (rs > bs) rW++;
      else if (rs === bs) ties++;
      rScores.push(Math.round(rs));
      bScores.push(Math.round(bs));
    }
    lastMCRedScores = rScores;
    lastMCBlueScores = bScores;
    lastMCWinPct = Math.round((rW + ties * 0.5) / N * 100);
    rWin = lastMCWinPct;
    note = `MC ${(N / 1000).toFixed(0)}k (skew-adjusted) · ${predMode}${(tbaCorrectionMode !== 'none' && cal.ready) ? ' (Corr)' : ''} · Red σ≈${fmt(rSd, 1)} · Blue σ≈${fmt(bSd, 1)}${hasDprTag}${hasDefTag}`;
  } else {
    lastMCRedScores = [];
    lastMCBlueScores = [];
    lastMCWinPct = 50;
    if (rPrim + bPrim > 0) {
      rWin = Math.round(rPrim / (rPrim + bPrim) * 100) || 50;
      note = `${predMode} scores${(tbaCorrectionMode !== 'none' && cal.ready) ? ' (Corr)' : ''}${hasDprTag}${hasDefTag}`;
    }
  }

  const bWin = 100 - rWin;
  const corrTag = (tbaCorrectionMode !== 'none' && cal.ready) ? `<span class="corrtag" style="font-size:10px">corrected</span>` : '';
  const modeTag = `<span class="corrtag" style="font-size:10px;background:rgba(245,158,11,.15);color:var(--yel);border-color:rgba(245,158,11,.3)">${predMode}</span>`;

  document.getElementById('pRed').innerHTML = `${R.length ? Math.round(rPrim) : '?'} ${corrTag} ${modeTag}`;
  document.getElementById('pRedSub').textContent = R.length ? `${predMode === 'max' ? 'Max ~' + Math.round(rMx) : predMode === 'min' ? 'Min ~' + Math.round(rMn) : 'Avg ~' + Math.round(rAvg)} · σ≈${fmt(rSd, 1)}` : '';
  document.getElementById('pBlu').innerHTML = `${B.length ? Math.round(bPrim) : '?'} ${corrTag} ${modeTag}`;
  document.getElementById('pBluSub').textContent = B.length ? `${predMode === 'max' ? 'Max ~' + Math.round(bMx) : predMode === 'min' ? 'Min ~' + Math.round(bMn) : 'Avg ~' + Math.round(bAvg)} · σ≈${fmt(bSd, 1)}` : '';
  document.getElementById('rWin').textContent = `${rWin}%`;
  document.getElementById('bWin').textContent = `${bWin}%`;
  document.getElementById('wbR').style.width = rWin + '%';
  document.getElementById('wbB').style.width = bWin + '%';
  document.getElementById('mcNote').textContent = note;
  document.getElementById('predHdr').textContent = R.length && B.length ? (rWin > bWin ? `Red favored — ${rWin}%` : `Blue favored — ${bWin}%`) : 'Select teams';

  const tRows = (ts, alLabel) => ts.map(({ t, i }) => {
    const isDef = !!predDef[`${alLabel}${i}`];
    const hasDpr = isDef && t.dprMulti !== null && t.dprMulti < 1;
    const tint = hasDpr ? 'background:rgba(239,68,68,0.08); border-color:rgba(239,68,68,0.2)' : '';
    const defStyle = isDef ? 'outline:2px solid rgba(239,68,68,0.5); outline-offset:-2px;' : '';
    const pv = primaryVal(t);
    const effPv = isDef ? pv * DEF_SCORE_MULT : pv;
    return `<div class="ptr" style="cursor:pointer;${tint}${defStyle}" onclick="togglePredDef('${alLabel}', ${i})" title="Click to toggle defender">
      <strong style="color:var(--acc)">${t.teamNumber}</strong>
      <span style="flex:1;font-size:10px;color:var(--dim)">${t.teamName.slice(0, 14)}</span>
      <span style="font-size:11px;color:var(--dim);font-variant-numeric:tabular-nums">${isDef ? `<span style="text-decoration:line-through;opacity:.5">${Math.round(pv)}</span> <span style="color:var(--yel)">${Math.round(effPv)}</span>` : Math.round(pv)}${predMode !== 'avg' ? `<span style="color:var(--yel);font-size:10px"> (${predMode})</span>` : ''}</span>
      ${rt(t.topRole)}
      ${isDef ? `<span style="font-size:9px;font-weight:700;margin-left:4px;padding:1px 5px;border-radius:3px;${hasDpr ? 'color:rgba(239,68,68,0.9);background:rgba(239,68,68,0.12)' : 'color:var(--mut);background:var(--surf3)'}">DEF 0.5x${hasDpr ? ' | DPR ' + t.dprMulti.toFixed(2) + 'x' : ''}</span>` : `<span style="font-size:9px;color:var(--mut);margin-left:4px;opacity:.5">click = def</span>`}
    </div>`;
  }).join('');

  document.getElementById('predBk').innerHTML = `
    <div><div style="font-size:9px;font-weight:700;color:#f87171;text-transform:uppercase;margin-bottom:4px">Red</div>${tRows(R, 'red') || '—'}</div>
    <div><div style="font-size:9px;font-weight:700;color:#60a5fa;text-transform:uppercase;margin-bottom:4px">Blue</div>${tRows(B, 'blue') || '—'}</div>`;

  ['red', 'blue'].forEach(al => [0, 1, 2].forEach(idx => {
    const el = document.getElementById(`${al}${idx}`);
    if (!el) return;
    const slot = (al === 'red' ? R : B).find(s => s.i === idx);
    const isDef = !!predDef[`${al}${idx}`];
    if (slot && isDef && slot.t.dprMulti !== null && slot.t.dprMulti < 1) {
      el.style.backgroundColor = 'rgba(239,68,68,0.1)';
      el.style.borderColor = 'rgba(239,68,68,0.3)';
    } else {
      el.style.backgroundColor = '';
      el.style.borderColor = '';
    }
  }));

  if (useMC && (R.length || B.length)) {
    setTimeout(() => renderMCVisualizations(), 50);
  }
}

function renderMCVisualizations() {
  const mcVizEl = document.getElementById('mcVisualizations');
  if (!mcVizEl) return;
  mcVizEl.style.display = useMC ? 'block' : 'none';

  const mcHChart = document.getElementById('mcHistogramCanvas');
  if (mcHChart) renderMCHistogram();

  const mcGauge = document.getElementById('mcWinGaugeCanvas');
  if (mcGauge) renderMCWinGauge();
}

function renderMCHistogram() {
  if (!useMC) return;
  const canvas = document.getElementById('mcHistogramCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (chartInsts['mcHistogram']) chartInsts['mcHistogram'].destroy();

  const redScores = lastMCRedScores.slice();
  const blueScores = lastMCBlueScores.slice();

  if (!redScores.length || !blueScores.length) return;

  const binSize = 10;
  const maxScore = Math.max(...redScores, ...blueScores);
  const numBins = Math.ceil(maxScore / binSize);
  const rHist = Array(numBins).fill(0);
  const bHist = Array(numBins).fill(0);
  const labels = [];

  for (let i = 0; i < numBins; i++) {
    labels.push(`${i * binSize}-${(i + 1) * binSize}`);
  }

  redScores.forEach(s => { const bin = Math.min(Math.floor(s / binSize), numBins - 1); rHist[bin]++; });
  blueScores.forEach(s => { const bin = Math.min(Math.floor(s / binSize), numBins - 1); bHist[bin]++; });

  const N = redScores.length;
  const rMean = redScores.reduce((a, b) => a + b, 0) / N;
  const bMean = blueScores.reduce((a, b) => a + b, 0) / N;
  const rStd = Math.sqrt(redScores.reduce((s, v) => s + (v - rMean) ** 2, 0) / N);
  const bStd = Math.sqrt(blueScores.reduce((s, v) => s + (v - bMean) ** 2, 0) / N);

  chartInsts['mcHistogram'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        { label: 'Red', data: rHist, backgroundColor: 'rgba(239,68,68,0.6)', borderColor: '#f87171', borderWidth: 1 },
        { label: 'Blue', data: bHist, backgroundColor: 'rgba(59,130,246,0.6)', borderColor: '#60a5fa', borderWidth: 1 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 10 } } },
        tooltip: {
          callbacks: {
            afterLabel: (context) => {
              const bin = context.dataIndex;
              return `Range: ${bin * binSize}-${(bin + 1) * binSize} pts`;
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(30,58,95,.3)' } },
        y: { ticks: { color: '#64748b', font: { size: 9 } }, grid: { color: 'rgba(30,58,95,.3)' }, title: { display: true, text: 'Frequency', color: '#64748b' } }
      }
    }
  });

  const statsEl = document.getElementById('mcHistogramStats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
        <div style="background:rgba(239,68,68,0.1);padding:8px;border-radius:6px;border-left:3px solid #f87171">
          <div style="font-size:10px;color:var(--mut);margin-bottom:2px">Red Distribution</div>
          <div style="font-size:12px;font-weight:700;color:#f87171">μ=${Math.round(rMean)} pts</div>
          <div style="font-size:9px;color:var(--dim)">σ=${Math.round(rStd*10)/10} | 68%: ${Math.round(rMean - rStd)}-${Math.round(rMean + rStd)}</div>
        </div>
        <div style="background:rgba(59,130,246,0.1);padding:8px;border-radius:6px;border-left:3px solid #60a5fa">
          <div style="font-size:10px;color:var(--mut);margin-bottom:2px">Blue Distribution</div>
          <div style="font-size:12px;font-weight:700;color:#60a5fa">μ=${Math.round(bMean)} pts</div>
          <div style="font-size:9px;color:var(--dim)">σ=${Math.round(bStd*10)/10} | 68%: ${Math.round(bMean - bStd)}-${Math.round(bMean + bStd)}</div>
        </div>
      </div>
    `;
  }
}

function renderMCWinGauge() {
  if (!useMC) return;
  const canvas = document.getElementById('mcWinGaugeCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const R = getSlots('red');
  const B = getSlots('blue');
  if (!R.length || !B.length) return;

  const w = canvas.width;
  const h = canvas.height;
  const centerX = w / 2;
  const centerY = h / 2;
  const radius = Math.min(w, h) / 2 - 20;

  ctx.clearRect(0, 0, w, h);
  ctx.save();

  const winPct = lastMCWinPct;
  const blueWinPct = 100 - winPct;
  const redAngle = (winPct / 100) * Math.PI * 2;

  ctx.fillStyle = '#f87171';
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, radius, 0, redAngle);
  ctx.lineTo(centerX, centerY);
  ctx.fill();

  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.arc(centerX, centerY, radius, redAngle, Math.PI * 2);
  ctx.lineTo(centerX, centerY);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#07101e';
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#f87171';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(winPct + '%', centerX, centerY - 5);

  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  ctx.fillText('Red Win', centerX, centerY + 12);

  ctx.restore();
}
