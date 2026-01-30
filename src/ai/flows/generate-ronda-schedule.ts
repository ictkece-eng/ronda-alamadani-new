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

// Use a structured schema for the output, not just a string.
const GenerateRondaScheduleOutputSchema = z.array(
  z.object({
    date: z.string().describe('The date of the shift in YYYY-MM-DD format.'),
    participants: z.array(z.string()).describe('List of participant names for this shift.'),
  })
).describe('A JSON array representing the complete one-month ronda schedule.');
export type GenerateRondaScheduleOutput = z.infer<typeof GenerateRondaScheduleOutputSchema>;

export async function generateRondaSchedule(input: GenerateRondaScheduleInput): Promise<GenerateRondaScheduleOutput> {
  return generateRondaScheduleFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateRondaSchedulePrompt',
  input: {schema: GenerateRondaScheduleInputSchema},
  output: {schema: GenerateRondaScheduleOutputSchema},
  prompt: `You are an expert scheduler for a neighborhood watch program (ronda). Your task is to generate a complete, fair, and balanced one-month schedule.

Generate the schedule for the month of **{{{month}}}**.

The available participants are: {{#each participants}}'{{{this}}}'{{#unless @last}}, {{/unless}}{{/each}}.
The coordinator is **{{{coordinator}}}**.

Strictly follow these rules:
1.  **Full Month Coverage**: You MUST create a schedule entry for every single day of the specified month.
2.  **Shift Size**: Each night's shift must be assigned to exactly 2 or 3 participants. Do not assign more or less.
3.  **Fair Distribution**: Distribute the shifts as evenly and fairly as possible among all participants. Avoid assigning the same person too many times in a row.
4.  **Coordinator Exclusion**: The coordinator, '{{{coordinator}}}', MUST NOT be assigned to any shift.

Your output will be automatically formatted as a JSON array based on the schema. Just focus on providing the correct schedule data based on the rules.
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
