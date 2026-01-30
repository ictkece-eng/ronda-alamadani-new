'use server';
/**
 * @fileOverview Automatically generates a one-month ronda schedule.
 *
 * - generateRondaSchedule - A function that handles the automatic schedule generation.
 * - GenerateRondaScheduleInput - The input type for the generateRondaSchedule function.
 * - GenerateRondaScheduleOutput - The return type for the generateRondaSchedule function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateRondaScheduleInputSchema = z.object({
  month: z.string().describe('The month for which to generate the schedule (e.g., YYYY-MM).'),
  participants: z.array(z.string()).describe('The list of participants available for ronda.'),
  coordinator: z.string().describe('The coordinator for the ronda.'),
});
export type GenerateRondaScheduleInput = z.infer<typeof GenerateRondaScheduleInputSchema>;

const GenerateRondaScheduleOutputSchema = z.object({
  schedule: z.string().describe('The generated ronda schedule in JSON format.'),
});
export type GenerateRondaScheduleOutput = z.infer<typeof GenerateRondaScheduleOutputSchema>;

export async function generateRondaSchedule(input: GenerateRondaScheduleInput): Promise<GenerateRondaScheduleOutput> {
  return generateRondaScheduleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRondaSchedulePrompt',
  input: {schema: GenerateRondaScheduleInputSchema},
  output: {schema: GenerateRondaScheduleOutputSchema},
  prompt: `You are an AI assistant that generates ronda (neighborhood watch) schedules.

Your task is to create a fair and balanced one-month schedule based on the provided information.

Month: {{{month}}}
Participants: {{#each participants}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
Coordinator: {{{coordinator}}}

RULES:
1. Each night shift must be assigned to 2 or 3 participants.
2. Distribute the shifts as evenly as possible among all participants.
3. The coordinator ({{{coordinator}}}) MUST NOT be assigned to any shift.
4. Ensure every day of the given month has a schedule entry.

OUTPUT FORMAT:
- Your output MUST be a valid JSON array of objects.
- Each object represents one day and MUST contain two keys: "date" and "participants".
- The "date" value must be a string in "YYYY-MM-DD" format.
- The "participants" value must be an array of strings, containing the names of assigned participants.

IMPORTANT: Respond with ONLY the raw JSON array. Do NOT include any explanations, comments, or markdown formatting like \`\`\`json.
  `,
});

const generateRondaScheduleFlow = ai.defineFlow(
  {
    name: 'generateRondaScheduleFlow',
    inputSchema: GenerateRondaScheduleInputSchema,
    outputSchema: GenerateRondaScheduleOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
