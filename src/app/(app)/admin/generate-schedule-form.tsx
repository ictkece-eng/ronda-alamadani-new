'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useMemo } from 'react';
import { Loader2, Wand2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Warga } from '@/lib/types';
import { collection, writeBatch, doc } from 'firebase/firestore';

type GeneratedSchedule = {
  date: string;
  participants: string[];
};

export function GenerateScheduleForm() {
  const [month, setMonth] = useState('');
  const [generatedSchedule, setGeneratedSchedule] = useState<GeneratedSchedule[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const { toast } = useToast();
  const firestore = useFirestore();

  const usersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersCollection);

  const availableParticipants = useMemo(() => {
    if (!users) {
        return [];
    }
    return users
      .filter(u => 
        u.role === 'user' || 
        u.role === 'coordinator' ||
        (u.role === 'backup' && u.includeInSchedule === true)
      )
      .map(u => u.name);
  }, [users]);


  const usersMap = useMemo(() => {
    if (!users) return new Map<string, Warga>();
    return new Map(users.map((user) => [user.name.toLowerCase(), user]));
  }, [users]);

  const handleGenerateClick = () => {
    if (!month) {
        toast({ title: "Error", description: "Please select a month.", variant: "destructive" });
        return;
    }
    
    if (availableParticipants.length < 3) {
        toast({ title: "Error", description: "Not enough participants. Need at least 3 users with 'user', 'coordinator', or 'backup (included)' roles to generate a schedule.", variant: "destructive" });
        return;
    }

    setIsGenerating(true);
    setGeneratedSchedule(null);

    // Deterministic schedule generation without AI
    setTimeout(() => {
        try {
            const [year, monthNum] = month.split('-').map(Number);
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            const newSchedule: GeneratedSchedule[] = [];

            const shiftCounts = new Map<string, number>(availableParticipants.map(p => [p, 0]));
            const dailyAssignments: string[][] = Array.from({ length: daysInMonth }, () => []);

            // --- First Pass: Assign 2 people per night, prioritizing fairness ---
            for (let day = 0; day < daysInMonth; day++) {
                const sortedWarga = [...availableParticipants].sort((a, b) => {
                    const countA = shiftCounts.get(a) ?? 0;
                    const countB = shiftCounts.get(b) ?? 0;
                    if (countA !== countB) return countA - countB;
                    return Math.random() - 0.5; // Randomize to break ties
                });

                const p1 = sortedWarga[0];
                const p2 = sortedWarga[1];

                dailyAssignments[day].push(p1, p2);
                shiftCounts.set(p1, (shiftCounts.get(p1) ?? 0) + 1);
                shiftCounts.set(p2, (shiftCounts.get(p2) ?? 0) + 1);
            }

            // --- Second Pass: Add a 3rd person to weekend shifts for extra coverage ---
            for (let day = 0; day < daysInMonth; day++) {
                const currentDate = new Date(year, monthNum - 1, day + 1);
                const dayOfWeek = currentDate.getDay(); // 0=Sun, 5=Fri, 6=Sat

                const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;

                if (isWeekend) {
                     const sortedWarga = [...availableParticipants].sort((a, b) => {
                         const countA = shiftCounts.get(a) ?? 0;
                         const countB = shiftCounts.get(b) ?? 0;
                         if (countA !== countB) return countA - countB;
                         return Math.random() - 0.5;
                    });
                    
                    const thirdPerson = sortedWarga.find(p => !dailyAssignments[day].includes(p));

                    if (thirdPerson) {
                        dailyAssignments[day].push(thirdPerson);
                        shiftCounts.set(thirdPerson, (shiftCounts.get(thirdPerson) ?? 0) + 1);
                    }
                }
            }
            
            // --- Final Assembly ---
            for (let day = 0; day < daysInMonth; day++) {
                const date = new Date(year, monthNum - 1, day + 1);
                newSchedule.push({
                    date: date.toISOString().split('T')[0],
                    participants: dailyAssignments[day].sort(), // Sort names alphabetically for consistency
                });
            }

            setGeneratedSchedule(newSchedule);
            toast({
                title: "Success!",
                description: "Schedule generated locally. Review the JSON and click 'Save'.",
            });

        } catch (e) {
            console.error("Failed to generate schedule locally:", e);
            toast({
                title: "Error",
                description: "Could not generate the schedule. Please check the console for details.",
                variant: "destructive",
            });
        } finally {
            setIsGenerating(false);
        }
    }, 100); // Simulate async operation to allow UI to show loader
  };


  const handleSaveSchedule = async () => {
    if (!generatedSchedule || !firestore || !usersMap.size) {
        toast({ title: 'Error', description: 'No schedule to save or user data not loaded.', variant: 'destructive'});
        return;
    }

    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);

        for (const day of generatedSchedule) {
            if (!day.date || !day.participants) continue; 
            const scheduleDate = new Date(day.date);
            // Adjust for timezone offset to prevent date shifting
            const utcDate = new Date(scheduleDate.getTime() + scheduleDate.getTimezoneOffset() * 60000);
            if (isNaN(utcDate.getTime())) continue;

            for (const participantName of day.participants) {
                const user = usersMap.get(participantName.toLowerCase());
                if (user) {
                    const newScheduleRef = doc(collection(firestore, 'users', user.id, 'rondaSchedules'));
                    const scheduleData = {
                        id: newScheduleRef.id,
                        userId: user.id,
                        date: utcDate.toISOString(),
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
      <div className="space-y-4">
        <div>
          <Label htmlFor="month">Month (YYYY-MM)</Label>
          <Input 
            id="month" 
            name="month" 
            type="month" 
            required 
            disabled={isUsersLoading || isGenerating}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        
        <Button onClick={handleGenerateClick} disabled={isGenerating || isUsersLoading} className="w-full sm:w-auto">
          {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />}
          Generate Schedule
        </Button>

        {isUsersLoading && (
            <p className="text-sm text-muted-foreground">Loading user data...</p>
        )}
        {!isUsersLoading && (availableParticipants.length < 3) && (
            <Alert variant="destructive">
                <AlertTitle>Missing Data</AlertTitle>
                <AlertDescription>
                Not enough participants. Please ensure there are at least 3 users with roles 'user', 'coordinator', or 'backup' (with 'Include in Schedule' checked).
                </AlertDescription>
            </Alert>
        )}
      </div>

      <div>
        {generatedSchedule ? (
          <Card className="bg-secondary">
            <CardHeader>
              <CardTitle>Generated Schedule (JSON)</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="p-4 rounded-md bg-background text-sm overflow-auto max-h-[400px]">
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
                Select a month and click 'Generate' to create a fair and balanced ronda schedule. The generated schedule will appear here for review before saving.
                </AlertDescription>
            </Alert>
        )}
      </div>
    </div>
  );
}
