// Picklist and alliance board management

function getComponentCorrected(t, component) {
  if (!t || component === 'climbRate') return null;
  const raw = t[component] ?? null;
  return cal.ready ? corrected(raw, t.teamNumber) : raw;
}

function pickedTeams() {
  return alliances.flat().filter(t => t !== null);
}

function buildPresets() {
  const sel = document.getElementById('presetSel');
  if (!sel) return;
  const opts = ['<option value="">— Load preset —</option>'];
  if (tbaData) {
    opts.push('<optgroup label="Qual Matches (TBA)">');
    tbaData.matches.forEach(m => {
      const r = m.alliances.red.team_keys.map(k => parseInt(k.replace('frc', '')));
      const b = m.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', '')));
      opts.push(`<option value="match-${m.match_number}">Q${m.match_number}: Red [${r.join(',')}] vs Blue [${b.join(',')}]</option>`);
    });
    opts.push('</optgroup>');
  }
  opts.push('<optgroup label="Auto-fill"><option value="pl-fill">Fill alliances from ranked remaining teams</option></optgroup>');
  sel.innerHTML = opts.join('');
}

function applyPreset() {
  const v = document.getElementById('presetSel')?.value;
  if (!v) return;
  if (v.startsWith('match-') && tbaData) {
    const mn_ = parseInt(v.replace('match-', ''));
    const m = tbaData.matches.find(x => x.match_number === mn_);
    if (!m) return;
    const r = m.alliances.red.team_keys.map(k => parseInt(k.replace('frc', '')));
    const b = m.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', '')));
    [0, 1, 2].forEach(i => { alliances[0][i] = r[i] || null; alliances[1][i] = b[i] || null; });
  } else if (v === 'pl-fill') {
    const picked = pickedTeams();
    const rem = [...allTeams].filter(t => !picked.includes(t.teamNumber)).sort((a, b) => teamAvgVal(b) - teamAvgVal(a)).map(t => t.teamNumber);
    let ri = 0;
    for (let ai = 0; ai < 8 && ri < rem.length; ai++) {
      for (let si = 0; si < 3 && ri < rem.length; si++) {
        if (!alliances[ai][si]) alliances[ai][si] = rem[ri++];
      }
    }
  }
  renderAlBoard();
  renderDL();
}

function clearAlliances() {
  alliances = Array.from({ length: 8 }, () => [null, null, null]);
  renderAlBoard();
  renderDL();
}

function exportPicklist() {
  const data = { plOrder, plNotes, alliances };
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'picklist.json';
  a.click();
}

