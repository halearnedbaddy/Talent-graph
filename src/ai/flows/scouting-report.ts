import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MatchEntrySchema = z.object({
  competition: z.string().optional(),
  apps: z.number().optional(),
  goals: z.number().optional(),
  assists: z.number().optional(),
  minutes: z.number().optional(),
  rating: z.number().optional(),
  yellowCards: z.number().optional(),
  redCards: z.number().optional(),
  isVerified: z.boolean().optional(),
});

const AthleteInputSchema = z.object({
  firstName: z.string(),
  lastName: z.string(),
  position: z.string().optional(),
  altPositions: z.array(z.string()).optional(),
  age: z.number().optional(),
  nationality: z.string().optional(),
  country: z.string().optional(),
  heightCm: z.number().optional(),
  weightKg: z.number().optional(),
  dominantFoot: z.string().optional(),
  clubName: z.string().optional(),
  bio: z.string().optional(),
  compositeScoutingIndex: z.number().optional(),
  performanceIndex: z.number().optional(),
  efficiencyIndex: z.number().optional(),
  consistencyIndex: z.number().optional(),
  developmentIndex: z.number().optional(),
  contextIndex: z.number().optional(),
  riskIndex: z.number().optional(),
  talentGraphScore: z.number().optional(),
  readinessTier: z.string().optional(),
  yellowCards: z.number().optional(),
  redCards: z.number().optional(),
  minutesPlayed: z.number().optional(),
  matchHistory: z.array(MatchEntrySchema).optional(),
  isVerified: z.boolean().optional(),
  activelyLooking: z.boolean().optional(),
  scoutNotes: z.string().optional(),
});

const ScoutingReportOutputSchema = z.object({
  executiveSummary: z.string(),
  technicalProfile: z.string(),
  performanceAnalysis: z.string(),
  strengthsAndWeaknesses: z.object({
    strengths: z.array(z.string()),
    areasForDevelopment: z.array(z.string()),
  }),
  recruitmentVerdict: z.string(),
  projectedPotential: z.string(),
  recommendation: z.enum(['Highly Recommended', 'Recommended', 'Monitor', 'Not Recommended']),
  confidenceLevel: z.enum(['High', 'Medium', 'Low']),
});

export type ScoutingReportOutput = z.infer<typeof ScoutingReportOutputSchema>;
export type AthleteInput = z.infer<typeof AthleteInputSchema>;

