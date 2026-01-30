'use client';

import { useFormStatus } from 'react-dom';
import { handleGenerateSchedule } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useEffect, useState, useActionState, useMemo } from 'react';
import { Loader2, Wand2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Warga } from '@/lib/types';
import { collection, writeBatch, doc } from 'firebase/firestore';

const initialState = {
  message: '',
  schedule: null,
};

type GeneratedSchedule = {
  date: string;
  participants: string[];
  rounds: string[];
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-auto">
      {pending ? <Loader2 className="animate-spin" /> : <Wand2 />}
      Generate Schedule
    </Button>
  );
}

export function GenerateScheduleForm() {
  const [state, formAction] = useActionState(handleGenerateSchedule, initialState);
  const [generatedSchedule, setGeneratedSchedule] = useState<GeneratedSchedule[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();
  const firestore = useFirestore();

  const usersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersCollection);

  const usersMap = useMemo(() => {
    if (!users) return new Map<string, Warga>();
    return new Map(users.map((user) => [user.name.toLowerCase(), user]));
  }, [users]);


  useEffect(() => {
    if (state?.schedule) {
      const parsedSchedule = JSON.parse(state.schedule);
      setGeneratedSchedule(parsedSchedule);
      toast({
        title: "Success!",
        description: "Schedule generated. Review the JSON and click 'Save' to apply it.",
      });
    } else if (state?.message && !state.errors) {
       toast({
        title: "Error",
        description: state.message,
        variant: "destructive",
      });
    }
  }, [state, toast]);

  const handleSaveSchedule = async () => {
    if (!generatedSchedule || !firestore || !usersMap.size) {
        toast({ title: 'Error', description: 'No schedule to save or user data not loaded.', variant: 'destructive'});
        return;
    }

    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);

        for (const day of generatedSchedule) {
            const scheduleDate = new Date(day.date);
            if (isNaN(scheduleDate.getTime())) continue;

            for (const participantName of day.participants) {
                const user = usersMap.get(participantName.toLowerCase());
                if (user) {
                    const newScheduleRef = doc(collection(firestore, 'users', user.id, 'rondaSchedules'));
                    const scheduleData = {
                        id: newScheduleRef.id,
                        userId: user.id,
                        date: scheduleDate.toISOString(),
                        startTime: '22:00',
                        endTime: '06:00',
                    };
                    batch.set(newScheduleRef, scheduleData);
                }
            }
        }
        
        await batch.commit();
        toast({ title: 'Success!', description: 'Ronda schedule has been saved to the database.' });
        setGeneratedSchedule(null); // Clear after saving
    } catch (error) {
        console.error("Error saving schedule:", error);
        toast({ title: 'Save Failed', description: 'Could not save the schedule to the database.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  };


  return (
    <div className="grid md:grid-cols-2 gap-8">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="month">Month (YYYY-MM)</Label>
          <Input id="month" name="month" type="month" required />
          {state.errors?.month && <p className="text-destructive text-sm mt-1">{state.errors.month[0]}</p>}
        </div>
        <div>
          <Label htmlFor="participants">Participants (comma-separated)</Label>
          <Textarea id="participants" name="participants" placeholder="e.g. Budi, Joko, Agus" required />
          {state.errors?.participants && <p className="text-destructive text-sm mt-1">{state.errors.participants[0]}</p>}
        </div>
        <div>
          <Label htmlFor="coordinator">Coordinator</Label>
          <Input id="coordinator" name="coordinator" placeholder="e.g. Pak RT" required />
          {state.errors?.coordinator && <p className="text-destructive text-sm mt-1">{state.errors.coordinator[0]}</p>}
        </div>
        <div>
          <Label htmlFor="roundsPerNight">Rounds Per Night</Label>
          <Input id="roundsPerNight" name="roundsPerNight" type="number" min="1" defaultValue="2" required />
           {state.errors?.roundsPerNight && <p className="text-destructive text-sm mt-1">{state.errors.roundsPerNight[0]}</p>}
        </div>
        <SubmitButton />
      </form>

      <div>
        {generatedSchedule ? (
          <Card className="bg-secondary">
            <CardHeader>
              <CardTitle>Generated Schedule (JSON)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-md bg-background text-sm overflow-auto max-h-[340px]">
                <code>
                    {JSON.stringify(generatedSchedule, null, 2)}
                </code>
              </pre>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSaveSchedule} disabled={isSaving || isUsersLoading} className="w-full">
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                    Save Schedule to Database
                </Button>
            </CardFooter>
          </Card>
        ) : (
             <Alert>
                <Wand2 className="h-4 w-4" />
                <AlertTitle>Awaiting Generation</AlertTitle>
                <AlertDescription>
                The generated schedule will appear here. After reviewing, you can save it to the database.
                </AlertDescription>
            </Alert>
        )}
      </div>
    </div>
  );
}
