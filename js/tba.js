// TBA integration and calibration
function openTBAModal() { document.getElementById('tbaModal')?.classList.add('on'); }
function closeTBAModal() { document.getElementById('tbaModal')?.classList.remove('on'); }

async function connectTBA() {
  const k = document.getElementById('tbaKey').value.trim();
  const e = document.getElementById('tbaEvt').value.trim();
  const err = document.getElementById('tbaErr');
  if (err) err.style.display = 'none';
  if (!k || !e) {
    if (err) { err.textContent = 'Fill both fields.'; err.style.display = 'block'; }
    return;
  }
  try {
    const r = await fetch(`https://www.thebluealliance.com/api/v3/event/${e}/matches/simple`, { headers: { 'X-TBA-Auth-Key': k } });
    if (!r.ok) { if (err) { err.textContent = `TBA error: ${r.status}`; err.style.display = 'block'; } return; }
    const data = await r.json();
    tbaKey = k;
    tbaEvt = e;
    tbaData = { matches: data.filter(m => m.comp_level === 'qm').sort((a, b) => a.match_number - b.match_number) };
    computeCalibration();
    fetchRankings();
    document.getElementById('tbaBtn')?.classList.add('ok');
    if (document.getElementById('tbaBtn')) document.getElementById('tbaBtn').textContent = 'TBA: Connected';
    closeTBAModal();
  } catch (ex) {
    if (err) { err.textContent = 'Error: ' + ex.message; err.style.display = 'block'; }
  }
}

function computeCalibration() {
  if (!tbaData || !allTeams.length) {
    cal = { scalar: 1, teamScalars: {}, r2: null, rmse: null, n: 0, pts: [], ready: false };
    return;
  }
  const apts = [];
  const tpts = {};

  tbaData.matches.forEach(m => {
    if (!m.alliances.red.score || m.alliances.red.score < 0) return;
    const mn_ = m.match_number;
    [{ tns: m.alliances.red.team_keys.map(k => parseInt(k.replace('frc', ''))), score: m.alliances.red.score, al: 'red' },
     { tns: m.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', ''))), score: m.alliances.blue.score, al: 'blue' }].forEach(({ tns, score, al }) => {
      const rows = tns.map(tn => { const t = allTeams.find(x => x.teamNumber === tn); return t ? t.history.find(h => h.match === mn_) : null; });
      if (rows.some(r => !r) || score <= 0) return;
      const sumS = rows.reduce((s, r) => s + r.total, 0);
      apts.push({ scouted: sumS, tba: score, match: mn_, alliance: al });
      rows.forEach((row, i) => {
        const tn = tns[i];
        if (!tpts[tn]) tpts[tn] = [];
        const frac = sumS > 0 ? row.total / sumS : 1 / 3;
        tpts[tn].push({ scoutedVal: row.total, tbaShare: frac * score, match: mn_ });
      });
    });
  });

  let globalScalar = 1;
  let r2 = null;
  let rmse = null;
  if (apts.length) {
    const ns = apts.reduce((s, p) => s + p.scouted * p.tba, 0);
    const ds = apts.reduce((s, p) => s + p.scouted * p.scouted, 0);
    globalScalar = ds > 0 ? ns / ds : 1;
    const tbamn = apts.reduce((s, p) => s + p.tba, 0) / apts.length;
    const ssTot = apts.reduce((s, p) => s + (p.tba - tbamn) ** 2, 0);
    const ssRes = apts.reduce((s, p) => s + (p.tba - globalScalar * p.scouted) ** 2, 0);
    r2 = ssTot > 0 ? 1 - ssRes / ssTot : null;
    rmse = Math.sqrt(ssRes / apts.length);
  }

  const teamScalars = {};
  allTeams.forEach(t => {
    const pts = tpts[t.teamNumber] || [];
    const valid = pts.filter(p => p.scoutedVal > 0);
    if (!valid.length) {
      teamScalars[t.teamNumber] = { scalar: globalScalar, n: 0, r2: null, rmse: null, fallback: true };
      return;
    }
    const ns = valid.reduce((s, p) => s + p.scoutedVal * p.tbaShare, 0);
    const ds = valid.reduce((s, p) => s + p.scoutedVal * p.scoutedVal, 0);
    const sc = ds > 0 ? ns / ds : globalScalar;
    const mn2 = valid.reduce((s, p) => s + p.tbaShare, 0) / valid.length;
    const ssTot = valid.reduce((s, p) => s + (p.tbaShare - mn2) ** 2, 0);
    const ssRes = valid.reduce((s, p) => s + (p.tbaShare - sc * p.scoutedVal) ** 2, 0);
    teamScalars[t.teamNumber] = { scalar: sc, n: valid.length, r2: ssTot > 0 ? 1 - ssRes / ssTot : null, rmse: Math.sqrt(ssRes / valid.length), fallback: false };
  });

  cal = { scalar: globalScalar, teamScalars, r2, rmse, n: apts.length, pts: apts, ready: true };

  allTeams.forEach(t => t.dprMatches = []);
  const getRolesForMatch = (t, mn) => { const mh = t.history.find(x => x.match === mn); return mh ? mh.roles : []; };
  const getCorrTotal = tn => { const t = allTeams.find(x => x.teamNumber === tn); return t ? ((t.totalAvg || 0) * (cal.teamScalars[tn] ? cal.teamScalars[tn].scalar : cal.scalar)) : 0; };

  tbaData.matches.forEach(m => {
    if (!m.alliances.red.score || m.alliances.red.score < 0) return;
    const rTns = m.alliances.red.team_keys.map(k => parseInt(k.replace('frc', '')));
    const bTns = m.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', '')));
    const rScouted = rTns.reduce((s, tn) => s + getCorrTotal(tn), 0);
    const bScouted = bTns.reduce((s, tn) => s + getCorrTotal(tn), 0);

    rTns.forEach(tn => {
      const t = allTeams.find(x => x.teamNumber === tn);
      if (t && getRolesForMatch(t, m.match_number).includes('Defender')) {
        t.dprMatches.push({ expected: bScouted, actual: m.alliances.blue.score });
      }
    });
    bTns.forEach(tn => {
      const t = allTeams.find(x => x.teamNumber === tn);
      if (t && getRolesForMatch(t, m.match_number).includes('Defender')) {
        t.dprMatches.push({ expected: rScouted, actual: m.alliances.red.score });
      }
    });
  });

  allTeams.forEach(t => {
    if (t.dprMatches && t.dprMatches.length) {
      t.dprPoints = avg(t.dprMatches.map(m => m.expected - m.actual));
      t.dprMulti = avg(t.dprMatches.map(m => m.expected > 0 ? m.actual / m.expected : 1));
    } else {
      t.dprPoints = null;
      t.dprMulti = null;
    }
  });
}

