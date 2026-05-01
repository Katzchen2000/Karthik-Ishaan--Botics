// Data transformation and shared utilities
const RATS = ['Bad', 'Decent', 'Good', 'VeryGood'];
const RAT_VALS = { Bad: 0, Decent: 1, Good: 2, VeryGood: 3 };

const num = v => { const n = parseFloat(v); return isNaN(n) ? null : n; };
const isNA = v => !v || ['NA', 'DNA', '', 'NaN', 'N/A', 'na', 'low'].includes(String(v).trim().toLowerCase());
const avg = a => a.length ? a.reduce((s, v) => s + v, 0) / a.length : null;
const mn = a => a.length ? Math.min(...a) : null;
const mx = a => a.length ? Math.max(...a) : null;
const std = a => { if (a.length < 2) return 0; const m = avg(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
const cleanR = v => { if (!v || isNA(v)) return null; const s = String(v).trim(); return RATS.find(r => r.toLowerCase() === s.toLowerCase()) || null; };
const isNS = r => Object.values(r).some(v => String(v).toLowerCase().includes('noshow'));

function getRoles(row) {
  const known = ['Cycler', 'Scorer', 'Feeder', 'Defender', 'Lobber'];
  const roles = [];
  ['allianceScoutShift1Roles', 'allianceScoutShift2Roles', 'allianceScoutShift3Roles', 'allianceScoutShift4Roles'].forEach(c => {
    const v = row[c];
    if (!v || isNA(v)) return;
    let hit = false;
    known.forEach(r => {
      if (v.includes(r)) { roles.push(r); hit = true; }
    });
    if (!hit) roles.push(v.trim());
  });
  return roles;
}

function buildAllTeams(rows) {
  const by = {};
  rows.forEach(r => {
    const tn = r.teamNumber;
    if (!tn || isNaN(parseInt(tn))) return;
    if (!by[tn]) by[tn] = { teamNumber: parseInt(tn), teamName: r.teamName || String(tn), matches: [] };
    by[tn].matches.push(r);
  });
  return Object.values(by).map(computeStats);
}

// Auto-detect the score_breakdown field names for autonomous points
// Returns an ARRAY of field names to sum (handles years where auto is split across multiple fields)
let _autoPointsFields = null;

function detectAutoPointsFields() {
  if (_autoPointsFields) return _autoPointsFields;
  if (!tbaData || !tbaData.matches) return null;
  
  for (const m of tbaData.matches) {
    if (!m.score_breakdown || !m.score_breakdown.red) continue;
    const keys = Object.keys(m.score_breakdown.red);
    // Find all keys containing "auto" and "point" (case insensitive)
    const candidates = keys.filter(k => k.toLowerCase().includes('auto') && k.toLowerCase().includes('point'));
    
    if (!candidates.length) continue;
    
    // If there's a single total field like 'autoPoints' or 'autoTotalPoints', use just that
    if (candidates.includes('autoPoints')) {
      _autoPointsFields = ['autoPoints'];
    } else if (candidates.includes('autoTotalPoints')) {
      _autoPointsFields = ['autoTotalPoints'];
    } else {
      // No pre-computed total — sum ALL auto point fields
      _autoPointsFields = candidates;
    }
    
    // Log what we found
    const sampleRed = _autoPointsFields.reduce((s, f) => s + (m.score_breakdown.red[f] || 0), 0);
    const sampleBlue = _autoPointsFields.reduce((s, f) => s + (m.score_breakdown.blue[f] || 0), 0);
    console.log('[Auton Filter] Using fields:', _autoPointsFields, '| Sample red total:', sampleRed, '| Sample blue total:', sampleBlue);
    return _autoPointsFields;
  }
  
  console.warn('[Auton Filter] No auto point fields found in score_breakdown');
  return null;
}

function getAutonResult(tn, mn) {
  if (!tbaData || !tbaData.matches) return 'unknown';
  const m = tbaData.matches.find(x => x.match_number === mn);
  if (!m) return 'unknown';
  
  // Check if team is in this match
  const isRed = m.alliances.red.team_keys.some(k => parseInt(k.replace('frc', '')) === tn);
  const isBlue = m.alliances.blue.team_keys.some(k => parseInt(k.replace('frc', '')) === tn);
  if (!isRed && !isBlue) return 'unknown';
  
  // Method 1: Use score_breakdown — sum all auto point fields
  if (m.score_breakdown && m.score_breakdown.red && m.score_breakdown.blue) {
    const fields = detectAutoPointsFields();
    if (fields && fields.length) {
      const rA = fields.reduce((s, f) => s + (m.score_breakdown.red[f] || 0), 0);
      const bA = fields.reduce((s, f) => s + (m.score_breakdown.blue[f] || 0), 0);
      if (rA > bA) return isRed ? 'won' : 'lost';
      if (bA > rA) return isRed ? 'lost' : 'won';
      return 'draw';
    }
  }
  
  // Method 2: Fallback — compare scouting auton scores per alliance
  const redTeams = m.alliances.red.team_keys.map(k => parseInt(k.replace('frc', '')));
  const blueTeams = m.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', '')));
  
  let redAuto = 0, blueAuto = 0, hasData = false;
  redTeams.forEach(rtn => {
    const t = allTeams.find(x => x.teamNumber === rtn);
    if (t) {
      const h = t.history.find(x => x.match === mn);
      if (h) { redAuto += h.auto; hasData = true; }
    }
  });
  blueTeams.forEach(btn => {
    const t = allTeams.find(x => x.teamNumber === btn);
    if (t) {
      const h = t.history.find(x => x.match === mn);
      if (h) { blueAuto += h.auto; hasData = true; }
    }
  });
  
  if (hasData && (redAuto !== blueAuto)) {
    if (redAuto > blueAuto) return isRed ? 'won' : 'lost';
    if (blueAuto > redAuto) return isRed ? 'lost' : 'won';
  }
  
  return 'unknown';
}

// Re-enrich all team history with auton results after TBA data is loaded
function recomputeAutonResults() {
  if (!tbaData || !tbaData.matches || !allTeams.length) {
    console.warn('[Auton Filter] Cannot compute: tbaData=', !!tbaData, 'matches=', tbaData?.matches?.length, 'allTeams=', allTeams.length);
    return;
  }
  _autoPointsFields = null; // Reset cached fields so it re-detects
  
  // === DIAGNOSTICS ===
  const tbaMatchNums = tbaData.matches.map(m => m.match_number);
  const historyMatchNums = [...new Set(allTeams.flatMap(t => t.history.map(h => h.match)))];
  const sampleMatch = tbaData.matches[0];
  
  console.log('[Auton Filter] TBA matches:', tbaData.matches.length, '| match numbers:', tbaMatchNums.slice(0, 10).join(','), '...');
  console.log('[Auton Filter] Scouted history match numbers:', historyMatchNums.slice(0, 10).join(','), '...');
  console.log('[Auton Filter] Overlap:', historyMatchNums.filter(n => tbaMatchNums.includes(n)).length, 'of', historyMatchNums.length, 'scouted matches found in TBA');
  
  if (sampleMatch) {
    console.log('[Auton Filter] Sample TBA match:', {
      match_number: sampleMatch.match_number,
      has_score_breakdown: !!sampleMatch.score_breakdown,
      red_teams: sampleMatch.alliances?.red?.team_keys,
      blue_teams: sampleMatch.alliances?.blue?.team_keys,
      red_score: sampleMatch.alliances?.red?.score,
      breakdown_keys: sampleMatch.score_breakdown?.red ? Object.keys(sampleMatch.score_breakdown.red).filter(k => k.toLowerCase().includes('auto')) : 'NO BREAKDOWN'
    });
  }
  
  const sampleTeam = allTeams[0];
  if (sampleTeam) {
    console.log('[Auton Filter] Sample team:', sampleTeam.teamNumber, '| history matches:', sampleTeam.history.map(h => h.match).join(','));
  }
  // === END DIAGNOSTICS ===
  
  let wonCount = 0, lostCount = 0, drawCount = 0, unknownCount = 0;
  allTeams.forEach(t => {
    t.history.forEach(h => {
      h.autonResult = getAutonResult(t.teamNumber, h.match);
      if (h.autonResult === 'won') wonCount++;
      else if (h.autonResult === 'lost') lostCount++;
      else if (h.autonResult === 'draw') drawCount++;
      else unknownCount++;
    });
  });
  console.log(`[Auton Filter] Results: ${wonCount} won, ${lostCount} lost, ${drawCount} draw, ${unknownCount} unknown (total: ${wonCount+lostCount+drawCount+unknownCount})`);
  
  // If all unknown, trace one specific failure
  if (unknownCount > 0 && wonCount === 0 && lostCount === 0) {
    const t = allTeams[0];
    const h = t?.history[0];
    if (t && h) {
      const mn = h.match;
      const tn = t.teamNumber;
      const m = tbaData.matches.find(x => x.match_number === mn);
      console.warn('[Auton Filter] DEBUGGING first failure:', {
        teamNumber: tn,
        historyMatch: mn,
        tbaMatchFound: !!m,
        tbaMatchNumber: m?.match_number,
        teamInRed: m?.alliances?.red?.team_keys?.some(k => parseInt(k.replace('frc', '')) === tn),
        teamInBlue: m?.alliances?.blue?.team_keys?.some(k => parseInt(k.replace('frc', '')) === tn),
        hasBreakdown: !!m?.score_breakdown,
        redBreakdown: m?.score_breakdown?.red ? 'exists' : 'null',
        autoFields: detectAutoPointsFields()
      });
    }
  }
}

function computeStats(t) {
  const valid = t.matches.filter(r => !isNS(r) && (num(r.autonScore) !== null || num(r.teleopScore) !== null));
  const au = valid.map(r => num(r.autonScore)).filter(v => v !== null);
  const te = valid.map(r => num(r.teleopScore)).filter(v => v !== null);
  const en = valid.map(r => num(r.endgameScore)).filter(v => v !== null);
  const tot = valid.map(r => (num(r.autonScore) || 0) + (num(r.teleopScore) || 0) + (num(r.endgameScore) || 0));
  const cA = valid.filter(r => !isNA(r.endgameClimbSuccess));
  const cS = cA.filter(r => String(r.endgameClimbSuccess).toLowerCase().includes('success'));
  const rc = {};
  valid.forEach(r => getRoles(r).forEach(role => { rc[role] = (rc[role] || 0) + 1; }));
  const topRole = Object.entries(rc).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  const getR = col => { const v = valid.map(r => cleanR(r[col])).filter(Boolean); if (!v.length) return null; const c = {}; v.forEach(x => c[x] = (c[x] || 0) + 1); return Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]; };
  const getAvgR = col => { const v = valid.map(r => cleanR(r[col])).filter(Boolean).map(cat => RAT_VALS[cat]); return v.length ? v.reduce((s, v) => s + v, 0) / v.length : null; };
  const strengths = [...new Set(valid.map(r => r.allianceScoutStrengths).filter(v => v && !isNA(v) && v.length > 2))];
  const weaknesses = [...new Set(valid.map(r => r.allianceScoutWeaknesses).filter(v => v && !isNA(v) && v.length > 2))];
  const history = valid.map(r => {
    const mn = parseInt(r.matchNumber);
    return {
      match: mn,
      auto: num(r.autonScore) || 0,
      teleop: num(r.teleopScore) || 0,
      endgame: num(r.endgameScore) || 0,
      total: (num(r.autonScore) || 0) + (num(r.teleopScore) || 0) + (num(r.endgameScore) || 0),
      climb: r.endgameClimbSuccess,
      startPos: r.autonStartingPosition,
      roles: getRoles(r),
      autonResult: getAutonResult(t.teamNumber, mn)
    };
  }).sort((a, b) => a.match - b.match);
  return {
    ...t,
    validCount: valid.length,
    autoAvg: avg(au),
    autoMin: mn(au),
    autoMax: mx(au),
    autoStd: std(au),
    teleopAvg: avg(te),
    teleopMin: mn(te),
    teleopMax: mx(te),
    teleopStd: std(te),
    endgameAvg: avg(en),
    endgameMin: mn(en),
    endgameMax: mx(en),
    endgameStd: std(en),
    totalAvg: avg(tot),
    totalMin: mn(tot),
    totalMax: mx(tot),
    totalStd: std(tot),
    climbRate: cA.length ? cS.length / cA.length : null,
    climbSuccess: cS.length,
    climbAttempts: cA.length,
    topRole,
    roleCounts: rc,
    drivingProf: getAvgR('allianceScoutDrivingProficiency'),
    defenseEff: getAvgR('allianceScoutDefenseEffectivity'),
    intakeSpeed: getR('allianceScoutIntakeSpeed'),
    fuelThroughput: getR('allianceScoutFuelThroughput'),
    strengths,
    weaknesses,
    history,
    dprMatches: [],
    dprMulti: null,
    dprPoints: null
  };
}

function getFilteredStats(t) {
  if (!t || autonFilterMode === 'all') return t;
  const h = t.history.filter(m => {
    if (autonFilterMode === 'won') return m.autonResult === 'won';
    if (autonFilterMode === 'lost') return m.autonResult === 'lost';
    return true;
  });
  if (!h.length) return { ...t, validCount: 0, autoAvg: null, teleopAvg: null, endgameAvg: null, totalAvg: null, climbRate: null, autoMax: null, teleopMax: null, endgameMax: null, totalMax: null, autoMin: null, teleopMin: null, endgameMin: null, totalMin: null };
  const au = h.map(m => m.auto);
  const te = h.map(m => m.teleop);
  const en = h.map(m => m.endgame);
  const tot = h.map(m => m.total);
  const cA = h.filter(m => m.climb && !isNA(m.climb));
  const cS = cA.filter(m => String(m.climb).toLowerCase().includes('success'));
  return {
    ...t,
    validCount: h.length,
    autoAvg: avg(au),
    autoMin: mn(au),
    autoMax: mx(au),
    teleopAvg: avg(te),
    teleopMin: mn(te),
    teleopMax: mx(te),
    endgameAvg: avg(en),
    endgameMin: mn(en),
    endgameMax: mx(en),
    totalAvg: avg(tot),
    totalMin: mn(tot),
    totalMax: mx(tot),
    climbRate: cA.length ? cS.length / cA.length : null,
    history: h
  };
}

function fmt(v, d = 1) {
  return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toFixed(d);
}

function sc(v, hi, mid) {
  return !v && v !== 0 ? '' : (v >= hi ? 'hi' : v >= mid ? 'md' : 'lo');
}

function rp(v) {
  if (v === null || v === undefined) return '<span class="pill pna">N/A</span>';
  if (typeof v === 'number') {
    let cat = 'Bad';
    if (v >= 2.25) cat = 'VeryGood';
    else if (v >= 1.25) cat = 'Good';
    else if (v >= 0.5) cat = 'Decent';
    const m = { VeryGood: 'pvg', Good: 'pg', Decent: 'pd', Bad: 'pb' };
    return `<span class="pill ${m[cat] || 'pna'}">${v.toFixed(2)}</span>`;
  }
  const m = { verygood: 'pvg', good: 'pg', decent: 'pd', bad: 'pb' };
  return `<span class="pill ${m[v.toLowerCase()] || 'pna'}">${v}</span>`;
}

function rt(r) {
  if (!r) return '';
  const b = ['Cycler', 'Scorer', 'Feeder', 'Defender', 'Lobber'].find(x => r.includes(x)) || 'Other';
  return `<span class="rt r${b}">${r}</span>`;
}

function roleColor(topRole) {
  const b = ['Cycler', 'Scorer', 'Feeder', 'Defender', 'Lobber'].find(x => (topRole || '').includes(x)) || 'Other';
  return RCOL[b];
}

function corrected(raw, tn, matchNumber = null) {
  if (!cal.ready || raw === null || raw === undefined) return raw;
  if (tbaCorrectionMode === 'none') return raw;
  if (tbaCorrectionMode === 'match' && tn != null && matchNumber != null) {
    const scalar = perMatchScalars[tn]?.[matchNumber];
    if (scalar != null && !isNaN(scalar)) return raw * scalar;
  }
  const ts = tn != null ? cal.teamScalars[tn] : null;
  const scalar = ts ? ts.scalar : cal.scalar;
  return raw * scalar;
}

function tCorr(t) {
  if (!cal.ready || !t) return null;
  if (tbaCorrectionMode === 'none') return t.totalAvg || 0;
  if (tbaCorrectionMode === 'match') {
    const values = (t.history || [])
      .map(h => corrected(h.total, t.teamNumber, h.match))
      .filter(v => v !== null && !isNaN(v));
    return values.length ? values.reduce((s, v) => s + v, 0) / values.length : (t.totalAvg || 0);
  }
  return corrected(t.totalAvg, t.teamNumber);
}
