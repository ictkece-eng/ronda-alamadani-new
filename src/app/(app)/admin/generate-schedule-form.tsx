'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useMemo, useEffect } from 'react';
import { Loader2, Wand2, Save, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import type { Warga, ScheduleRequest, RondaSchedule } from '@/lib/types';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Combobox } from '@/components/ui/combobox';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';

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
  const [hasExistingSchedule, setHasExistingSchedule] = useState(false);


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

  const schedulesQuery = useMemoFirebase(
    () => (firestore ? collectionGroup(firestore, 'rondaSchedules') : null),
    [firestore]
  );
  const { data: allSchedules, isLoading: isSchedulesLoading } = useCollection<RondaSchedule>(schedulesQuery);
  
  const isLoading = isUsersLoading || isRequestsLoading || isSchedulesLoading;

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
  
  const participantOptions = useMemo(() => {
    return availableParticipants.map(p => ({ value: p, label: p }));
  }, [availableParticipants]);


  const usersMap = useMemo(() => {
    if (!users) return new Map<string, Warga>();
    return new Map(users.map((user) => [user.name.toLowerCase(), user]));
  }, [users]);
  
  const usersIdMap = useMemo(() => {
    if (!users) return new Map<string, Warga>();
    return new Map(users.map((user) => [user.id, user]));
  }, [users]);

  // Load existing schedule when month changes
  useEffect(() => {
    // Do nothing if data is not ready
    if (!month || !allSchedules || !usersIdMap.size) {
        setGeneratedSchedule(null);
        setHasExistingSchedule(false);
        return;
    }

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
    const endDate = new Date(Date.UTC(year, monthNum, 1));

    // Filter schedules for the selected month
    const schedulesForMonth = allSchedules.filter(schedule => {
        const scheduleDate = new Date(schedule.date);
        return scheduleDate >= startDate && scheduleDate < endDate;
    });

    if (schedulesForMonth.length > 0) {
        // Group by date
        const groupedByDate = schedulesForMonth.reduce((acc, schedule) => {
            const dateStr = new Date(schedule.date).toISOString().split('T')[0];
            if (!acc[dateStr]) {
                acc[dateStr] = [];
            }
            const userName = usersIdMap.get(schedule.userId)?.name;
            if (userName && !acc[dateStr].includes(userName)) {
                acc[dateStr].push(userName);
            }
            return acc;
        }, {} as Record<string, string[]>);

        // Convert to GeneratedSchedule[] format
        const loadedSchedule: GeneratedSchedule[] = Object.entries(groupedByDate).map(([date, participants]) => ({
            date: date,
            participants: participants.sort(),
        })).sort((a, b) => a.date.localeCompare(b.date));

        setGeneratedSchedule(loadedSchedule);
        setHasExistingSchedule(true);
        toast({
            title: "Jadwal Ditemukan",
            description: `Jadwal untuk bulan ${format(startDate, 'MMMM yyyy', { locale: idLocale })} telah dimuat dari database.`,
        });
    } else {
        setGeneratedSchedule(null);
        setHasExistingSchedule(false);
    }
  }, [month, allSchedules, usersIdMap, toast]);


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

                    let dayAlreadyHasTeacher = dailyAssignments[day].some(name => !!usersMap.get(name.toLowerCase())?.isTeacher);

                    for (let i = 0; i < needed; i++) {
                        if (candidates.length === 0) break;

                        candidates.sort((a, b) => {
                            const userA = usersMap.get(a.toLowerCase());
                            const userB = usersMap.get(b.toLowerCase());
                            
                            const isATeacher = !!userA?.isTeacher;
                            const isBTeacher = !!userB?.isTeacher;

                            if (dayAlreadyHasTeacher) {
                                if (isATeacher && !isBTeacher) return 1;
                                if (!isATeacher && isBTeacher) return -1;
                            }
                            
                            // --- Teacher Preference Score ---
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

                        if (bestCandidateUser?.isTeacher) {
                            dayAlreadyHasTeacher = true;
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
            setHasExistingSchedule(newSchedule.length > 0);
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

  const handleParticipantChange = (dayIndex: number, participantIndex: number, newParticipant: string) => {
    if (!newParticipant) return; // Don't allow clearing a slot

    setGeneratedSchedule(currentSchedule => {
        if (!currentSchedule) return null;

        const newSchedule = [...currentSchedule];
        const targetDay = { ...newSchedule[dayIndex] };
        const newParticipants = [...targetDay.participants];
        
        // Check for duplicates on the same day
        if (newParticipants.filter((p, i) => i !== participantIndex).includes(newParticipant)) {
            toast({
                title: "Duplicate Participant",
                description: `${newParticipant} is already scheduled for this day.`,
                variant: "destructive",
            });
            return currentSchedule; // Don't update state
        }

        newParticipants[participantIndex] = newParticipant;
        targetDay.participants = newParticipants.sort(); // Keep it sorted
        newSchedule[dayIndex] = targetDay;
        
        return newSchedule;
    });
  };


  const handleSaveSchedule = async () => {
    if (!generatedSchedule || !firestore || !usersMap.size || !month) {
        toast({ title: 'Error', description: 'No schedule to save, user data not loaded, or month not selected.', variant: 'destructive'});
        return;
    }

    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);

        // --- 1. Filter existing entries for the month from our loaded data (avoiding collectionGroup with where) ---
        if (allSchedules) {
            const [year, monthNum] = month.split('-').map(Number);
            const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
            const endDate = new Date(Date.UTC(year, monthNum, 1));
            
            const toDelete = allSchedules.filter(s => {
                const d = new Date(s.date);
                return d >= startDate && d < endDate;
            });

            toDelete.forEach(s => {
                const ref = doc(firestore, 'users', s.userId, 'rondaSchedules', s.id);
                batch.delete(ref);
            });
        }

        // --- 2. Add new entries from the generatedSchedule state ---
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
        setHasExistingSchedule(true);
    } catch (error) {
        console.error("Error saving schedule:", error);
        toast({ title: 'Save Failed', description: 'Could not save the schedule to the database.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleClearSchedule = async () => {
    if (!month || !firestore) {
        toast({ title: "Error", description: "Please select a month to clear.", variant: "destructive" });
        return;
    }

    setIsClearing(true);
    try {
        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
        const endDate = new Date(Date.UTC(year, monthNum, 1));

        const batch = writeBatch(firestore);

        // Filter dari data yang sudah di-load di memori (menghindari error index)
        const toDelete = allSchedules?.filter(s => {
            const d = new Date(s.date);
            return d >= startDate && d < endDate;
        }) || [];

        const deletedCount = toDelete.length;

        if (deletedCount === 0) {
            toast({ title: "No data", description: "No schedule data found for the selected month to clear." });
            setIsClearing(false);
            return;
        }

        toDelete.forEach(s => {
            const ref = doc(firestore, 'users', s.userId, 'rondaSchedules', s.id);
            batch.delete(ref);
        });

        await batch.commit();
        toast({
            title: "Success!",
            description: `Successfully deleted ${deletedCount} schedule entries for ${month}.`,
        });
        setGeneratedSchedule(null);
        setHasExistingSchedule(false);
        
    } catch (error) {
        console.error("Error clearing schedule:", error);
        toast({ title: 'Clear Failed', description: 'Could not clear the schedule from the database.', variant: 'destructive' });
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
          <Button onClick={handleGenerateClick} disabled={isGenerating || isLoading || isClearing || !month} className="flex-grow sm:flex-grow-0">
            {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {hasExistingSchedule ? 'Regenerate' : 'Generate'} Schedule
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isClearing || isLoading || !month || !hasExistingSchedule} className="flex-grow sm:flex-grow-0">
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
            <p className="text-sm text-muted-foreground">Loading user and schedule data...</p>
        )}
        {!isLoading && !month && (
             <Alert>
                <Wand2 className="h-4 w-4" />
                <AlertTitle>Select a Month</AlertTitle>
                <AlertDescription>
                Please select a month to view, generate, or manage a schedule.
                </AlertDescription>
            </Alert>
        )}
        {!isLoading && month && (availableParticipants.length < 3) && (
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
              <CardTitle>Generated Schedule (Editable)</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Participants</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {generatedSchedule.map((day, dayIndex) => (
                            <TableRow key={day.date}>
                                <TableCell className="font-medium whitespace-nowrap">
                                    {format(new Date(day.date + 'T00:00:00Z'), 'EEEE, dd MMM', { locale: idLocale })}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-2">
                                        {day.participants.map((participant, participantIndex) => (
                                            <Combobox
                                                key={`${day.date}-${participantIndex}`}
                                                value={participant}
                                                onValueChange={(newValue) => {
                                                  handleParticipantChange(dayIndex, participantIndex, newValue)
                                                }}
                                                options={participantOptions}
                                                placeholder="Pilih Warga"
                                                searchPlaceholder="Cari warga..."
                                                emptyPlaceholder="Warga tidak ditemukan."
                                                className="w-[150px]"
                                            />
                                        ))}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter>
                 <Button onClick={handleSaveSchedule} disabled={isSaving || isLoading} className="w-full">
                    {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                    Save Schedule to Database
                </Button>
            </CardFooter>
          </Card>
        ) : ( month && !isLoading &&
             <Alert>
                <Wand2 className="h-4 w-4" />
                <AlertTitle>Awaiting Generation</AlertTitle>
                <AlertDescription>
                {hasExistingSchedule ? 'Loading schedule...' : "No schedule exists for this month. Click 'Generate' to create a fair and balanced ronda schedule."}
                </AlertDescription>
            </Alert>
        )}
      </div>
    </div>
  );
}
