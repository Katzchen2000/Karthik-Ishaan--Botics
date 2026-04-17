// Schedule strength and rank prediction

function getTeamScheduleStrength(teamNumber) {
  if (!tbaData || !tbaData.matches) return null;

  const teamMatches = tbaData.matches.filter(m => {
    const allTeams_ = [
      ...m.alliances.red.team_keys.map(k => parseInt(k.replace('frc', ''))),
      ...m.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', '')))
    ];
    return allTeams_.includes(teamNumber);
  });

  if (!teamMatches.length) return null;

  let opponentStrength = 0;
  let count = 0;

  teamMatches.forEach(m => {
    const isRed = m.alliances.red.team_keys.some(k => parseInt(k.replace('frc', '')) === teamNumber);
    const opponents = isRed
      ? m.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', '')))
      : m.alliances.red.team_keys.map(k => parseInt(k.replace('frc', '')));

    opponents.forEach(oppNum => {
      const oppTeam = allTeams.find(t => t.teamNumber === oppNum);
      if (oppTeam && oppTeam.totalAvg !== null) {
        const val = predCorr && cal.ready ? (tCorr(oppTeam) || 0) : (oppTeam.totalAvg || 0);
        opponentStrength += val;
        count++;
      }
    });
  });

  if (!count) return null;
  const avgOppStrength = opponentStrength / count;

  // Categorize: easy < 200, medium 200-400, hard > 400
  //might not take into account defense. Adjust thresholds as needed based on typical score distributions.
  if (avgOppStrength < 200) return 'easy';
  if (avgOppStrength <= 400) return 'medium';
  return 'hard';
}

function getScheduleStrengthColor(strength) {
  const colors = { easy: 'var(--grn)', medium: 'var(--yel)', hard: 'var(--red)' };
  return colors[strength] || 'var(--mut)';
}

function getScheduleStrengthLabel(strength) {
  const labels = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
  return labels[strength] || 'Unknown';
}

function projectionForTeam(teamNumber) {
  const team = allTeams.find(t => t.teamNumber === teamNumber);
  if (!team || !tbaData || !tbaData.matches) return null;

  const teamStr = predCorr && cal.ready ? (tCorr(team) || 0) : (team.totalAvg || 0);
  let projectedWins = 0;
  let tiedMatches = 0;
  const schedule = getTeamScheduleStrength(teamNumber);
  const scheduleBias = schedule === 'easy' ? 0.05 : schedule === 'hard' ? -0.05 : 0;

  tbaData.matches.forEach(m => {
    const isRed = m.alliances.red.team_keys.some(k => parseInt(k.replace('frc', '')) === teamNumber);
    const isPlayed = (isRed ? m.alliances.red.score : m.alliances.blue.score) >= 0;

    if (isPlayed) {
      const tbaScore = isRed ? m.alliances.red.score : m.alliances.blue.score;
      const oppScore = isRed ? m.alliances.blue.score : m.alliances.red.score;
      if (tbaScore > oppScore) projectedWins++;
      else if (tbaScore === oppScore) tiedMatches += 0.5;
    } else {
      const opponents = isRed
        ? m.alliances.blue.team_keys.map(k => parseInt(k.replace('frc', '')))
        : m.alliances.red.team_keys.map(k => parseInt(k.replace('frc', '')));

      let oppAvg = 0, oppCount = 0;
      opponents.forEach(opp => {
        const oppTeam = allTeams.find(t => t.teamNumber === opp);
        if (oppTeam) {
          const oppVal = predCorr && cal.ready ? (tCorr(oppTeam) || 0) : (oppTeam.totalAvg || 0);
          oppAvg += oppVal;
          oppCount++;
        }
      });

      if (oppCount) {
        oppAvg = oppAvg / oppCount;
        const strengthBias = Math.max(-0.2, Math.min(0.2, (teamStr - oppAvg) / 200));
        const winProb = Math.max(0.05, Math.min(0.95, 0.5 + strengthBias + scheduleBias));
        projectedWins += winProb;
      }
    }
  });

  return {
    teamNumber,
    projectedWins: Math.round((projectedWins + tiedMatches) * 10) / 10,
    strength: teamStr,
    schedule
  };
}

function predictTeamRank(teamNumber) {
  if (!tbaData || !tbaData.matches) return null;

  const projection = projectionForTeam(teamNumber);
  if (!projection) return null;

  const allProjections = allTeams.map(t => ({
    teamNumber: t.teamNumber,
    wins: projectionForTeam(t.teamNumber)?.projectedWins || 0
  }));

  allProjections.sort((a, b) => b.wins - a.wins || a.teamNumber - b.teamNumber);
  const predictedRank = allProjections.findIndex(x => x.teamNumber === teamNumber) + 1;

  return {
    teamNumber,
    projectedWins: projection.projectedWins,
    predictedRank,
    totalTeams: allTeams.length,
    strength: projection.strength
  };
}

