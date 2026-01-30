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
  prompt: `You are a simple but reliable scheduler. Your task is to generate a one-month ronda (neighborhood watch) schedule.

Generate the schedule for **{{{month}}}**.

The available participants are: {{#each participants}}'{{{this}}}'{{#unless @last}}, {{/unless}}{{/each}}.
The coordinator is **{{{coordinator}}}**.

Follow these simple rules:
1.  **Full Month Coverage**: Create a schedule entry for every single day of the month.
2.  **Shift Size**: Each night's shift must be assigned to **exactly TWO** participants.
3.  **Fairness**: Try to distribute shifts evenly among all participants.
4.  **Coordinator Exclusion**: The coordinator, '{{{coordinator}}}', MUST NOT be assigned to any shift.

Your output will be automatically parsed as a JSON array. Just focus on generating the schedule data according to the rules. Do not add any commentary or extra text.
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
    if (!output) {
      throw new Error('AI returned an empty or invalid schedule.');
    }
    return output;
  }
);
