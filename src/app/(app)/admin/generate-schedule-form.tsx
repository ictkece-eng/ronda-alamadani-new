'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useMemo, useEffect } from 'react';
import { Loader2, Wand2, Save, Trash2, AlertCircle } from 'lucide-react';
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

  const availableParticipants = useMemo(() => {
    if (!users) return [];
    return users.filter(u => 
        u.role === 'user' || 
        u.role === 'coordinator' ||
        (u.role === 'backup' && u.includeInSchedule === true)
    ).map(u => ({ ...u, name: u.name.trim() }));
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
            if (user) acc[dateStr].push(user.name.trim());
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
            
            // 1. Calculate ideal capacity per night
            const minSlots = daysInMonth * 2; // Min 2 per night
            const targetTotalSlots = Math.max(residentCount, minSlots);
            
            let baseCap = Math.floor(targetTotalSlots / daysInMonth);
            let extraSlots = targetTotalSlots % daysInMonth;

            const dailyCapacities = Array(daysInMonth).fill(baseCap);
            
            // Prioritize weekends for extra slots (making it 3 if base is 2)
            for (let d = 0; d < daysInMonth; d++) {
                const date = new Date(Date.UTC(year, monthNum - 1, d + 1));
                const day = date.getUTCDay();
                if ((day === 5 || day === 6 || day === 0) && extraSlots > 0 && dailyCapacities[d] < 3) {
                    dailyCapacities[d]++;
                    extraSlots--;
                }
            }
            // Distribute remaining extras
            for (let d = 0; d < daysInMonth; d++) {
                if (extraSlots > 0 && dailyCapacities[d] < 3) {
                    dailyCapacities[d]++;
                    extraSlots--;
                }
            }

            const dailyAssignments: string[][] = Array.from({ length: daysInMonth }, () => []);
            let residentsPool = [...availableParticipants].sort(() => Math.random() - 0.5);

            // Handle Case where residents < 2 * daysInMonth
            if (residentCount < minSlots) {
                toast({
                    title: "Info Kuota",
                    description: "Warga kurang untuk minimal 2 orang/malam. Beberapa warga akan ronda 2x.",
                });
                while (residentsPool.length < targetTotalSlots) {
                    residentsPool = residentsPool.concat([...availableParticipants].sort(() => Math.random() - 0.5));
                }
            }

            // 2. Handle Approved Requests First
            const approvedRequests = requests?.filter(req => {
                if (req.status !== 'approved') return false;
                const reqDate = new Date(req.requestedScheduleDate);
                return reqDate.getUTCFullYear() === year && reqDate.getUTCMonth() + 1 === monthNum;
            }) || [];

            approvedRequests.forEach(req => {
                const user = usersIdMap.get(req.userId);
                if (!user) return;
                const dayIndex = new Date(req.requestedScheduleDate).getUTCDate() - 1;
                if (dayIndex >= 0 && dayIndex < daysInMonth) {
                    if (!dailyAssignments[dayIndex].includes(user.name)) {
                        dailyAssignments[dayIndex].push(user.name);
                        // Remove from pool to satisfy 1:1 if possible
                        const poolIdx = residentsPool.findIndex(r => r.id === user.id);
                        if (poolIdx !== -1) residentsPool.splice(poolIdx, 1);
                    }
                }
            });

            // 3. Fill remaining slots
            for (let d = 0; d < daysInMonth; d++) {
                while (dailyAssignments[d].length < dailyCapacities[d] && residentsPool.length > 0) {
                    const alreadyInDay = dailyAssignments[d].map(n => n.toLowerCase());
                    const nextResidentIdx = residentsPool.findIndex(r => !alreadyInDay.includes(r.name.toLowerCase()));
                    
                    if (nextResidentIdx !== -1) {
                        const selected = residentsPool.splice(nextResidentIdx, 1)[0];
                        dailyAssignments[d].push(selected.name);
                    } else {
                        // Fallback if everyone left in pool is already in this day (only happens if resident count is extremely low)
                        break; 
                    }
                }
            }

            const newSchedule: GeneratedSchedule[] = dailyAssignments.map((participants, i) => {
                const date = new Date(Date.UTC(year, monthNum - 1, i + 1));
                return {
                    date: date.toISOString().split('T')[0],
                    participants: participants.sort(),
                };
            });

            setGeneratedSchedule(newSchedule);
            setHasExistingSchedule(true);
            toast({ title: "Berhasil!", description: "Jadwal telah dibuat (Min 2, Max 3 per malam)." });

        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Gagal membuat jadwal.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    }, 100);
  };

  const handleSaveSchedule = async () => {
    if (!generatedSchedule || !firestore || !month) return;
    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);
        const [year, monthNum] = month.split('-').map(Number);
        const start = new Date(Date.UTC(year, monthNum - 1, 1));
        const end = new Date(Date.UTC(year, monthNum, 1));

        // Delete old
        const toDelete = allSchedules?.filter(s => {
            const d = new Date(s.date);
            return d >= start && d < end;
        }) || [];
        toDelete.forEach(s => batch.delete(doc(firestore, 'users', s.userId, 'rondaSchedules', s.id)));

        // Write new
        for (const day of generatedSchedule) {
            for (const pName of day.participants) {
                const user = usersMap.get(pName.toLowerCase().trim());
                if (user) {
                    const ref = doc(collection(firestore, 'users', user.id, 'rondaSchedules'));
                    batch.set(ref, {
                        id: ref.id,
                        userId: user.id,
                        date: new Date(day.date + 'T00:00:00Z').toISOString(),
                        startTime: '22:00',
                        endTime: '06:00',
                    });
                }
            }
        }
        await batch.commit();
        toast({ title: 'Berhasil!', description: 'Jadwal telah disimpan.' });
    } catch (e) {
        toast({ title: 'Error', description: 'Gagal menyimpan jadwal.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="space-y-4">
        <div>
          <Label htmlFor="month">Bulan (YYYY-MM)</Label>
          <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={isLoading || isGenerating} />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerateClick} disabled={isGenerating || !month || isLoading}>
            {isGenerating ? <Loader2 className="animate-spin mr-2" /> : <Wand2 className="mr-2" />}
            Generate Jadwal
          </Button>
          {hasExistingSchedule && (
              <Button variant="destructive" onClick={() => setGeneratedSchedule(null)} disabled={isGenerating}>Reset</Button>
          )}
        </div>
      </div>

      <div>
        {generatedSchedule ? (
          <Card className="bg-secondary/50">
            <CardHeader><CardTitle>Review Hasil</CardTitle></CardHeader>
            <CardContent className="max-h-[400px] overflow-auto p-0">
                <Table>
                    <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Warga</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {generatedSchedule.map((day) => (
                            <TableRow key={day.date}>
                                <TableCell className="font-medium">{format(new Date(day.date + 'T00:00:00Z'), 'dd MMM', { locale: idLocale })}</TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {day.participants.map(p => <span key={p} className="px-2 py-1 bg-background border rounded text-xs">{p}</span>)}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="pt-4">
                <Button className="w-full" onClick={handleSaveSchedule} disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                    Simpan Jadwal
                </Button>
            </CardFooter>
          </Card>
        ) : (
          <Alert><AlertCircle className="h-4 w-4" /><AlertTitle>Info</AlertTitle><AlertDescription>Pilih bulan dan klik Generate. Sistem akan mengatur 2-3 orang per malam.</AlertDescription></Alert>
        )}
      </div>
    </div>
  );
}