function renderTeamScheduleStrengthBadge(teamNumber) {
  const strength = getTeamScheduleStrength(teamNumber);
  if (!strength) return '';

  const color = getScheduleStrengthColor(strength);
  const label = getScheduleStrengthLabel(strength);

  return `<span class="schedule-strength" style="background:${color}15;color:${color};border:1px solid ${color}30;padding:2px 6px;border-radius:4px;font-size:9px;font-weight:600">${label}</span>`;
}

function renderTeamRankPrediction(teamNumber) {
  const pred = predictTeamRank(teamNumber);
  if (!pred) return '';

  const rankDiff = Math.abs(pred.predictedRank - (tbaRankData?.find(r => r.team_number === teamNumber)?.rank || pred.predictedRank));
  const rankColor = rankDiff < 5 ? 'var(--grn)' : rankDiff < 10 ? 'var(--yel)' : 'var(--red)';

  return `
    <div style="font-size:10px;color:var(--mut);margin-bottom:4px;font-weight:700">Rank Prediction</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      <div style="background:var(--surf2);padding:6px;border-radius:4px;border-left:2px solid var(--acc)">
        <div style="font-size:9px;color:var(--mut)">Projected Rank</div>
        <div style="font-size:14px;font-weight:700;color:var(--acc)">#${pred.predictedRank} / ${pred.totalTeams}</div>
      </div>
      <div style="background:var(--surf2);padding:6px;border-radius:4px;border-left:2px solid ${rankColor}">
        <div style="font-size:9px;color:var(--mut)">Est Wins</div>
        <div style="font-size:14px;font-weight:700;color:${rankColor}">${pred.projectedWins}</div>
      </div>
    </div>
  `;
}

function renderSimulation() {
  const body = document.getElementById('simBody');
  const badge = document.getElementById('simBadge');
  const canvas = document.getElementById('simRankCanvas');
  if (!body || !badge || !canvas) return;

  const rows = allTeams.map(t => {
    const projection = projectionForTeam(t.teamNumber);
    const pred = projection ? predictTeamRank(t.teamNumber) : null;
    return {
      team: t,
      strength: teamAvgVal(t),
      schedule: projection?.schedule || 'unknown',
      projectedWins: projection?.projectedWins || 0,
      predictedRank: pred?.predictedRank || allTeams.length
    };
  }).sort((a, b) => a.predictedRank - b.predictedRank || b.projectedWins - a.projectedWins || a.team.teamNumber - b.team.teamNumber);

  badge.textContent = `${rows.length} teams`;
  body.innerHTML = rows.map((row, index) => `
    <tr style="border-bottom:1px solid rgba(148,163,184,.15)">
      <td style="padding:8px 6px">${index + 1}</td>
      <td style="padding:8px 6px">${row.team.teamNumber}</td>
      <td style="padding:8px 6px">${row.team.teamName.slice(0, 24)}</td>
      <td style="padding:8px 6px">${Math.round(row.strength)}</td>
      <td style="padding:8px 6px">${getScheduleStrengthLabel(row.schedule)}</td>
      <td style="padding:8px 6px">${row.projectedWins.toFixed(1)}</td>
      <td style="padding:8px 6px">#${row.predictedRank}</td>
    </tr>
  `).join('');

  if (chartInsts['simRank']) chartInsts['simRank'].destroy();
  const chartData = rows.map(r => ({
    x: r.strength,
    y: r.predictedRank,
    team: r.team.teamNumber,
    schedule: r.schedule,
    wins: r.projectedWins
  }));
  const colorMap = { easy: '#22c55e', medium: '#facc15', hard: '#ef4444', unknown: '#64748b' };

  chartInsts['simRank'] = new Chart(canvas.getContext('2d'), {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Team projections',
        data: chartData,
        backgroundColor: chartData.map(d => colorMap[d.schedule] || colorMap.unknown),
        borderWidth: 0,
        pointRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => {
              const d = context.raw;
              return `Team ${d.team}: Avg ${Math.round(d.x)} | Rank #${d.y} | ${getScheduleStrengthLabel(d.schedule)} | ${d.wins.toFixed(1)} wins`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: 'Current Point Average', color: '#94a3b8' },
          ticks: { color: '#64748b' },
          grid: { color: 'rgba(30,58,95,.3)' }
        },
        y: {
          reverse: true,
          title: { display: true, text: 'Predicted Qualification Rank', color: '#94a3b8' },
          ticks: { color: '#64748b', stepSize: 1 },
          grid: { color: 'rgba(30,58,95,.3)' }
        }
      }
    }
  });
}
