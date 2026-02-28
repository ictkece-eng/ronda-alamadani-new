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
import { collection, writeBatch, doc, query, collectionGroup } from 'firebase/firestore';
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

  // 1. Get unique list of residents who should be included in the schedule
  const availableParticipants = useMemo(() => {
    if (!users) return [];
    
    const uniqueParticipants = new Map<string, Warga>();
    users.forEach(u => {
      if (!u.name) return;
      const normalizedName = u.name.trim().toLowerCase();
      
      if (
        u.role === 'user' || 
        u.role === 'coordinator' ||
        (u.role === 'backup' && u.includeInSchedule === true)
      ) {
        if (!uniqueParticipants.has(normalizedName)) {
            uniqueParticipants.set(normalizedName, { ...u, name: u.name.trim() });
        }
      }
    });
    
    return Array.from(uniqueParticipants.values());
  }, [users]);
  
  const participantOptions = useMemo(() => {
    return availableParticipants.map(p => ({ value: p.name, label: p.name }));
  }, [availableParticipants]);


  const usersMap = useMemo(() => {
    const map = new Map<string, Warga>();
    availableParticipants.forEach(p => map.set(p.name.toLowerCase().trim(), p));
    return map;
  }, [availableParticipants]);
  
  const usersIdMap = useMemo(() => {
    if (!users) return new Map<string, Warga>();
    return new Map(users.map((user) => [user.id, user]));
  }, [users]);

  // Load existing schedule when month changes
  useEffect(() => {
    if (!month || !allSchedules || !usersIdMap.size) {
        setGeneratedSchedule(null);
        setHasExistingSchedule(false);
        return;
    }

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
    const endDate = new Date(Date.UTC(year, monthNum, 1));

    const schedulesForMonth = allSchedules.filter(schedule => {
        const scheduleDate = new Date(schedule.date);
        return scheduleDate >= startDate && scheduleDate < endDate;
    });

    if (schedulesForMonth.length > 0) {
        const groupedByDate = schedulesForMonth.reduce((acc, schedule) => {
            const dateStr = new Date(schedule.date).toISOString().split('T')[0];
            if (!acc[dateStr]) acc[dateStr] = [];
            const user = usersIdMap.get(schedule.userId);
            if (user) {
                const name = user.name.trim();
                if (!acc[dateStr].includes(name)) {
                    acc[dateStr].push(name);
                }
            }
            return acc;
        }, {} as Record<string, string[]>);

        const loadedSchedule: GeneratedSchedule[] = Object.entries(groupedByDate).map(([date, participants]) => ({
            date,
            participants: participants.sort(),
        })).sort((a, b) => a.date.localeCompare(b.date));

        setGeneratedSchedule(loadedSchedule);
        setHasExistingSchedule(true);
    } else {
        setGeneratedSchedule(null);
        setHasExistingSchedule(false);
    }
  }, [month, allSchedules, usersIdMap]);


  const handleGenerateClick = () => {
    if (!month) {
        toast({ title: "Error", description: "Pilih bulan terlebih dahulu.", variant: "destructive" });
        return;
    }
    
    const residentCount = availableParticipants.length;
    if (residentCount < 1) {
        toast({ title: "Error", description: "Tidak ada warga untuk dijadwalkan.", variant: "destructive" });
        return;
    }

    setIsGenerating(true);
    setGeneratedSchedule(null);

    setTimeout(() => {
        try {
            const [year, monthNum] = month.split('-').map(Number);
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            
            // --- 1. Determine Daily Capacity to match EXACT resident count ---
            // Total slots must equal residents to avoid doubles.
            const dailyCapacities = Array(daysInMonth).fill(2); // Base 2 per night
            let currentTotalSlots = daysInMonth * 2;

            if (currentTotalSlots < residentCount) {
                // Add slots to weekends (Fri, Sat, Sun) first
                const weekendPriority = [5, 6, 0]; // Friday, Saturday, Sunday
                for (const dayOfWeek of weekendPriority) {
                    for (let d = 0; d < daysInMonth; d++) {
                        if (currentTotalSlots >= residentCount) break;
                        const date = new Date(Date.UTC(year, monthNum - 1, d + 1));
                        if (date.getUTCDay() === dayOfWeek) {
                            dailyCapacities[d]++;
                            currentTotalSlots++;
                        }
                    }
                    if (currentTotalSlots >= residentCount) break;
                }
                // If still not enough slots, add to any day
                for (let d = 0; d < daysInMonth; d++) {
                    if (currentTotalSlots >= residentCount) break;
                    if (dailyCapacities[d] < 3) {
                        dailyCapacities[d]++;
                        currentTotalSlots++;
                    }
                }
            } else if (currentTotalSlots > residentCount) {
                // Remove slots from weekdays first
                const weekdayPriority = [1, 2, 3, 4]; // Mon, Tue, Wed, Thu
                for (const dayOfWeek of weekdayPriority) {
                    for (let d = 0; d < daysInMonth; d++) {
                        if (currentTotalSlots <= residentCount) break;
                        const date = new Date(Date.UTC(year, monthNum - 1, d + 1));
                        if (date.getUTCDay() === dayOfWeek && dailyCapacities[d] > 1) {
                            dailyCapacities[d]--;
                            currentTotalSlots--;
                        }
                    }
                    if (currentTotalSlots <= residentCount) break;
                }
            }

            // --- 2. Initialize assignments ---
            const dailyAssignments: string[][] = Array.from({ length: daysInMonth }, () => []);
            let residentsPool = [...availableParticipants];

            // --- 3. Handle Approved Requests First ---
            const approvedRequests = requests?.filter(req => {
                if (req.status !== 'approved') return false;
                const reqDate = new Date(req.requestedScheduleDate);
                return reqDate.getUTCFullYear() === year && reqDate.getUTCMonth() + 1 === monthNum;
            }) ?? [];

            approvedRequests.forEach(req => {
                const user = usersIdMap.get(req.userId);
                if (!user) return;

                const reqDate = new Date(req.requestedScheduleDate);
                const dayIndex = reqDate.getUTCDate() - 1;
                const resident = residentsPool.find(r => r.id === user.id);

                if (resident && dayIndex >= 0 && dayIndex < daysInMonth && dailyAssignments[dayIndex].length < dailyCapacities[dayIndex]) {
                    dailyAssignments[dayIndex].push(resident.name);
                    residentsPool = residentsPool.filter(r => r.id !== resident.id);
                }
            });

            // --- 4. Fill remaining slots 1:1 ---
            for (let d = 0; d < daysInMonth; d++) {
                const date = new Date(Date.UTC(year, monthNum - 1, d + 1));
                const dayOfWeek = date.getUTCDay();
                const isWeekend = dayOfWeek === 5 || dayOfWeek === 6 || dayOfWeek === 0;

                while (dailyAssignments[d].length < dailyCapacities[d] && residentsPool.length > 0) {
                    const alreadyAssignedBlocks = new Set(
                        dailyAssignments[d].map(name => {
                            const u = usersMap.get(name.toLowerCase().trim());
                            return u?.address ? u.address.charAt(0).toUpperCase() : null;
                        }).filter(Boolean)
                    );

                    // Sorting for fairness and preferences
                    residentsPool.sort((a, b) => {
                        // 1. Teacher priority for weekend
                        if (isWeekend) {
                            if (a.isTeacher && !b.isTeacher) return -1;
                            if (!a.isTeacher && b.isTeacher) return 1;
                        }

                        // 2. Block avoidance
                        const blockA = a.address ? a.address.charAt(0).toUpperCase() : null;
                        const blockB = b.address ? b.address.charAt(0).toUpperCase() : null;
                        const blockAConflict = blockA && alreadyAssignedBlocks.has(blockA);
                        const blockBConflict = blockB && alreadyAssignedBlocks.has(blockB);
                        if (blockAConflict && !blockBConflict) return 1;
                        if (!blockAConflict && blockBConflict) return -1;

                        // 3. Randomize
                        return Math.random() - 0.5;
                    });

                    const selected = residentsPool.shift();
                    if (selected) {
                        dailyAssignments[d].push(selected.name);
                    }
                }
            }

            // Final Schedule Assembly
            const newSchedule: GeneratedSchedule[] = dailyAssignments.map((participants, i) => {
                const date = new Date(Date.UTC(year, monthNum - 1, i + 1));
                return {
                    date: date.toISOString().split('T')[0],
                    participants: participants.sort(),
                };
            });

            setGeneratedSchedule(newSchedule);
            setHasExistingSchedule(true);
            toast({
                title: "Berhasil!",
                description: `Jadwal telah dibuat. Total ${residentCount} warga dijadwalkan (1:1).`,
            });

        } catch (e) {
            console.error("Generate error:", e);
            toast({ title: "Error", description: "Gagal membuat jadwal.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    }, 100);
  };

  const handleParticipantChange = (dayIndex: number, participantIndex: number, newParticipant: string) => {
    if (!newParticipant) return; 

    setGeneratedSchedule(currentSchedule => {
        if (!currentSchedule) return null;

        const newSchedule = [...currentSchedule];
        const targetDay = { ...newSchedule[dayIndex] };
        const newParticipants = [...targetDay.participants];
        
        const newNorm = newParticipant.trim().toLowerCase();
        const isDuplicate = newParticipants.some((p, i) => 
            i !== participantIndex && p.toLowerCase().trim() === newNorm
        );

        if (isDuplicate) {
            toast({
                title: "Nama Ganda",
                description: `${newParticipant} sudah terdaftar pada hari ini.`,
                variant: "destructive",
            });
            return currentSchedule; 
        }

        newParticipants[participantIndex] = newParticipant.trim();
        targetDay.participants = newParticipants.sort(); 
        newSchedule[dayIndex] = targetDay;
        
        return newSchedule;
    });
  };


  const handleSaveSchedule = async () => {
    if (!generatedSchedule || !firestore || !usersMap.size || !month) {
        toast({ title: 'Error', description: 'Tidak ada jadwal untuk disimpan.', variant: 'destructive'});
        return;
    }

    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);

        // Delete existing month's schedule
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

        for (const day of generatedSchedule) {
            const utcDate = new Date(day.date + 'T00:00:00Z');
            for (const participantName of day.participants) {
                const user = usersMap.get(participantName.toLowerCase().trim());
                if (user) {
                    const newScheduleRef = doc(collection(firestore, 'users', user.id, 'rondaSchedules'));
                    batch.set(newScheduleRef, {
                        id: newScheduleRef.id,
                        userId: user.id,
                        date: utcDate.toISOString(),
                        startTime: '22:00',
                        endTime: '06:00',
                    });
                }
            }
        }
        
        await batch.commit();
        toast({ title: 'Berhasil!', description: 'Jadwal ronda telah disimpan.' });
        setHasExistingSchedule(true);
    } catch (error) {
        console.error("Save error:", error);
        toast({ title: 'Gagal Menyimpan', description: 'Terjadi kesalahan database.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleClearSchedule = async () => {
    if (!month || !firestore) return;
    setIsClearing(true);
    try {
        const [year, monthNum] = month.split('-').map(Number);
        const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
        const endDate = new Date(Date.UTC(year, monthNum, 1));
        const batch = writeBatch(firestore);

        const toDelete = allSchedules?.filter(s => {
            const d = new Date(s.date);
            return d >= startDate && d < endDate;
        }) || [];

        toDelete.forEach(s => {
            const ref = doc(firestore, 'users', s.userId, 'rondaSchedules', s.id);
            batch.delete(ref);
        });

        await batch.commit();
        toast({ title: "Berhasil!", description: "Jadwal telah dihapus." });
        setGeneratedSchedule(null);
        setHasExistingSchedule(false);
    } catch (error) {
        toast({ title: 'Gagal Menghapus', description: 'Terjadi kesalahan database.', variant: 'destructive' });
    } finally {
        setIsClearing(false);
    }
  };


  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="space-y-4">
        <div>
          <Label htmlFor="month">Bulan (YYYY-MM)</Label>
          <Input 
            id="month" 
            type="month" 
            disabled={isLoading || isGenerating || isClearing}
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleGenerateClick} disabled={isGenerating || isLoading || isClearing || !month} className="flex-grow sm:flex-grow-0">
            {isGenerating ? <Loader2 className="animate-spin" /> : <Wand2 />}
            {hasExistingSchedule ? 'Regenerate' : 'Generate'} Jadwal
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={isClearing || isLoading || !month || !hasExistingSchedule} className="flex-grow sm:flex-grow-0">
                    {isClearing ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    Hapus Jadwal
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Hapus Jadwal?</AlertDialogTitle>
                    <AlertDialogDescription>
                        Ini akan menghapus semua jadwal untuk bulan <strong>{month}</strong> secara permanen.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearSchedule}>Hapus</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Memuat data...</p>}
      </div>

      <div>
        {generatedSchedule ? (
          <Card className="bg-secondary">
            <CardHeader>
              <CardTitle>Hasil Generate ({availableParticipants.length} Warga)</CardTitle>
            </CardHeader>
            <CardContent className="max-h-[400px] overflow-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Peserta</TableHead>
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
                    Simpan Jadwal ke Database
                </Button>
            </CardFooter>
          </Card>
        ) : ( month && !isLoading &&
             <Alert>
                <Wand2 className="h-4 w-4" />
                <AlertTitle>Siap Generate</AlertTitle>
                <AlertDescription>
                {hasExistingSchedule ? 'Jadwal bulan ini sudah ada. Klik Regenerate jika ingin membuat ulang.' : "Belum ada jadwal. Klik 'Generate' untuk membuat otomatis (1:1 per warga)."}
                </AlertDescription>
            </Alert>
        )}
      </div>
    </div>
  );
}
