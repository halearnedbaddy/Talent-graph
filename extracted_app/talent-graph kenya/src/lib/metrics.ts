export type MetricCategory = 'technical' | 'tactical' | 'physical' | 'impact';

export interface Metric {
  id: string;
  name: string;
  description: string;
  unit: string;
  category: MetricCategory;
  required: boolean;
  athleteInput: boolean;
  howToTest: string;
  whyItMatters: string;
  higherIsBetter: boolean;
  elite: number;
  poor: number;
  weight: number;
  isPer90: boolean;
  validation: {
    min: number;
    max: number;
  };
}

export const baseMetrics: Record<string, Metric> = {
  // Institutional Core
  illinoisAgility: {
    id: 'illinoisAgility', name: 'Illinois Agility', description: 'Lateral movement and change of direction speed.', unit: 's',
    category: 'physical', required: false, athleteInput: true, isPer90: false, higherIsBetter: false, elite: 14.5, poor: 18.0, weight: 1.2,
    howToTest: 'Timed Illinois Agility course run.', whyItMatters: 'Mobility benchmark.',
    validation: { min: 10, max: 25 },
  },
  sprint30m: {
    id: 'sprint30m', name: '30m Sprint', description: 'Top speed acceleration.', unit: 's',
    category: 'physical', required: false, athleteInput: true, isPer90: false, higherIsBetter: false, elite: 3.8, poor: 4.5, weight: 1.0,
    howToTest: 'Timed 30m sprint from standstill.', whyItMatters: 'Explosive power.',
    validation: { min: 2, max: 10 },
  },
  verticalJump: {
    id: 'verticalJump', name: 'Vertical Jump', description: 'Explosive vertical lift.', unit: 'cm',
    category: 'physical', required: false, athleteInput: true, isPer90: false, higherIsBetter: true, elite: 75, poor: 40, weight: 1.0,
    howToTest: 'Stand and reach jump test.', whyItMatters: 'Lower body power.',
    validation: { min: 10, max: 120 },
  },
  passCompletion: {
    id: 'passCompletion', name: 'Pass Completion %', description: 'Overall passing accuracy.', unit: '%',
    category: 'technical', required: true, athleteInput: true, isPer90: false, higherIsBetter: true, elite: 90, poor: 65, weight: 1.2,
    howToTest: 'Successful passes / total passes.', whyItMatters: 'Technical reliability.',
    validation: { min: 0, max: 100 },
  },
  // Coach-Specific Institutional Metrics
  coachMatchRating: {
    id: 'coachMatchRating', name: 'Coach Match Rating', description: 'Subjective professional evaluation of match performance.', unit: '/10',
    category: 'impact', required: false, athleteInput: false, isPer90: false, higherIsBetter: true, elite: 9, poor: 5, weight: 1.5,
    howToTest: 'Evaluated by pro scout during match.', whyItMatters: 'Professional eye-test.',
    validation: { min: 1, max: 10 },
  },
  workRate: {
    id: 'workRate', name: 'Work Rate', description: 'Professionalism and effort on/off the ball.', unit: '/10',
    category: 'tactical', required: false, athleteInput: false, isPer90: false, higherIsBetter: true, elite: 9, poor: 5, weight: 1.0,
    howToTest: 'Observed consistency in high-intensity actions.', whyItMatters: 'Discipline indicator.',
    validation: { min: 1, max: 10 },
  },
  pressResistance: {
    id: 'pressResistance', name: 'Press Resistance', description: 'Ability to retain possession under high pressure.', unit: '/10',
    category: 'technical', required: false, athleteInput: false, isPer90: false, higherIsBetter: true, elite: 9, poor: 5, weight: 1.2,
    howToTest: 'Succesful ball retention in congested zones.', whyItMatters: 'Technical floor.',
    validation: { min: 1, max: 10 },
  },
  defensivePositioning: {
    id: 'defensivePositioning', name: 'Defensive Positioning', description: 'Tactical awareness in defensive transition.', unit: '/10',
    category: 'tactical', required: false, athleteInput: false, isPer90: false, higherIsBetter: true, elite: 9, poor: 5, weight: 1.1,
    howToTest: 'Positioning relative to ball and teammates.', whyItMatters: 'Tactical intelligence.',
    validation: { min: 1, max: 10 },
  },
  bigMatchImpact: {
    id: 'bigMatchImpact', name: 'Big Match Impact', description: 'Performance level in high-stakes environments.', unit: '/10',
    category: 'impact', required: false, athleteInput: false, isPer90: false, higherIsBetter: true, elite: 9, poor: 5, weight: 1.4,
    howToTest: 'Metric output in knockout/derby fixtures.', whyItMatters: 'Clutch factor.',
    validation: { min: 1, max: 10 },
  },
};

export const ATTRIBUTE_LIST = {
  Technical: [
    'Composure', 'Crossing', 'Dribbling', 'Finishing', 'First Touch', 
    'Free Kick', 'Long Shots', 'Long Throws', 'Marking', 'Passing', 
    'Penalty Taking', 'Tackling', 'Technique', 'Creativity', 'Flair'
  ],
  Mental: [
    'Aggression', 'Anticipation', 'Bravery', 'Concentration', 'Decisions', 
    'Determination', 'Influence', 'Off the Ball', 'Positioning', 
    'Teamwork', 'Work Rate'
  ],
  Physical: [
    'Acceleration', 'Heading', 'Agility', 'Balance', 'Jumping', 
    'Natural Fitness', 'Pace', 'Stamina', 'Strength'
  ]
};

export const positionalMetrics: Record<string, Record<string, Metric[]>> = {
  football: {
    forward: [baseMetrics.passCompletion, baseMetrics.sprint30m, baseMetrics.verticalJump, baseMetrics.illinoisAgility],
    midfielder: [baseMetrics.passCompletion, baseMetrics.sprint30m, baseMetrics.verticalJump, baseMetrics.illinoisAgility],
    defender: [baseMetrics.passCompletion, baseMetrics.sprint30m, baseMetrics.verticalJump, baseMetrics.illinoisAgility],
    goalkeeper: [baseMetrics.passCompletion, baseMetrics.verticalJump]
  }
};