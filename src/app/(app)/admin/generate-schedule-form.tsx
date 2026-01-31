'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useMemo } from 'react';
import { Loader2, Wand2, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Warga, ScheduleRequest } from '@/lib/types';
import { collection, writeBatch, doc, query, collectionGroup, where, getDocs } from 'firebase/firestore';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type GeneratedSchedule = {
  date: string;
  participants: string[];
};

export function GenerateScheduleForm() {
  const [month, setMonth] = useState('');
  const [generatedSchedule, setGeneratedSchedule] = useState<GeneratedSchedule[] | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const { toast } = useToast();
  const firestore = useFirestore();

  const usersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersCollection);

  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(collectionGroup(firestore, 'scheduleRequests')) : null),
    [firestore]
  );
  const { data: requests, isLoading: isRequestsLoading } = useCollection<ScheduleRequest>(requestsQuery);
  
  const isLoading = isUsersLoading || isRequestsLoading;

  const availableParticipants = useMemo(() => {
    if (!users) {
        return [];
    }
    const participantNames = users
      .filter(u => 
        u.role === 'user' || 
        u.role === 'coordinator' ||
        (u.role === 'backup' && u.includeInSchedule === true)
      )
      .map(u => u.name);
      
    const uniqueNames = new Map<string, string>();
    for (const name of participantNames) {
        uniqueNames.set(name.toLowerCase(), name);
    }
    return Array.from(uniqueNames.values());
  }, [users]);


  const usersMap = useMemo(() => {
    if (!users) return new Map<string, Warga>();
    return new Map(users.map((user) => [user.name.toLowerCase(), user]));
  }, [users]);
  
  const usersIdMap = useMemo(() => {
    if (!users) return new Map<string, Warga>();
    return new Map(users.map((user) => [user.id, user]));
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

    // Deterministic schedule generation
    setTimeout(() => {
        try {
            const [year, monthNum] = month.split('-').map(Number);
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            const newSchedule: GeneratedSchedule[] = [];

            // --- Initialization ---
            const shiftCounts = new Map<string, number>(availableParticipants.map(p => [p, 0]));
            const dailyAssignments: string[][] = Array.from({ length: daysInMonth }, () => []);

            // --- 1. Pre-assign based on Approved Requests ---
            const approvedRequestsForMonth = requests?.filter(req => {
                if (req.status !== 'approved') return false;
                const reqDate = new Date(req.requestedScheduleDate);
                return reqDate.getUTCFullYear() === year && reqDate.getUTCMonth() + 1 === monthNum;
            }) ?? [];

            approvedRequestsForMonth.forEach(req => {
                const user = usersIdMap.get(req.userId);
                if (!user) return; // User might have been deleted

                const reqDate = new Date(req.requestedScheduleDate);
                const dayIndex = reqDate.getUTCDate() - 1;

                if (dayIndex >= 0 && dayIndex < daysInMonth && availableParticipants.includes(user.name) && !dailyAssignments[dayIndex].map(name => name.toLowerCase()).includes(user.name.toLowerCase())) {
                    // Cap assignments at 3 per day
                    if (dailyAssignments[dayIndex].length < 3) {
                        dailyAssignments[dayIndex].push(user.name);
                        shiftCounts.set(user.name, (shiftCounts.get(user.name) ?? 0) + 1);
                    }
                }
            });


            // --- 2. Fill remaining slots fairly and avoid block clashes ---
            for (let day = 0; day < daysInMonth; day++) {
                const currentDate = new Date(Date.UTC(year, monthNum - 1, day + 1));
                const dayOfWeek = currentDate.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat
                const isWeekendShift = dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday
                const targetParticipants = (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) ? 3 : 2;
                
                let needed = targetParticipants - dailyAssignments[day].length;

                if (needed > 0) {
                    let candidates = [...availableParticipants].filter(p => !dailyAssignments[day].map(name => name.toLowerCase()).includes(p.toLowerCase()));
                    
                    const assignedBlocksThisDay = new Set(
                        dailyAssignments[day].map(name => {
                            const user = usersMap.get(name.toLowerCase());
                            return user?.address ? user.address.charAt(0).toUpperCase() : null;
                        }).filter(Boolean)
                    );

                    for (let i = 0; i < needed; i++) {
                        if (candidates.length === 0) break;

                        candidates.sort((a, b) => {
                            const userA = usersMap.get(a.toLowerCase());
                            const userB = usersMap.get(b.toLowerCase());
                            
                            // --- Teacher Preference Score ---
                            const isATeacher = !!userA?.isTeacher;
                            const isBTeacher = !!userB?.isTeacher;
                            let teacherScoreA = 0;
                            let teacherScoreB = 0;

                            if (isWeekendShift) {
                                if (!isATeacher) teacherScoreA = 1; // Non-teacher gets penalty
                                if (!isBTeacher) teacherScoreB = 1;
                            } else {
                                if (isATeacher) teacherScoreA = 1; // Teacher gets penalty on weekdays
                                if (isBTeacher) teacherScoreB = 1;
                            }

                            if (teacherScoreA !== teacherScoreB) {
                                return teacherScoreA - teacherScoreB;
                            }

                            // --- Block Clash Score ---
                            const blockA = userA?.address ? userA.address.charAt(0).toUpperCase() : null;
                            const blockB = userB?.address ? userB.address.charAt(0).toUpperCase() : null;
                            const scoreA_block = (blockA && assignedBlocksThisDay.has(blockA)) ? 1 : 0;
                            const scoreB_block = (blockB && assignedBlocksThisDay.has(blockB)) ? 1 : 0;
                            if (scoreA_block !== scoreB_block) {
                                return scoreA_block - scoreB_block;
                            }

                            // --- Previous Day Penalty ---
                            const wasAOnYesterday = day > 0 && dailyAssignments[day - 1].map(n => n.toLowerCase()).includes(a.toLowerCase());
                            const wasBOnYesterday = day > 0 && dailyAssignments[day - 1].map(n => n.toLowerCase()).includes(b.toLowerCase());
                            if (wasAOnYesterday && !wasBOnYesterday) return 1; // Penalize A
                            if (!wasAOnYesterday && wasBOnYesterday) return -1; // Penalize B

                            // --- Shift Count Score ---
                            const countA = shiftCounts.get(a) ?? 0;
                            const countB = shiftCounts.get(b) ?? 0;
                            if (countA !== countB) {
                                return countA - countB;
                            }

                            // --- Randomizer ---
                            return Math.random() - 0.5;
                        });
                        
                        const bestCandidate = candidates.shift();
                        if (!bestCandidate) continue; 

                        dailyAssignments[day].push(bestCandidate);
                        shiftCounts.set(bestCandidate, (shiftCounts.get(bestCandidate) ?? 0) + 1);

                        const bestCandidateUser = usersMap.get(bestCandidate.toLowerCase());
                        const bestCandidateBlock = bestCandidateUser?.address ? bestCandidateUser.address.charAt(0).toUpperCase() : null;
                        if (bestCandidateBlock) {
                            assignedBlocksThisDay.add(bestCandidateBlock);
                        }
                    }
                }
            }
            
            // --- 3. Final Assembly ---
            for (let day = 0; day < daysInMonth; day++) {
                const date = new Date(Date.UTC(year, monthNum - 1, day + 1));
                newSchedule.push({
                    date: date.toISOString().split('T')[0],
                    participants: dailyAssignments[day].sort(), // Sort names alphabetically for consistency
                });
            }

            setGeneratedSchedule(newSchedule);
            toast({
                title: "Success!",
                description: "Schedule generated, incorporating approved requests and avoiding block clashes.",
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
    }, 100);
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
            const utcDate = new Date(day.date + 'T00:00:00Z');
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

  const handleClearSchedule = async () => {
    if (!month || !firestore || !users) {
        toast({ title: "Error", description: "Please select a month to clear or user data is not loaded.", variant: "destructive" });
        return;
    }

    setIsClearing(true);
    try {
        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
        const endDate = new Date(Date.UTC(year, monthNum, 1));

        const batch = writeBatch(firestore);
        let deletedCount = 0;

        for (const user of users) {
            const userSchedulesRef = collection(firestore, 'users', user.id, 'rondaSchedules');
            const schedulesToDeleteQuery = query(
                userSchedulesRef,
                where('date', '>=', startDate.toISOString()),
                where('date', '<', endDate.toISOString())
            );

            const querySnapshot = await getDocs(schedulesToDeleteQuery);
            if (!querySnapshot.empty) {
                querySnapshot.forEach(doc => {
                    batch.delete(doc.ref);
                    deletedCount++;
                });
            }
        }

        if (deletedCount === 0) {
            toast({ title: "No data", description: "No schedule data found for the selected month to clear." });
            setIsClearing(false);
            return;
        }

        await batch.commit();
        toast({
            title: "Success!",
            description: `Successfully deleted ${deletedCount} schedule entries for ${month}.`,
        });
        
    } catch (error) {
        console.error("Error clearing schedule:", error);
        toast({ title: 'Clear Failed', description: 'Could not clear the schedule from the database. This might be a permission issue.', variant: 'destructive' });
    } finally {
        setIsClearing(false);
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
            disabled={isLoading || isGenerating || isClearing}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleGenerateClick} disabled={isGenerating || isLoading || isClearing} className="flex-grow sm:flex-grow-0">
            {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />}
            Generate Schedule
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isClearing || isLoading || !month} className="flex-grow sm:flex-grow-0">
                    {isClearing ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    Clear Schedule
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete all schedule entries for <strong>{month}</strong>. Are you sure you want to proceed?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearSchedule}>Continue</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {isLoading && (
            <p className="text-sm text-muted-foreground">Loading user and request data...</p>
        )}
        {!isLoading && (availableParticipants.length < 3) && (
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
                 <Button onClick={handleSaveSchedule} disabled={isSaving || isLoading} className="w-full">
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
