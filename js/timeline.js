// Team Timeline: Match-by-match performance tracking
let selectedTeamTimeline = null;

function renderTimeline() {
  const teamSel = document.getElementById('timelineTeamSelect');
  if (!teamSel) return;

  // Populate team selector
  const opts = ['<option value="">— Select a team —</option>'];
  allTeams.forEach(t => {
    opts.push(`<option value="${t.teamNumber}">${t.teamNumber} — ${t.teamName}</option>`);
  });
  teamSel.innerHTML = opts.join('');

  // Clear previous selection
  selectedTeamTimeline = null;
  document.getElementById('timelineChartContainer').style.display = 'none';
  document.getElementById('timelineStats').innerHTML = '';
  document.getElementById('timelineTable').innerHTML = '';
}

function selectTeamTimeline() {
  const teamSel = document.getElementById('timelineTeamSelect');
  const tn = parseInt(teamSel?.value || 0);
  if (!tn) return;

  const team = allTeams.find(t => t.teamNumber === tn);
  if (!team) return;

  selectedTeamTimeline = buildTeamTimeline(team);
  renderTimelineDisplay();
}

function buildTeamTimeline(team) {
  const matches = [];
  if (!team.history) return { teamNumber: team.teamNumber, teamName: team.teamName, matches: [], stats: { avgRaw: 0, avgCorr: 0, best: 0, worst: 0, trend: 'stable', count: 0 } };

  team.history.forEach(hist => {
    const scalar = cal.ready ? (cal.teamScalars[team.teamNumber]?.scalar || cal.scalar) : 1;
    const corrected = hist.total * scalar;
    matches.push({
      match: hist.match,
      scouted: hist.total,
      corrected: corrected,
      scalar: scalar,
      role: hist.roles && hist.roles.length ? hist.roles[0] : 'N/A',
      climb: hist.climb || '—',
      auto: hist.auto || 0,
      teleop: hist.teleop || 0,
      endgame: hist.endgame || 0
    });
  });

  matches.sort((a, b) => a.match - b.match);
  const stats = getTeamStats(matches);

  return {
    teamNumber: team.teamNumber,
    teamName: team.teamName,
    matches: matches,
    stats: stats
  };
}

function getTeamStats(matches) {
  if (!matches.length) return { avgRaw: 0, avgCorr: 0, best: 0, worst: 0, trend: 'stable', count: 0 };

  const rawScores = matches.map(m => m.scouted);
  const corrScores = matches.map(m => m.corrected);

  const avgRaw = rawScores.reduce((a, b) => a + b, 0) / rawScores.length;
  const avgCorr = corrScores.reduce((a, b) => a + b, 0) / corrScores.length;
  const best = Math.max(...rawScores);
  const worst = Math.min(...rawScores);

  // Trend: compare first half vs second half
  const midpoint = Math.floor(rawScores.length / 2);
  const firstHalf = rawScores.slice(0, midpoint).reduce((a, b) => a + b, 0) / midpoint;
  const secondHalf = rawScores.slice(midpoint).reduce((a, b) => a + b, 0) / (rawScores.length - midpoint);
  const trend = secondHalf > firstHalf + 3 ? 'improving' : secondHalf < firstHalf - 3 ? 'declining' : 'stable';

  return {
    avgRaw: Math.round(avgRaw * 10) / 10,
    avgCorr: Math.round(avgCorr * 10) / 10,
    best: best,
    worst: worst,
    trend: trend,
    count: rawScores.length
  };
}

