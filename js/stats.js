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
  const history = valid.map(r => ({
    match: parseInt(r.matchNumber),
    auto: num(r.autonScore) || 0,
    teleop: num(r.teleopScore) || 0,
    endgame: num(r.endgameScore) || 0,
    total: (num(r.autonScore) || 0) + (num(r.teleopScore) || 0) + (num(r.endgameScore) || 0),
    climb: r.endgameClimbSuccess,
    startPos: r.autonStartingPosition,
    roles: getRoles(r)
  })).sort((a, b) => a.match - b.match);
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

function corrected(raw, tn) {
  if (!cal.ready || raw === null || raw === undefined) return null;
  const ts = tn != null ? cal.teamScalars[tn] : null;
  return raw * (ts ? ts.scalar : cal.scalar);
}

function tCorr(t) {
  return corrected(t.totalAvg, t.teamNumber);
}