function importPicklist(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (evt) {
    try {
      const data = JSON.parse(evt.target.result);
      if (data.plOrder) plOrder = data.plOrder;
      if (data.plNotes) plNotes = data.plNotes;
      if (data.alliances) alliances = data.alliances;
      renderAlBoard();
      renderDL();
    } catch (err) {
      alert('Invalid JSON');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function renderPicklist() {
  const sel = t => `<option value="${t.teamNumber}">${t.teamNumber} — ${t.teamName}</option>`;
  const e = '<option value="">— Select —</option>';
  document.getElementById('cmpA').innerHTML = e + allTeams.map(sel).join('');
  document.getElementById('cmpB').innerHTML = e + allTeams.map(sel).join('');
  buildPresets();
  renderAlBoard();
  renderDL();
}

function renderAlBoard() {
  const picked = pickedTeams();
  const nums = ['an1', 'an2', 'an3', 'an4', 'an5', 'an6', 'an7', 'an8'];
  document.getElementById('alBoard').innerHTML = alliances.map((slots, ai) => {
    const tot = slots.reduce((s, tn) => { const t = tn ? allTeams.find(x => x.teamNumber === tn) : null; return s + (t ? teamAvgVal(t) : 0); }, 0);
    const has = slots.some(t => t !== null);
    const opts = tn => `<option value="">— None —</option>${allTeams.map(t => { const usedElse = picked.includes(t.teamNumber) && t.teamNumber !== tn; return `<option value="${t.teamNumber}"${t.teamNumber === tn ? ' selected' : ''}${usedElse ? ' disabled' : ''}>${t.teamNumber} ${t.teamName.slice(0, 12)}</option>`; }).join('')}`;
    return `<div class="alcard"><div class="alcardh"><span class="alnum ${nums[ai]}">A${ai + 1}</span><span style="font-size:11px;font-weight:600;color:var(--dim)">Alliance ${ai + 1}</span>${has ? `<span style="margin-left:auto;font-size:10px;color:var(--mut)">~${Math.round(tot)}</span>` : ''}</div>
      ${slots.map((tn, si) => { const t = tn ? allTeams.find(x => x.teamNumber === tn) : null; const sv = t ? teamAvgVal(t) : null; const label = si === 0 ? 'Capt' : si === 1 ? '1st' : '2nd'; return `<div class="alslot"><span style="font-size:9px;color:var(--mut);min-width:28px">${label}</span><select onchange="setAlSlot(${ai},${si},this.value)">${opts(tn)}</select><span class="alscore${cal.ready ? ' corrval' : ''}">${sv !== null ? fmt(sv) : '—'}</span></div>`; }).join('')}
      ${has ? `<div class="altotal"><span style="color:var(--mut)">Total${cal.ready ? ' (corr)' : ''}</span><span style="font-weight:700;color:var(--acc);font-size:13px">${Math.round(tot)}</span></div>` : ''}
    </div>`;
  }).join('');
}

function setAlSlot(ai, si, val) {
  const tn = val ? parseInt(val) : null;
  alliances.forEach((slots, a) => slots.forEach((t, s) => { if (t === tn && !(a === ai && s === si)) alliances[a][s] = null; }));
  alliances[ai][si] = tn;
  renderAlBoard();
  renderDL();
  buildPredPresets();
}

function renderDL() {
  const picked = pickedTeams();
  const remaining = plOrder.filter(tn => !picked.includes(tn));
  document.getElementById('plCount').textContent = remaining.length;
  const cb = document.getElementById('plChartBadge');
  if (cb) cb.textContent = remaining.length;
  if (!remaining.length) {
    document.getElementById('dragList').innerHTML = `<li style="text-align:center;padding:16px;color:var(--mut);font-size:12px">All teams drafted</li>`;
    if (plChartsOpen) renderPlChartTab(activePlTab);
    return;
  }
  document.getElementById('dragList').innerHTML = remaining.map((tn, i) => {
    const t = allTeams.find(x => x.teamNumber === tn);
    if (!t) return '';
    const note = plNotes[tn] || '';
    return `<li class="drag-item" draggable="true" id="pl-${tn}" ondragstart="dS(event,${tn})" ondragover="dO(event,${tn})" ondrop="dD(event,${tn})" ondragleave="dL(event)">
      <span class="dhandle">⠿</span><span class="drank">${i + 1}</span><span class="dtn">${tn}</span>
      <span class="dnm">${t.teamName}</span>
      <span class="davg${cal.ready ? ' corrval' : ''}">${fmt(teamAvgVal(t))}</span>
      ${rt(t.topRole)}${rp(t.drivingProf)}
      ${t.dprMulti !== null && t.dprMulti < 1 ? `<span style="font-size:10px;font-weight:700;color:rgba(239,68,68,0.8);background:rgba(239,68,68,0.1);padding:2px 4px;border-radius:4px;white-space:nowrap;margin-left:4px;">DPR ${t.dprMulti.toFixed(2)}x</span>` : ''}
      <div style="display:flex;gap:3px"><button class="dbtn${note ? ' on' : ''}" onclick="event.stopPropagation();toggleNote(${tn})" style="width:auto;padding:0 4px">Note</button></div>
      <textarea class="noteinp${note ? ' vis' : ''}" id="ni-${tn}" placeholder="Scout note…" rows="1" oninput="plNotes[${tn}]=this.value">${note}</textarea>
    </li>`;
  }).join('');
  if (plChartsOpen) renderPlChartTab(activePlTab);
}

function togglePlCharts() {
  plChartsOpen = !plChartsOpen;
  document.getElementById('plChartsBody').classList.toggle('on', plChartsOpen);
  document.getElementById('plChartsArr').textContent = plChartsOpen ? '▼' : '▶';
  if (plChartsOpen) setTimeout(() => renderPlChartTab(activePlTab), 50);
}

function setPlTab(tab) {
  activePlTab = tab;
  ['bubble', 'opr', 'rank'].forEach(t => { document.getElementById('pcp-' + t).style.display = t === tab ? 'block' : 'none'; document.getElementById('pct-' + t)?.classList.toggle('on', t === tab); });
  renderPlChartTab(tab);
}

function renderPlChartTab(tab) { if (tab === 'bubble') renderPlBubble(); else if (tab === 'opr') renderPlOPR(); else if (tab === 'rank') renderPlRank(); }

let plDrag = null;
function dS(e, tn) {
  plDrag = tn;
  document.getElementById('pl-' + tn)?.classList.add('dragging');
}

function dO(e, tn) {
  e.preventDefault();
  if (tn !== plDrag) document.getElementById('pl-' + tn)?.classList.add('dov');
}

function dL(e) {
  e.currentTarget.classList.remove('dov');
}

function dD(e, tn) {
  e.preventDefault();
  document.querySelectorAll('.drag-item').forEach(el => el.classList.remove('dov', 'dragging'));
  if (plDrag === tn) return;
  const picked = pickedTeams();
  const rem = plOrder.filter(t => !picked.includes(t));
  const f = rem.indexOf(plDrag);
  const to = rem.indexOf(tn);
  if (f < 0 || to < 0) return;
  rem.splice(f, 1);
  rem.splice(to, 0, plDrag);
  plOrder = [...picked, ...rem.filter(t => !picked.includes(t))];
  renderDL();
  plDrag = null;
}

function toggleNote(tn) {
  document.getElementById('ni-' + tn)?.classList.toggle('vis');
}

function autoRank() {
  const picked = pickedTeams();
  const free = [...allTeams].filter(t => !picked.includes(t.teamNumber)).sort((a, b) => teamAvgVal(b) - teamAvgVal(a)).map(t => t.teamNumber);
  plOrder = [...picked, ...free];
  renderDL();
}

function renderCmp() {
  const ta = allTeams.find(t => t.teamNumber === parseInt(document.getElementById('cmpA')?.value));
  const tb = allTeams.find(t => t.teamNumber === parseInt(document.getElementById('cmpB')?.value));
  const el = document.getElementById('cmpOut');
  if (!ta && !tb) { if (el) el.innerHTML = ''; return; }
  const row = (lbl, va, vb, hi = true) => {
    const na = va === null || va === undefined || isNaN(va);
    const nb = vb === null || vb === undefined || isNaN(vb);
    const aw = !na && !nb && (hi ? va > vb : va < vb);
    const bw = !na && !nb && (hi ? vb > va : vb < va);
    return `<tr><td>${lbl}</td><td style="${aw ? 'color:var(--grn)' : ''}">${na ? '—' : fmt(va)}</td><td style="${bw ? 'color:var(--grn)' : ''}">${nb ? '—' : fmt(vb)}</td></tr>`;
  };
  if (!el) return;
  el.innerHTML = `<table class="cmptbl"><thead><tr><th>Stat</th><th style="text-align:center">${ta ? ta.teamNumber : '—'}</th><th style="text-align:center">${tb ? tb.teamNumber : '—'}</th></tr></thead><tbody>
    ${row('Total Avg', ta?.totalAvg, tb?.totalAvg)}
    ${cal.ready ? row('Corrected Avg', ta ? tCorr(ta) : null, tb ? tCorr(tb) : null) : ''}
    ${row('Total Max', ta?.totalMax, tb?.totalMax)}
    ${row('Std Dev σ', ta?.totalStd, tb?.totalStd, false)}
    ${row('Auto Avg (Corr)', ta ? getComponentCorrected(ta, 'autoAvg') : null, tb ? getComponentCorrected(tb, 'autoAvg') : null)}
    ${row('Teleop Avg (Corr)', ta ? getComponentCorrected(ta, 'teleopAvg') : null, tb ? getComponentCorrected(tb, 'teleopAvg') : null)}
    ${row('Endgame Avg (Corr)', ta ? getComponentCorrected(ta, 'endgameAvg') : null, tb ? getComponentCorrected(tb, 'endgameAvg') : null)}
    ${row('Climb %', ta?.climbRate != null ? ta.climbRate * 100 : null, tb?.climbRate != null ? tb.climbRate * 100 : null)}
    ${row('Matches', ta?.validCount, tb?.validCount)}
    <tr><td>Role</td><td style="text-align:center">${ta ? rt(ta.topRole) || '—' : '—'}</td><td style="text-align:center">${tb ? rt(tb.topRole) || '—' : '—'}</td></tr>
    <tr><td>Driving</td><td style="text-align:center">${ta ? rp(ta.drivingProf) : '—'}</td><td style="text-align:center">${tb ? rp(tb.drivingProf) : '—'}</td></tr>
  </tbody></table>`;
}