function renderTimelineDisplay() {
  if (!selectedTeamTimeline) return;

  // Show chart container
  document.getElementById('timelineChartContainer').style.display = 'block';

  // Render stats cards
  const stats = selectedTeamTimeline.stats;
  const trendIcon = { improving: '↑', declining: '↓', stable: '→' }[stats.trend] || '→';
  const trendColor = { improving: 'var(--grn)', declining: 'var(--red)', stable: 'var(--mut)' }[stats.trend] || 'var(--mut)';

  document.getElementById('timelineStats').innerHTML = `
    <div class="tstat-grid">
      <div class="tstat-card">
        <div class="tstat-label">Matches Played</div>
        <div class="tstat-value">${stats.count}</div>
      </div>
      <div class="tstat-card">
        <div class="tstat-label">Avg (Raw)</div>
        <div class="tstat-value">${fmt(stats.avgRaw)}</div>
      </div>
      <div class="tstat-card">
        <div class="tstat-label">Avg (Corrected)</div>
        <div class="tstat-value" style="color:var(--acc)">${fmt(stats.avgCorr)}</div>
      </div>
      <div class="tstat-card">
        <div class="tstat-label">Best / Worst</div>
        <div class="tstat-value"><span style="color:var(--grn)">${stats.best}</span> / <span style="color:var(--red)">${stats.worst}</span></div>
      </div>
      <div class="tstat-card">
        <div class="tstat-label">Trend</div>
        <div class="tstat-value" style="color:${trendColor};font-size:16px">${trendIcon} ${stats.trend}</div>
      </div>
    </div>
  `;

  // Render chart
  setTimeout(renderTimelineChart, 50);

  // Render match details table
  const rows = selectedTeamTimeline.matches.map(m => `
    <tr>
      <td class="ttbl-match">Q${m.match}</td>
      <td>${fmt(m.scouted)}</td>
      <td style="color:var(--acc);font-weight:700">${fmt(m.corrected)}</td>
      <td style="font-size:9px;color:var(--mut)">${m.scalar.toFixed(3)}×</td>
      <td>${m.role}</td>
      <td>${m.climb}</td>
      <td style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:9px">
        <span>${m.auto}</span>
        <span>${m.teleop}</span>
        <span>${m.endgame}</span>
      </td>
    </tr>
  `).join('');

  document.getElementById('timelineTable').innerHTML = `
    <table class="ttbl">
      <thead>
        <tr>
          <th>Match</th>
          <th>Scouted</th>
          <th>Corrected</th>
          <th>Scalar</th>
          <th>Role</th>
          <th>Climb</th>
          <th style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px"><span>Auto</span><span>Tele</span><span>End</span></th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}

function renderTimelineChart() {
  if (!selectedTeamTimeline) return;
  const canvas = document.getElementById('timelineCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (chartInsts['timeline']) chartInsts['timeline'].destroy();

  const matches = selectedTeamTimeline.matches;
  const labels = matches.map(m => `Q${m.match}`);
  const rawData = matches.map(m => m.scouted);
  const corrData = matches.map(m => m.corrected);

  chartInsts['timeline'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Scouted (Raw)',
          data: rawData,
          borderColor: 'rgba(251,146,60,0.8)',
          backgroundColor: 'rgba(251,146,60,0.1)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(251,146,60,0.8)',
          pointBorderColor: '#07101e',
          pointBorderWidth: 2,
          tension: 0.3
        },
        {
          label: 'Corrected (TBA)',
          data: corrData,
          borderColor: 'rgba(0,212,170,0.8)',
          backgroundColor: 'rgba(0,212,170,0.1)',
          borderWidth: 2,
          pointRadius: 4,
          pointBackgroundColor: 'rgba(0,212,170,0.8)',
          pointBorderColor: '#07101e',
          pointBorderWidth: 2,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 11 } } },
        tooltip: {
          backgroundColor: 'rgba(7,16,30,0.9)',
          titleColor: '#e2e8f0',
          bodyColor: '#94a3b8',
          borderColor: 'var(--bdr)',
          borderWidth: 1,
          callbacks: {
            title: items => items[0]?.label || '',
            afterBody: items => {
              const idx = items[0]?.dataIndex;
              if (idx === undefined) return '';
              const m = matches[idx];
              return `Scalar: ${m.scalar.toFixed(3)}× | Auto: ${m.auto} | Teleop: ${m.teleop} | Endgame: ${m.endgame}`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Match Number', color: '#64748b' },
          grid: { color: 'rgba(30,58,95,.3)' },
          ticks: { color: '#64748b' }
        },
        y: {
          title: { display: true, text: 'Points Scored', color: '#64748b' },
          grid: { color: 'rgba(30,58,95,.3)' },
          ticks: { color: '#64748b' }
        }
      }
    }
  });
}
