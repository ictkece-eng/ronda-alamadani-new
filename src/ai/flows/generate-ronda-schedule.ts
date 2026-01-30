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

Your task is to create a fair and balanced one-month schedule based on the provided information and constraints. The output must be a valid JSON string.

Month: {{{month}}}
Participants: {{#each participants}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
Coordinator: {{{coordinator}}}

Constraints:
1. Each night's ronda must be assigned to exactly 2 or 3 participants.
2. Distribute the shifts as evenly as possible among all participants throughout the month.
3. The coordinator ({{{coordinator}}}) must NOT be assigned to any ronda shift.
4. Ensure every day of the given month has a schedule entry.

Output Format:
- The output must be a valid JSON string representing an array of schedule objects.
- Each object in the array represents one day and must contain two properties:
  1. \`date\`: The date of the ronda in "YYYY-MM-DD" format.
  2. \`participants\`: An array of strings, where each string is the name of a participant assigned to that day.

IMPORTANT: Your response MUST be only the raw JSON string. Do not include any markdown formatting (like \`\`\`json), explanations, or any other text outside of the JSON array itself.
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
