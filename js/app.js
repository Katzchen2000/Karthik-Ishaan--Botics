// Core app state and navigation
let allTeams = [];
let rawRows = [];
let tbaKey = '';
let tbaEvt = '';
let tbaData = null;
let cal = { scalar: 1, teamScalars: {}, r2: null, rmse: null, n: 0, pts: [], ready: false };
let perMatchScalars = {};
let perMatchCorrectedAvgs = {};
let sortKey = 'total';
let sortDir = -1;
let useMC = false;
let predMode = 'avg';
let tbaCorrectionMode = 'team';
let plNotes = {};
let teamNotes = {};
let plOrder = [];
let alliances = Array.from({ length: 8 }, () => [null, null, null]);
let detCharts = {};
let bUseCorr = false;
let oUseCorr = false;
let rUseCorr = false;
let plChartsOpen = false;
let activePlTab = 'bubble';
let activeChartTab = 'bubble';
let chartInsts = {};
let tbaRankData = null;
let rkSortKey = 'rank';
let rkSortDir = 1;
let simSortKey = 'rank';
let simSortDir = 1;
let tViewMode = 'avg';
let autonFilterMode = 'all';
let dprSortMetric = 'dprMulti';
let predDef = {};

function setAutonFilter(mode) {
  autonFilterMode = mode;
  document.querySelectorAll('.auton-filter-btn').forEach(b => {
    b.classList.toggle('on', b.getAttribute('onclick').includes(`'${mode}'`));
  });

  // Show/hide TBA warning banner
  const banner = document.getElementById('autonFilterBanner');
  if (banner) {
    if (mode !== 'all' && (!tbaData || !tbaData.matches)) {
      banner.style.display = 'flex';
      banner.textContent = '⚠ Auton filtering requires TBA to be connected — connect via "Connect TBA" in the top nav.';
    } else if (mode !== 'all') {
      // Count how many matches have known auton results
      const total = allTeams.reduce((s, t) => s + t.history.length, 0);
      const known = allTeams.reduce((s, t) => s + t.history.filter(h => h.autonResult !== 'unknown').length, 0);
      if (known === 0) {
        banner.style.display = 'flex';
        banner.textContent = '⚠ No auton result data found. TBA may not have score breakdowns for this event yet.';
      } else {
        banner.style.display = 'none';
      }
    } else {
      banner.style.display = 'none';
    }
  }

  const activePage = Object.keys(PGMAP).find(k => document.getElementById(PGMAP[k])?.classList.contains('on'));
  if (activePage) {
    if (activePage === 'teams') renderTeams();
    else if (activePage === 'charts') { renderBubble(); renderOPR(); renderRank(); renderDeviation(); }
    else if (activePage === 'predictor') renderPredictor();
    else if (activePage === 'simulation') renderSimulation();
    else if (activePage === 'rankings') renderRankings();
    else if (activePage === 'timeline') renderTimeline();
  }
}

const RCOL = { Cycler: 'rgba(129,140,248,.8)', Scorer: 'rgba(56,189,248,.8)', Feeder: 'rgba(251,191,36,.8)', Defender: 'rgba(248,113,113,.8)', Lobber: 'rgba(52,211,153,.8)', Other: 'rgba(0,212,170,.75)' };
const DCOL = { VeryGood: 'rgba(16,185,129,.8)', Good: 'rgba(14,165,233,.8)', Decent: 'rgba(245,158,11,.8)', Bad: 'rgba(239,68,68,.8)', null: 'rgba(100,116,139,.7)' };
const ALBL = { autoAvg: 'Auto Avg', teleopAvg: 'Teleop Avg', endgameAvg: 'Endgame Avg', totalAvg: 'Total Avg', climbRate: 'Climb %', totalStd: 'Std Dev σ', validCount: 'Matches', dprMulti: 'DPR Limit' };

const PGMAP = { teams: 'pgTeams', matches: 'pgMatches', predictor: 'pgPredictor', simulation: 'pgSimulation', notes: 'pgNotes', picklist: 'pgPicklist', charts: 'pgCharts', rankings: 'pgRankings', timeline: 'pgTimeline' };

function goto(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.ntab').forEach(t => t.classList.remove('on'));
  document.getElementById(PGMAP[id] || 'pgLanding')?.classList.add('on');
  document.getElementById('tab-' + id)?.classList.add('on');
  if (id === 'teams') renderTeams();
  if (id === 'matches') renderMatches();
  if (id === 'predictor') renderPredictor();
  if (id === 'simulation') renderSimulation();
  if (id === 'notes') renderNotes();
  if (id === 'picklist') renderPicklist();
  if (id === 'charts') { renderBubble(); renderOPR(); renderRank(); renderDeviation(); }
  if (id === 'rankings') renderRankings();
  if (id === 'timeline') renderTimeline();
}

function jumpTeam(tn) {
  goto('teams');
  setTimeout(() => {
    document.querySelectorAll('#tBody tr.cl').forEach(r => {
      if (r.querySelector('.tnum')?.textContent == String(tn)) {
        r.scrollIntoView({ behavior: 'smooth', block: 'center' });
        r.click();
      }
    });
  }, 100);
}
