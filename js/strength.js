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

  // Categorize: easy < 40, medium 40-60, hard > 60
  if (avgOppStrength < 40) return 'easy';
  if (avgOppStrength <= 60) return 'medium';
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

function predictTeamRank(teamNumber) {
  if (!tbaData || !tbaRankData) return null;

  const team = allTeams.find(t => t.teamNumber === teamNumber);
  if (!team) return null;

  // Calculate projected wins based on team strength vs opponents
  const teamStr = predCorr && cal.ready ? (tCorr(team) || 0) : (team.totalAvg || 0);
  let projectedWins = 0;
  let tiedMatches = 0;

  if (tbaData.matches) {
    tbaData.matches.forEach(m => {
      const isRed = m.alliances.red.team_keys.some(k => parseInt(k.replace('frc', '')) === teamNumber);
      const isPlayed = (isRed ? m.alliances.red.score : m.alliances.blue.score) >= 0;

      if (isPlayed) {
        // Match already played - use actual result
        const tbaScore = isRed ? m.alliances.red.score : m.alliances.blue.score;
        const oppScore = isRed ? m.alliances.blue.score : m.alliances.red.score;
        if (tbaScore > oppScore) projectedWins++;
        else if (tbaScore === oppScore) tiedMatches += 0.5;
      } else {
        // Match not played - predict based on average strengths
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
          if (teamStr > oppAvg) {
            projectedWins += 0.6; // 60% chance to win stronger opponent
          } else if (teamStr < oppAvg) {
            projectedWins += 0.3; // 30% chance to win weaker opponent
          } else {
            projectedWins += 0.5; // 50/50 vs equal
          }
        }
      }
    });
  }

  // Count how many teams have projected higher rank points
  let higherRankedCount = 0;
  allTeams.forEach(t => {
    if (t.teamNumber === teamNumber) return;
    const tStr = predCorr && cal.ready ? (tCorr(t) || 0) : (t.totalAvg || 0);
    if (tStr > teamStr) {
      higherRankedCount++;
    }
  });

  const predictedRank = higherRankedCount + 1;
  return {
    teamNumber: teamNumber,
    projectedWins: Math.round(projectedWins * 10) / 10,
    predictedRank: predictedRank,
    totalTeams: allTeams.length,
    strength: teamStr
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
