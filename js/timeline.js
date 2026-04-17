// Team Timeline: Match-by-match performance tracking
let selectedTeamTimelines = [];

function renderTimeline() {
  const teamSel = document.getElementById('timelineTeamSelect');
  if (!teamSel) return;

  // Populate team selector
  const opts = [];
  allTeams.forEach(t => {
    opts.push(`<option value="${t.teamNumber}">${t.teamNumber} — ${t.teamName}</option>`);
  });
  teamSel.innerHTML = opts.join('');

  // Clear previous selection
  selectedTeamTimelines = [];
  document.getElementById('timelineChartContainer').style.display = 'none';
  document.getElementById('timelineStats').innerHTML = '';
  document.getElementById('timelineTable').innerHTML = '';
}

function selectTeamTimeline() {
  const teamSel = document.getElementById('timelineTeamSelect');
  if (!teamSel) return;

  const selected = Array.from(teamSel.selectedOptions)
    .map(opt => parseInt(opt.value, 10))
    .filter(tn => !isNaN(tn) && tn > 0);

  if (!selected.length) {
    selectedTeamTimelines = [];
    document.getElementById('timelineChartContainer').style.display = 'none';
    document.getElementById('timelineStats').innerHTML = '';
    document.getElementById('timelineTable').innerHTML = '';
    return;
  }

  selectedTeamTimelines = selected
    .map(tn => allTeams.find(t => t.teamNumber === tn))
    .filter(Boolean)
    .map(buildTeamTimeline);

  renderTimelineDisplay();
}

function buildTeamTimeline(team) {
  const matches = [];
  if (!team.history) return { teamNumber: team.teamNumber, teamName: team.teamName, matches: [], stats: { avgRaw: 0, avgCorr: 0, best: 0, worst: 0, trend: 'stable', count: 0 } };

  team.history.forEach(hist => {
    const scalar = cal.ready
      ? (tbaCorrectionMode === 'match'
          ? (perMatchScalars[team.teamNumber]?.[hist.match] ?? (cal.teamScalars[team.teamNumber]?.scalar || cal.scalar))
          : (tbaCorrectionMode === 'team'
              ? (cal.teamScalars[team.teamNumber]?.scalar || cal.scalar)
              : 1))
      : 1;
    const correctedValue = corrected(hist.total, team.teamNumber, hist.match);
    matches.push({
      match: hist.match,
      scouted: hist.total,
      corrected: correctedValue,
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
  if (!selectedTeamTimelines.length) return;

  // Show chart container
  document.getElementById('timelineChartContainer').style.display = 'block';

  // Render stats cards for each selected team
  const statsHtml = selectedTeamTimelines.map(teamTimeline => {
    const stats = teamTimeline.stats;
    const trendIcon = { improving: '↑', declining: '↓', stable: '→' }[stats.trend] || '→';
    const trendColor = { improving: 'var(--grn)', declining: 'var(--red)', stable: 'var(--mut)' }[stats.trend] || 'var(--mut)';
    return `
      <div class="tstat-card" style="min-width:180px">
        <div class="tstat-label">${teamTimeline.teamNumber} — ${teamTimeline.teamName}</div>
        <div class="tstat-value">${stats.count} matches</div>
        <div class="tstat-label">Avg Raw</div>
        <div class="tstat-value">${fmt(stats.avgRaw)}</div>
        <div class="tstat-label">Avg Corr</div>
        <div class="tstat-value" style="color:var(--acc)">${fmt(stats.avgCorr)}</div>
        <div class="tstat-label">Best / Worst</div>
        <div class="tstat-value"><span style="color:var(--grn)">${stats.best}</span> / <span style="color:var(--red)">${stats.worst}</span></div>
        <div class="tstat-label">Trend</div>
        <div class="tstat-value" style="color:${trendColor};font-size:14px">${trendIcon} ${stats.trend}</div>
      </div>
    `;
  }).join('');

  document.getElementById('timelineStats').innerHTML = `
    <div class="tstat-grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
      ${statsHtml}
    </div>
  `;

  // Render chart
  setTimeout(renderTimelineChart, 50);

  // Render match details tables per selected team
  const tablesHtml = selectedTeamTimelines.map(teamTimeline => {
    const rows = teamTimeline.matches.map(m => `
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

    return `
      <div style="margin-bottom:20px">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px">${teamTimeline.teamNumber} — ${teamTimeline.teamName}</div>
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
      </div>
    `;
  }).join('');

  document.getElementById('timelineTable').innerHTML = tablesHtml;
}

function renderTimelineChart() {
  if (!selectedTeamTimelines.length) return;
  const canvas = document.getElementById('timelineCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (chartInsts['timeline']) chartInsts['timeline'].destroy();

  const labelSet = new Set();
  selectedTeamTimelines.forEach(teamTimeline => {
    teamTimeline.matches.forEach(m => labelSet.add(m.match));
  });
  const matchLabels = Array.from(labelSet).sort((a, b) => a - b).map(match => `Q${match}`);

  const colors = [
    { raw: 'rgba(251,146,60,0.8)', corr: 'rgba(251,146,60,0.2)' },
    { raw: 'rgba(59,130,246,0.8)', corr: 'rgba(59,130,246,0.2)' },
    { raw: 'rgba(16,185,129,0.8)', corr: 'rgba(16,185,129,0.2)' },
    { raw: 'rgba(234,179,8,0.8)', corr: 'rgba(234,179,8,0.2)' },
    { raw: 'rgba(168,85,247,0.8)', corr: 'rgba(168,85,247,0.2)' }
  ];

  const datasets = selectedTeamTimelines.flatMap((teamTimeline, index) => {
    const matchMap = new Map(teamTimeline.matches.map(m => [m.match, m]));
    const base = colors[index % colors.length];
    return [
      {
        label: `${teamTimeline.teamNumber} Raw`,
        data: matchLabels.map(label => {
          const matchNum = parseInt(label.replace('Q', ''), 10);
          const m = matchMap.get(matchNum);
          return m ? m.scouted : null;
        }),
        borderColor: base.raw,
        backgroundColor: base.corr,
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: base.raw,
        pointBorderColor: '#07101e',
        pointBorderWidth: 2,
        tension: 0.3,
        spanGaps: true
      },
      {
        label: `${teamTimeline.teamNumber} Corr`,
        data: matchLabels.map(label => {
          const matchNum = parseInt(label.replace('Q', ''), 10);
          const m = matchMap.get(matchNum);
          return m ? m.corrected : null;
        }),
        borderColor: base.raw.replace('0.8', '0.5'),
        backgroundColor: base.corr,
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: base.corr,
        pointBorderColor: '#07101e',
        pointBorderWidth: 2,
        tension: 0.3,
        spanGaps: true
      }
    ];
  });

  chartInsts['timeline'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: matchLabels,
      datasets: datasets
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
