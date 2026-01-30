'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { useUser, useFirestore, addDocumentNonBlocking, useMemoFirebase } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const requestSchema = z.object({
  currentDate: z.string().min(1, 'Current date is required'),
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
        currentDate: '',
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
        // Find the schedule ID for the current date
        const startOfDay = new Date(values.currentDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(values.currentDate);
        endOfDay.setHours(23, 59, 59, 999);

        const schedulesRef = collection(firestore, 'users', user.uid, 'rondaSchedules');
        const q = query(
            schedulesRef, 
            where('date', '>=', startOfDay.toISOString()), 
            where('date', '<=', endOfDay.toISOString()),
            limit(1)
        );
        
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            toast({ title: 'Error', description: `No schedule found for you on ${values.currentDate}. Please check the date.`, variant: 'destructive'});
            return;
        }

        const rondaSchedule = querySnapshot.docs[0];
        const rondaScheduleId = rondaSchedule.id;
        
        // Now create the request document
        const requestsCol = collection(firestore, 'users', user.uid, 'scheduleRequests');
        const newRequestRef = doc(requestsCol);

        const newRequestData = {
            id: newRequestRef.id,
            userId: user.uid,
            rondaScheduleId: rondaScheduleId,
            requestDate: new Date().toISOString(),
            currentScheduleDate: new Date(values.currentDate).toISOString(),
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
                name="currentDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Current Schedule Date</FormLabel>
                        <FormControl>
                            <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
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