async function fetchRankings() {
  if (!tbaKey || !tbaEvt) {
    document.getElementById('rkNoTBA').style.display = 'block';
    document.getElementById('rkContent').style.display = 'none';
    return;
  }
  try {
    const r = await fetch(`https://www.thebluealliance.com/api/v3/event/${tbaEvt}/rankings`, { headers: { 'X-TBA-Auth-Key': tbaKey } });
    if (!r.ok) return;
    const data = await r.json();
    tbaRankData = data;
    renderRankingsTable();
  } catch (e) {
    console.error(e);
  }
}

function renderRankings() {
  if (!tbaKey || !tbaEvt) {
    document.getElementById('rkNoTBA').style.display = 'block';
    document.getElementById('rkContent').style.display = 'none';
    return;
  }
  document.getElementById('rkNoTBA').style.display = 'none';
  document.getElementById('rkContent').style.display = 'block';
  if (!tbaRankData) fetchRankings();
  else renderRankingsTable();
}

function rkSort(key) {
  if (rkSortKey === key) rkSortDir *= -1;
  else { rkSortKey = key; rkSortDir = 1; }
  renderRankingsTable();
}

function renderRankingsTable() {
  if (!tbaRankData?.rankings) return;
  const rankings = tbaRankData.rankings;
  document.getElementById('rkBadge').textContent = `${rankings.length} teams`;
  const sortedByScout = [...allTeams].filter(t => t.totalAvg !== null).sort((a, b) => (b.totalAvg || 0) - (a.totalAvg || 0));
  const scoutRankMap = {};
  sortedByScout.forEach((t, i) => scoutRankMap[t.teamNumber] = i + 1);

  let rows = rankings.map(r => {
    const tn = parseInt(r.team_key.replace('frc', ''));
    const t = allTeams.find(x => x.teamNumber === tn);
    const wlt = r.record || { wins: 0, losses: 0, ties: 0 };
    return {
      rank: r.rank,
      tn,
      teamName: t?.teamName || r.team_key,
      wins: wlt.wins,
      losses: wlt.losses,
      ties: wlt.ties,
      rp: r.sort_orders?.[0] ?? r.extra_stats?.[0] ?? null,
      matches: r.matches_played,
      scoutAvg: t?.totalAvg ?? null,
      corrAvg: t && cal.ready ? tCorr(t) : null,
      scoutRank: scoutRankMap[tn] ?? null,
    };
  });

  rows.sort((a, b) => {
    let av = a[rkSortKey], bv = b[rkSortKey];
    if (av == null) av = rkSortDir > 0 ? 1e9 : -1e9;
    if (bv == null) bv = rkSortDir > 0 ? 1e9 : -1e9;
    return (av - bv) * rkSortDir;
  });

  document.getElementById('rkBody').innerHTML = rows.map(r => {
    const rankDiff = r.scoutRank !== null && r.rank !== null ? r.rank - r.scoutRank : null;
    const diffHtml = rankDiff !== null
      ? `<span style="font-size:11px;color:${rankDiff < 0 ? 'var(--red)' : rankDiff > 0 ? 'var(--grn)' : 'var(--mut)'}">${rankDiff < 0 ? '-' + Math.abs(rankDiff) : rankDiff > 0 ? '+' + rankDiff : '='}</span>`
      : '—';
    return `<tr class="cl" onclick="jumpTeam(${r.tn})">
      <td><strong style="font-size:15px;color:var(--acc)">#${r.rank}</strong></td>
      <td class="tnum">${r.tn}</td>
      <td style="font-weight:500">${r.teamName}</td>
      <td class="sv hi">${r.wins}</td>
      <td class="sv lo">${r.losses}</td>
      <td style="color:var(--mut)">${r.ties}</td>
      <td class="sv md">${r.rp !== null ? r.rp.toFixed(2) : '—'}</td>
      <td><span class="badge">${r.matches}</span></td>
      <td class="sv ${sc(r.scoutAvg, 60, 25)}">${fmt(r.scoutAvg)}</td>
      <td class="sv corrval">${r.corrAvg !== null ? fmt(r.corrAvg) : '—'}</td>
      <td style="display:flex;align-items:center;gap:5px"><span style="font-size:13px;font-weight:700;color:var(--dim)">#${r.scoutRank ?? '—'}</span> ${diffHtml}</td>
    </tr>`;
  }).join('');
}
