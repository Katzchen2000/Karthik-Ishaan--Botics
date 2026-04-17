// Predictor page and Monte Carlo estimation
function toggleMC() { useMC = !useMC; document.getElementById('mcTog')?.classList.toggle('on', useMC); runPred(); }
function togglePredCorr() { predCorr = !predCorr; document.getElementById('corrTog')?.classList.toggle('on', predCorr); runPred(); }
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
function teamAvgVal(t) { return predCorr && cal.ready ? (tCorr(t) || 0) : (t.totalAvg || 0); }
function teamMaxVal(t) { return predCorr && cal.ready ? (corrected(t.totalMax, t.teamNumber) || 0) : (t.totalMax || 0); }
function teamMinVal(t) { return predCorr && cal.ready ? (corrected(t.totalMin, t.teamNumber) || 0) : (t.totalMin || 0); }
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

  let rPrim = alSum(R, 'red', primaryVal);
  let bPrim = alSum(B, 'blue', primaryVal);
  let rAvg = alSum(R, 'red', teamAvgVal);
  let bAvg = alSum(B, 'blue', teamAvgVal);
  let rMx = alSum(R, 'red', teamMaxVal);
  let bMx = alSum(B, 'blue', teamMaxVal);
  let rMn = alSum(R, 'red', teamMinVal);
  let bMn = alSum(B, 'blue', teamMinVal);
  let rSd = alStd(R, 'red');
  let bSd = alStd(B, 'blue');

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
    }
    rWin = Math.round((rW + ties * 0.5) / N * 100);
    note = `MC ${(N / 1000).toFixed(0)}k (skew-adjusted) · ${predMode}${predCorr ? ' (Corr)' : ''} · Red σ≈${fmt(rSd, 1)} · Blue σ≈${fmt(bSd, 1)}${hasDprTag}${hasDefTag}`;
  } else if (rPrim + bPrim > 0) {
    rWin = Math.round(rPrim / (rPrim + bPrim) * 100) || 50;
    note = `${predMode} scores${predCorr ? ' (Corr)' : ''}${hasDprTag}${hasDefTag}`;
  }

  const bWin = 100 - rWin;
  const corrTag = predCorr && cal.ready ? `<span class="corrtag" style="font-size:10px">corrected</span>` : '';
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
}
