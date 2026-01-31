'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useUser, useFirestore, addDocumentNonBlocking } from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const requestSchema = z.object({
  requestedDate: z.string().min(1, 'Requested date is required'),
  reason: z.string().min(1, 'Reason is required').max(200, 'Reason is too long'),
});

type RequestFormValues = z.infer<typeof requestSchema>;

export function RequestForm() {
  const { toast } = useToast();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
        requestedDate: '',
        reason: '',
    }
  });

  const { formState, handleSubmit, reset } = form;

  const onSubmit = async (values: RequestFormValues) => {
    if (!user || !firestore) {
        toast({ title: 'Error', description: 'You must be logged in to submit a request.', variant: 'destructive'});
        return;
    }

    try {
        const requestsCol = collection(firestore, 'users', user.uid, 'scheduleRequests');
        const newRequestRef = doc(requestsCol);

        const newRequestData = {
            id: newRequestRef.id,
            userId: user.uid,
            requestDate: new Date().toISOString(),
            requestedScheduleDate: new Date(values.requestedDate).toISOString(),
            reason: values.reason,
            status: 'pending',
        };

        addDocumentNonBlocking(requestsCol, newRequestData);

        toast({
            title: 'Request Submitted',
            description: 'Your schedule change request has been sent for approval.',
        });
        reset();

    } catch (error) {
        console.error("Error submitting request:", error);
        toast({ title: 'Submission Failed', description: 'Could not submit your request. Please try again.', variant: 'destructive'});
    }
  };

  if (isUserLoading) {
    return <div className='flex justify-center'><Loader2 className='animate-spin'/></div>
  }

  if (!user) {
    return <p className='text-center text-muted-foreground'>Please log in to request a schedule change.</p>
  }


  return (
    <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField
                control={form.control}
                name="requestedDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Requested Change Date</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Reason for Change</FormLabel>
                        <FormControl>
                            <Textarea placeholder='e.g., "Ada acara keluarga"' {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
            <Button type="submit" disabled={formState.isSubmitting || isUserLoading}>
                {formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Request
            </Button>
        </form>
    </Form>
  );
}