export const generateScoutingReport = ai.defineFlow(
  {
    name: 'generateScoutingReport',
    inputSchema: AthleteInputSchema,
    outputSchema: ScoutingReportOutputSchema,
  },
  async (athlete) => {
    const recentMatches = (athlete.matchHistory || []).slice(-10).reverse();
    const totalGoals = recentMatches.reduce((s, m) => s + (m.goals || 0), 0);
    const totalAssists = recentMatches.reduce((s, m) => s + (m.assists || 0), 0);
    const totalApps = recentMatches.reduce((s, m) => s + (m.apps || 0), 0);
    const totalMins = recentMatches.reduce((s, m) => s + (m.minutes || 0), 0);
    const avgRating =
      recentMatches.length > 0
        ? (recentMatches.reduce((s, m) => s + (m.rating || 0), 0) / recentMatches.length).toFixed(1)
        : 'N/A';

    const prompt = `
You are a senior football scout with 20 years of experience across East Africa, Europe, and the Middle East.
You work for Talent Graph Kenya, the leading sports talent intelligence platform in East Africa.

Analyse the following athlete data and produce a structured professional scouting report.
Write with authority, precision, and the nuanced language of a professional scout.
Be specific — reference actual numbers from the data. Do not use generic filler text.
Context: This is East African football — factor in the regional competitive level.

--- ATHLETE DATA ---
Name: ${athlete.firstName} ${athlete.lastName}
Age: ${athlete.age ?? 'Unknown'}
Position: ${athlete.position ?? 'Unknown'}${athlete.altPositions?.length ? ` (also plays: ${athlete.altPositions.join(', ')})` : ''}
Nationality: ${athlete.nationality ?? 'Unknown'} | Location: ${athlete.country ?? 'Unknown'}
Physical: ${athlete.heightCm ? `${athlete.heightCm}cm` : 'height unknown'}, ${athlete.weightKg ? `${athlete.weightKg}kg` : 'weight unknown'}, ${athlete.dominantFoot ?? 'foot unknown'}
Club: ${athlete.clubName ?? 'Unattached'}
Verified: ${athlete.isVerified ? 'Yes — institutionally verified' : 'No — self-reported data'}
Actively seeking transfer: ${athlete.activelyLooking ? 'Yes' : 'No'}
Readiness Tier: ${athlete.readinessTier ?? 'Not classified'}
Bio: ${athlete.bio ?? 'None provided'}

--- SCOUTING INDEX SCORES (0–100) ---
Composite Scouting Index (CSI): ${athlete.compositeScoutingIndex ?? 'N/A'}
Performance Index: ${athlete.performanceIndex ?? 'N/A'}
Efficiency Index: ${athlete.efficiencyIndex ?? 'N/A'}
Consistency Index: ${athlete.consistencyIndex ?? 'N/A'}
Development Index: ${athlete.developmentIndex ?? 'N/A'}
Context Index: ${athlete.contextIndex ?? 'N/A'}
Risk Index: ${athlete.riskIndex ?? 'N/A'} (lower is better)
Talent Graph Score: ${athlete.talentGraphScore ?? 'N/A'}

--- DISCIPLINE ---
Yellow Cards (career): ${athlete.yellowCards ?? 0}
Red Cards (career): ${athlete.redCards ?? 0}

--- RECENT MATCH STATS (last ${recentMatches.length} matches) ---
Total Appearances: ${totalApps}
Total Goals: ${totalGoals}
Total Assists: ${totalAssists}
Total Minutes: ${totalMins}
Average Match Rating: ${avgRating}/10
Match breakdown:
${recentMatches.length > 0 ? recentMatches.map(m => `  • ${m.competition ?? 'Unknown competition'} — ${m.apps ?? 0} app(s), ${m.goals ?? 0}G ${m.assists ?? 0}A, ${m.minutes ?? 0} mins, rating ${m.rating ?? 'N/A'}, YC:${m.yellowCards ?? 0} RC:${m.redCards ?? 0}${m.isVerified ? ' [verified]' : ''}`).join('\n') : '  No match history recorded.'}

${athlete.scoutNotes ? `--- SCOUT NOTES ---\n${athlete.scoutNotes}` : ''}

--- REQUIRED OUTPUT FORMAT (JSON) ---
Respond ONLY with valid JSON matching this exact structure:
{
  "executiveSummary": "2-3 sentences. Who is this player, what makes them notable or unremarkable, and what is the headline verdict.",
  "technicalProfile": "2-3 sentences on technical attributes: position-specific skills, physical profile, foot preference, and how they compare to the regional standard for their position and age.",
  "performanceAnalysis": "3-4 sentences referencing specific index scores and match stats. Interpret what the numbers mean in context. Note any red flags or standout patterns.",
  "strengthsAndWeaknesses": {
    "strengths": ["Specific strength 1", "Specific strength 2", "Specific strength 3"],
    "areasForDevelopment": ["Specific area 1", "Specific area 2"]
  },
  "recruitmentVerdict": "2-3 sentences. Is this player worth pursuing? At what level? What type of club would benefit most from signing them?",
  "projectedPotential": "1-2 sentences on ceiling: where could this player realistically be in 2-3 years given their current trajectory?",
  "recommendation": "One of: Highly Recommended | Recommended | Monitor | Not Recommended",
  "confidenceLevel": "One of: High | Medium | Low (based on data completeness and verification status)"
}
`;

    const { output } = await ai.generate({
      prompt,
      output: { schema: ScoutingReportOutputSchema },
    });

    if (!output) throw new Error('No output generated from AI model');
    return output;
  }
);
