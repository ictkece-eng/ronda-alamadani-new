'use server';

import { z } from 'zod';
import { getCoordinatorSuggestions } from '@/ai/flows/coordinator-ai-suggestions';

const GetSuggestionSchema = z.object({
  scheduleData: z.string(),
  requestDetails: z.string(),
});

export async function handleGetCoordinatorSuggestion(scheduleData: string, requestDetails: string) {
    try {
        const validatedFields = GetSuggestionSchema.safeParse({
            scheduleData,
            requestDetails,
        });

        if (!validatedFields.success) {
            return { error: 'Invalid input data.' };
        }

        const result = await getCoordinatorSuggestions(validatedFields.data);
        return { suggestion: result.suggestions };

    } catch (error) {
        console.error(error);
        return { error: 'Failed to get AI suggestion.' };
    }
}
