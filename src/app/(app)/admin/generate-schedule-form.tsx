'use client';

import { useFormStatus } from 'react-dom';
import { handleGenerateSchedule } from '@/lib/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useEffect, useState, useActionState } from 'react';
import { Loader2, Wand2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const initialState = {
  message: '',
  schedule: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? <Loader2 className="animate-spin" /> : <Wand2 />}
      Generate Schedule
    </Button>
  );
}

export function GenerateScheduleForm() {
  const [state, formAction] = useActionState(handleGenerateSchedule, initialState);
  const [generatedSchedule, setGeneratedSchedule] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (state?.schedule) {
      setGeneratedSchedule(JSON.stringify(JSON.parse(state.schedule), null, 2));
      toast({
        title: "Success!",
        description: state.message,
      });
    } else if (state?.message && !state.errors) {
       toast({
        title: "Error",
        description: state.message,
        variant: "destructive",
      });
    }
  }, [state, toast]);

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
        {generatedSchedule && (
          <Card className="bg-secondary">
            <CardHeader>
              <CardTitle>Generated Schedule (JSON)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-md bg-background text-sm overflow-auto max-h-[400px]">
                <code>
                    {generatedSchedule}
                </code>
              </pre>
            </CardContent>
          </Card>
        )}
        {!generatedSchedule && (
             <Alert>
                <Wand2 className="h-4 w-4" />
                <AlertTitle>Awaiting Generation</AlertTitle>
                <AlertDescription>
                The generated schedule will appear here in JSON format once you submit the form.
                </AlertDescription>
            </Alert>
        )}
      </div>
    </div>
  );
}
