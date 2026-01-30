'use server';

/**
 * @fileOverview AI assistant for coordinators to provide intelligent suggestions and reasoning-based recommendations.
 *
 * - getCoordinatorSuggestions - A function that returns AI-powered suggestions for coordinators.
 * - CoordinatorSuggestionsInput - The input type for the getCoordinatorSuggestions function.
 * - CoordinatorSuggestionsOutput - The return type for the getCoordinatorSuggestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const CoordinatorSuggestionsInputSchema = z.object({
  scheduleData: z
    .string()
    .describe(
      'The schedule data, including current assignments and shift preferences.'
    ),
  requestDetails: z
    .string()
    .optional()
    .describe(
      'Details of the schedule request, if applicable.  This is what the user is requesting to be changed in the schedule.'
    ),
});
export type CoordinatorSuggestionsInput = z.infer<
  typeof CoordinatorSuggestionsInputSchema
>;

const CoordinatorSuggestionsOutputSchema = z.object({
  suggestions: z
    .string()
    .describe(
      'AI-powered suggestions and reasoning-based recommendations for managing schedules or approving schedule requests.'
    ),
});
export type CoordinatorSuggestionsOutput = z.infer<
  typeof CoordinatorSuggestionsOutputSchema
>;

export async function getCoordinatorSuggestions(
  input: CoordinatorSuggestionsInput
): Promise<CoordinatorSuggestionsOutput> {
  return coordinatorAISuggestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'coordinatorAISuggestionsPrompt',
  input: {schema: CoordinatorSuggestionsInputSchema},
  output: {schema: CoordinatorSuggestionsOutputSchema},
  prompt: `You are an AI assistant for a ronda coordinator.  You provide intelligent suggestions and reasoning-based recommendations when managing schedules or approving schedule requests.

You are provided with the current schedule, and optionally a schedule request.

Schedule Data: {{{scheduleData}}}

{{#if requestDetails}}
Request Details: {{{requestDetails}}}
{{/if}}

Based on the schedule data and request details (if any), provide suggestions and recommendations to the coordinator. Explain your reasoning.

Ensure your response is well-structured and easy to understand. Focus on providing actionable insights that the coordinator can directly use to make informed decisions.
`,
});

const coordinatorAISuggestionsFlow = ai.defineFlow(
  {
    name: 'coordinatorAISuggestionsFlow',
    inputSchema: CoordinatorSuggestionsInputSchema,
    outputSchema: CoordinatorSuggestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
