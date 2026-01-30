'use server';

import { z } from 'zod';
import { generateRondaSchedule } from '@/ai/flows/generate-ronda-schedule';
import { getCoordinatorSuggestions } from '@/ai/flows/coordinator-ai-suggestions';

const GenerateScheduleSchema = z.object({
  month: z.string().min(1, 'Month is required.'),
  participants: z.string().transform((val, ctx) => {
    try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(p => typeof p === 'string')) {
            return parsed;
        }
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Participants data is invalid or empty."});
        return z.NEVER;
    } catch (e) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid JSON for participants."});
        return z.NEVER;
    }
  }),
  coordinator: z.string().min(1, 'Coordinator is required.'),
});


export async function handleGenerateSchedule(prevState: any, formData: FormData) {
  try {
    const validatedFields = GenerateScheduleSchema.safeParse({
      month: formData.get('month'),
      participants: formData.get('participants'),
      coordinator: formData.get('coordinator'),
    });

    if (!validatedFields.success) {
      return {
        message: 'Invalid form data.',
        errors: validatedFields.error.flatten().fieldErrors,
      };
    }

    const { month, participants, coordinator } = validatedFields.data;

    // generateRondaSchedule now returns a structured array, not an object with a string.
    const scheduleArray = await generateRondaSchedule({
      month,
      participants: participants,
      coordinator,
    });

    // The client component still expects a JSON string to parse.
    const scheduleJsonString = JSON.stringify(scheduleArray);

    return { message: 'Schedule generated successfully.', schedule: scheduleJsonString };
  } catch (error) {
    console.error(error);
    return { message: 'Failed to generate schedule. Please try again.' };
  }
}

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
