import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const PipelineAthleteSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.string().optional(),
  altPositions: z.array(z.string()).optional(),
  age: z.number().optional(),
  country: z.string().optional(),
  clubName: z.string().optional(),
  compositeScoutingIndex: z.number().optional(),
  performanceIndex: z.number().optional(),
  efficiencyIndex: z.number().optional(),
  consistencyIndex: z.number().optional(),
  developmentIndex: z.number().optional(),
  isVerified: z.boolean().optional(),
  activelyLooking: z.boolean().optional(),
  recruitment_stage: z.string().optional(),
  scoutNotes: z.string().optional(),
  heightCm: z.number().optional(),
  dominantFoot: z.string().optional(),
});

export const ShortlistInputSchema = z.object({
  criteria: z.string(),
  athletes: z.array(PipelineAthleteSchema),
});

const RankedAthleteSchema = z.object({
  id: z.string(),
  name: z.string(),
  fitScore: z.number(),
  fitLabel: z.enum(['Excellent Fit', 'Strong Fit', 'Good Fit', 'Partial Fit', 'Poor Fit']),
  headline: z.string(),
  reasons: z.array(z.string()),
  concerns: z.array(z.string()).optional(),
});

export const ShortlistOutputSchema = z.object({
  rankedAthletes: z.array(RankedAthleteSchema),
  summary: z.string(),
  topPickId: z.string(),
});

export type ShortlistInput = z.infer<typeof ShortlistInputSchema>;
export type ShortlistOutput = z.infer<typeof ShortlistOutputSchema>;
export type RankedAthlete = z.infer<typeof RankedAthleteSchema>;

export const shortlistAthletes = ai.defineFlow(
  {
    name: 'shortlistAthletes',
    inputSchema: ShortlistInputSchema,
    outputSchema: ShortlistOutputSchema,
  },
  async ({ criteria, athletes }) => {
    const rosterText = athletes.map((a, i) => {
      const csi = a.compositeScoutingIndex !== undefined ? `CSI: ${Math.round(a.compositeScoutingIndex)}` : 'CSI: N/A';
      const verified = a.isVerified ? '✓ Verified' : 'Unverified';
      const looking = a.activelyLooking ? ', actively seeking transfer' : '';
      const stage = a.recruitment_stage ? `, pipeline stage: ${a.recruitment_stage}` : '';
      const indices = [
        a.performanceIndex !== undefined ? `Perf:${Math.round(a.performanceIndex)}` : null,
        a.efficiencyIndex !== undefined ? `Eff:${Math.round(a.efficiencyIndex)}` : null,
        a.consistencyIndex !== undefined ? `Con:${Math.round(a.consistencyIndex)}` : null,
        a.developmentIndex !== undefined ? `Dev:${Math.round(a.developmentIndex)}` : null,
      ].filter(Boolean).join(', ');
      const notes = a.scoutNotes ? `\n     Scout notes: "${a.scoutNotes}"` : '';
      return `${i + 1}. ${a.name} (ID: ${a.id})
     Position: ${a.position ?? 'Unknown'}${a.altPositions?.length ? ` / ${a.altPositions.join('/')}` : ''}, Age: ${a.age ?? 'N/A'}, ${a.country ?? 'Unknown'}, ${a.clubName ?? 'Unattached'}
     ${csi}${indices ? ` | ${indices}` : ''} | ${verified}${looking}${stage}${notes}`;
    }).join('\n\n');

    const prompt = `
You are a senior football scout for Talent Graph Kenya. You have been asked to shortlist athletes from a scout's recruitment pipeline for a specific role or criteria.

--- SCOUT'S REQUIREMENTS ---
${criteria}

--- PIPELINE ATHLETES (${athletes.length} total) ---
${rosterText}

--- TASK ---
Analyse each athlete against the scout's requirements. Rank ALL ${athletes.length} athletes from best fit to worst fit.
For each athlete:
- Assign a fitScore from 0–100 reflecting how well they match the requirements
- Assign a fitLabel: "Excellent Fit" (85–100), "Strong Fit" (70–84), "Good Fit" (55–69), "Partial Fit" (35–54), "Poor Fit" (0–34)
- Write a 1-sentence headline verdict specific to this athlete and this role
- List 2–3 specific reasons why they fit (or don't fit)
- Note any concerns (optional, only if real concerns exist)

Write a 2-sentence overall summary of the shortlist — which athlete stands out and why, and any gaps in the pipeline for this role.

Respond ONLY with valid JSON matching this structure exactly:
{
  "rankedAthletes": [
    {
      "id": "<athlete ID string>",
      "name": "<full name>",
      "fitScore": <0-100>,
      "fitLabel": "<one of the 5 labels>",
      "headline": "<one sentence specific verdict>",
      "reasons": ["reason 1", "reason 2", "reason 3"],
      "concerns": ["concern 1"]
    }
  ],
  "summary": "<2 sentence overview>",
  "topPickId": "<ID of the top ranked athlete>"
}
`;

    const { output } = await ai.generate({
      prompt,
      output: { schema: ShortlistOutputSchema },
    });

    if (!output) throw new Error('No output generated from AI model');
    return output;
  }
);
