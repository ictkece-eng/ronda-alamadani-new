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
  roundsPerNight: z.number().describe('The number of rounds to be completed per night.'),
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

  Given the following information, generate a one-month ronda schedule in JSON format.

  Month: {{{month}}}
  Participants: {{#each participants}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
  Coordinator: {{{coordinator}}}
  Rounds per night: {{{roundsPerNight}}}

  The JSON format should contain an array of objects, where each object represents a day in the month.
  Each day object should have the following properties:
  - date: The date in YYYY-MM-DD format.
  - participants: An array of participant names assigned to that day's ronda.
  - rounds: An array of strings, each string contains the round number and the name of the assigned participant.

  Ensure that the schedule is fair and balanced, distributing the ronda duties evenly among all participants.
  Consider that each participant has to complete {{{roundsPerNight}}} rounds per night.
  Each participant should not be assigned for more than 3 days in a week.
  Make sure the coordinator is not in the list of participants.
  Ensure that the output is a valid JSON.
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
