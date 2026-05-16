import { AthleteProfile, UserAccount, MatchEntry } from '@/lib/types';
import { baseMetrics, Metric } from '@/lib/metrics';

const CSI_WEIGHTS = {
  PERFORMANCE: 0.30,
  EFFICIENCY: 0.20,
  CONSISTENCY: 0.15,
  CONTEXT: 0.15,
  DEVELOPMENT: 0.10,
  RISK: 0.10
};

export function calculateMatchDerivedScores(matchHistory: MatchEntry[]) {
  if (!matchHistory || matchHistory.length === 0) {
    return {
      performanceIndex: 50,
      efficiencyIndex: 50,
      consistencyIndex: 50,
      riskIndex: 50,
      talentScore: 50
    };
  }

  const totals = matchHistory.reduce((acc, m) => ({
    apps: acc.apps + (Number(m.apps) || 0),
    minutes: acc.minutes + (Number(m.minutes) || 0),
    ratingSum: acc.ratingSum + ((Number(m.rating) || 0) * (Number(m.apps) || 0)),
    goals: acc.goals + (Number(m.goals) || 0),
    assists: acc.assists + (Number(m.assists) || 0),
    shots: acc.shots + (Number(m.shots) || 0),
    duels: acc.duels + (Number(m.duelsWon) || 0),
    fouls: acc.fouls + (Number(m.fouls) || 0),
    yellows: acc.yellows + (Number(m.yellowCards) || 0),
    reds: acc.reds + (Number(m.redCards) || 0)
  }), { apps: 0, minutes: 0, ratingSum: 0, goals: 0, assists: 0, shots: 0, duels: 0, fouls: 0, yellows: 0, reds: 0 });

  const avgRating = totals.apps > 0 ? totals.ratingSum / totals.apps : 0;
  
  // 1. Performance Index
  const outputPer90 = totals.minutes > 0 ? ((totals.goals + totals.assists) / totals.minutes) * 90 : 0;
  const performanceIndex = Math.min(100, Math.round((avgRating * 8) + (outputPer90 * 20)));

  // 2. Efficiency Index
  const shotEfficiency = totals.shots > 0 ? (totals.goals / totals.shots) * 100 : 50;
  const efficiencyIndex = Math.min(100, Math.round(shotEfficiency * 0.6 + (avgRating * 4)));

  // 3. Consistency Index (Performance side)
  const ratings = matchHistory.map(m => Number(m.rating) || 0);
  const mean = ratings.reduce((a, b) => a + b, 0) / (ratings.length || 1);
  const variance = ratings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (ratings.length || 1);
  const stdDev = Math.sqrt(variance);
  const consistencyIndex = Math.max(0, Math.min(100, Math.round(100 - (stdDev * 15))));

  // 4. REFINED RISK INDEX (User Request)
  const foulsPer90 = totals.minutes > 0 ? (totals.fouls / totals.minutes) * 90 : 0;
  const cardsPer90 = totals.minutes > 0 ? ((totals.yellows + (totals.reds * 2)) / totals.minutes) * 90 : 0;
  const disciplineRisk = Math.min(100, (foulsPer90 / 3 * 50) + (cardsPer90 / 0.5 * 50));

  const consistencyRisk = Math.min(100, (stdDev / 2.0) * 100);

  const maxPossibleMinutes = totals.apps * 90;
  const availabilityRisk = maxPossibleMinutes > 0 
    ? Math.max(0, Math.min(100, (1 - (totals.minutes / maxPossibleMinutes)) * 100))
    : 100;

  const riskIndex = Math.round(
    (disciplineRisk * 0.40) + 
    (consistencyRisk * 0.35) + 
    (availabilityRisk * 0.25)
  );

  const talentScore = Math.round((performanceIndex + efficiencyIndex + consistencyIndex) / 3);

  // Sanitizing NaN results
  return {
    performanceIndex: isNaN(performanceIndex) ? 50 : performanceIndex,
    efficiencyIndex: isNaN(efficiencyIndex) ? 50 : efficiencyIndex,
    consistencyIndex: isNaN(consistencyIndex) ? 50 : consistencyIndex,
    riskIndex: isNaN(riskIndex) ? 50 : riskIndex,
    talentScore: isNaN(talentScore) ? 50 : talentScore
  };
}

export function calculateTalentGraphScore(athlete: AthleteProfile, user: UserAccount) {
  const matchScores = calculateMatchDerivedScores(athlete.matchHistory || []);
  
  const metricScores: Record<string, number> = {
    'Illinois Agility': getLatestMetricScore(athlete, 'illinoisAgility'),
    '30m Sprint': getLatestMetricScore(athlete, 'sprint30m'),
    'Vertical Jump': getLatestMetricScore(athlete, 'verticalJump'),
    'Physical': calculatePillarAvg(athlete, 'Physical'),
    'Tactical': calculatePillarAvg(athlete, 'Mental'),
    'Impact': matchScores.performanceIndex,
    'Technical': calculatePillarAvg(athlete, 'Technical'),
    'Pass Completion': getLatestMetricScore(athlete, 'passCompletion')
  };

  const contextIndex = Math.round((Number(athlete.leagueCoefficient) || 1.0) * 60);
  const developmentIndex = 50; 

  const compositeScoutingIndex = Math.round(
    (matchScores.performanceIndex * CSI_WEIGHTS.PERFORMANCE) +
    (matchScores.efficiencyIndex * CSI_WEIGHTS.EFFICIENCY) +
    (matchScores.consistencyIndex * CSI_WEIGHTS.CONSISTENCY) +
    (contextIndex * CSI_WEIGHTS.CONTEXT) +
    (developmentIndex * CSI_WEIGHTS.DEVELOPMENT) +
    ((100 - matchScores.riskIndex) * CSI_WEIGHTS.RISK)
  );

  const talentScore = matchScores.talentScore;

  return {
    performanceIndex: matchScores.performanceIndex,
    efficiencyIndex: matchScores.efficiencyIndex,
    consistencyIndex: matchScores.consistencyIndex,
    riskIndex: matchScores.riskIndex,
    talentGraphScore: talentScore,
    compositeScoutingIndex: isNaN(compositeScoutingIndex) ? 50 : compositeScoutingIndex,
    metricScores,
    readinessTier: talentScore >= 85 ? 'Pro' : talentScore >= 65 ? 'Semi-Pro' : 'Developing'
  };
}

function getLatestMetricScore(athlete: AthleteProfile, metricId: string): number {
  const history = athlete.rawMetrics?.[metricId];
  if (!history || history.length === 0) return 50;
  const val = Number(history[history.length - 1].value);
  if (isNaN(val)) return 50;

  const metric = baseMetrics[metricId];
  if (!metric) return 50;
  
  const { elite, poor, higherIsBetter } = metric;
  let score;
  if (higherIsBetter) {
    score = ((val - poor) / (elite - poor)) * 100;
  } else {
    score = ((poor - val) / (poor - elite)) * 100;
  }
  
  return Math.min(100, Math.max(0, isNaN(score) ? 50 : Math.round(score)));
}

function calculatePillarAvg(athlete: AthleteProfile, pillar: keyof typeof athlete.detailedAttributes): number {
  const attrs = athlete.detailedAttributes?.[pillar as any];
  if (!attrs) return 50;
  const vals = Object.values(attrs).map(v => Number(v)).filter(v => !isNaN(v));
  if (vals.length === 0) return 50;
  return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10);
}