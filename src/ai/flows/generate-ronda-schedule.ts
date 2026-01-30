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
  prompt: `You are a helpful assistant specialized in generating ronda schedules.

  Given the following information, generate a one-month ronda schedule in JSON format. The schedule must be fair and balanced, distributing the ronda duties as evenly as possible among all participants over the entire month.

  Month: {{{month}}}
  Participants: {{#each participants}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
  Coordinator: {{{coordinator}}}

  Constraints for the schedule:
  1.  Assign exactly 2 or 3 participants for each night's ronda.
  2.  Distribute duties fairly so that each participant gets a similar number of shifts throughout the month.
  3.  A participant should not be assigned for more than 3 days in a single week.
  4.  The coordinator should not be included in the ronda schedule.

  The JSON output should be an array of objects, where each object represents a day in the month. Each day object must have these properties:
  - date: The date in "YYYY-MM-DD" format.
  - participants: An array of participant names assigned to that day's ronda.

  Ensure the output is only a valid JSON array.
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
