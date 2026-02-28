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

  // 1. Dapatkan daftar warga unik berdasarkan nama (case-insensitive & trimmed)
  const availableParticipants = useMemo(() => {
    if (!users) return [];
    
    const nameMap = new Map<string, string>();
    users.forEach(u => {
      if (!u.name) return;
      const normalizedName = u.name.trim().toLowerCase();
      
      // Filter warga yang berhak ikut ronda
      if (
        u.role === 'user' || 
        u.role === 'coordinator' ||
        (u.role === 'backup' && u.includeInSchedule === true)
      ) {
        // Simpan casing asli pertama yang ditemukan
        if (!nameMap.has(normalizedName)) {
            nameMap.set(normalizedName, u.name.trim());
        }
      }
    });
    
    return Array.from(nameMap.values());
  }, [users]);
  
  const participantOptions = useMemo(() => {
    return availableParticipants.map(p => ({ value: p, label: p }));
  }, [availableParticipants]);


  const usersMap = useMemo(() => {
    if (!users) return new Map<string, Warga>();
    return new Map(users.map((user) => [user.name.trim().toLowerCase(), user]));
  }, [users]);
  
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
                const normalizedName = user.name.trim();
                if (!acc[dateStr].includes(normalizedName)) {
                    acc[dateStr].push(normalizedName);
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
    
    if (availableParticipants.length < 3) {
        toast({ title: "Error", description: "Warga tidak cukup (min. 3 orang).", variant: "destructive" });
        return;
    }

    setIsGenerating(true);
    setGeneratedSchedule(null);

    // Gunakan timeout untuk memberi nafas pada UI
    setTimeout(() => {
        try {
            const [year, monthNum] = month.split('-').map(Number);
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            const newSchedule: GeneratedSchedule[] = [];

            const shiftCounts = new Map<string, number>(availableParticipants.map(p => [p.toLowerCase().trim(), 0]));
            const dailyAssignments: string[][] = Array.from({ length: daysInMonth }, () => []);

            // --- 1. Pre-assign berdasarkan Request yang Disetujui ---
            const approvedRequestsForMonth = requests?.filter(req => {
                if (req.status !== 'approved') return false;
                const reqDate = new Date(req.requestedScheduleDate);
                return reqDate.getUTCFullYear() === year && reqDate.getUTCMonth() + 1 === monthNum;
            }) ?? [];

            approvedRequestsForMonth.forEach(req => {
                const user = usersIdMap.get(req.userId);
                if (!user) return; 

                const reqDate = new Date(req.requestedScheduleDate);
                const dayIndex = reqDate.getUTCDate() - 1;
                const normalizedName = user.name.trim();
                const normLower = normalizedName.toLowerCase();

                if (dayIndex >= 0 && dayIndex < daysInMonth) {
                    // Cek apakah sudah ada nama ini (case-insensitive) di hari tersebut
                    const isAlreadyAssigned = dailyAssignments[dayIndex].some(name => name.toLowerCase().trim() === normLower);
                    
                    if (!isAlreadyAssigned && dailyAssignments[dayIndex].length < 3) {
                        dailyAssignments[dayIndex].push(normalizedName);
                        shiftCounts.set(normLower, (shiftCounts.get(normLower) ?? 0) + 1);
                    }
                }
            });


            // --- 2. Isi Sisa Slot secara Adil & Tanpa Duplikat ---
            for (let day = 0; day < daysInMonth; day++) {
                const currentDate = new Date(Date.UTC(year, monthNum - 1, day + 1));
                const dayOfWeek = currentDate.getUTCDay(); // 0=Sun, 5=Fri, 6=Sat
                const isWeekendShift = dayOfWeek === 5 || dayOfWeek === 6; 
                const targetParticipants = (dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6) ? 3 : 2;
                
                // Terus isi sampai target terpenuhi
                while (dailyAssignments[day].length < targetParticipants) {
                    // Filter kandidat FRESH: yang belum ada di hari ini (case-insensitive)
                    const assignedNamesLower = new Set(dailyAssignments[day].map(n => n.toLowerCase().trim()));
                    const candidates = availableParticipants.filter(p => !assignedNamesLower.has(p.toLowerCase().trim()));

                    if (candidates.length === 0) break; // Kehabisan warga

                    const assignedBlocksThisDay = new Set(
                        dailyAssignments[day].map(name => {
                            const user = usersMap.get(name.toLowerCase().trim());
                            return user?.address ? user.address.charAt(0).toUpperCase() : null;
                        }).filter(Boolean)
                    );

                    const dayAlreadyHasTeacher = dailyAssignments[day].some(name => !!usersMap.get(name.toLowerCase().trim())?.isTeacher);

                    // Sorting cerdas
                    candidates.sort((a, b) => {
                        const userA = usersMap.get(a.toLowerCase().trim());
                        const userB = usersMap.get(b.toLowerCase().trim());
                        
                        const isATeacher = !!userA?.isTeacher;
                        const isBTeacher = !!userB?.isTeacher;

                        // Guru diutamakan weekend, tapi hanya satu per hari
                        if (dayAlreadyHasTeacher) {
                            if (isATeacher && !isBTeacher) return 1;
                            if (!isATeacher && isBTeacher) return -1;
                        } else if (isWeekendShift) {
                            if (isATeacher && !isBTeacher) return -1;
                            if (!isATeacher && isBTeacher) return 1;
                        }

                        // Hindari blok rumah yang sama dalam satu malam
                        const blockA = userA?.address ? userA.address.charAt(0).toUpperCase() : null;
                        const blockB = userB?.address ? userB.address.charAt(0).toUpperCase() : null;
                        const scoreA_block = (blockA && assignedBlocksThisDay.has(blockA)) ? 1 : 0;
                        const scoreB_block = (blockB && assignedBlocksThisDay.has(blockB)) ? 1 : 0;
                        if (scoreA_block !== scoreB_block) return scoreA_block - scoreB_block;

                        // Hindari tugas berurutan (kemarin sudah ronda)
                        const wasAOnYesterday = day > 0 && dailyAssignments[day - 1].some(n => n.toLowerCase().trim() === a.toLowerCase().trim());
                        const wasBOnYesterday = day > 0 && dailyAssignments[day - 1].some(n => n.toLowerCase().trim() === b.toLowerCase().trim());
                        if (wasAOnYesterday !== wasBOnYesterday) return wasAOnYesterday ? 1 : -1;

                        // Pilih yang paling sedikit rondanya di bulan ini
                        const countA = shiftCounts.get(a.toLowerCase().trim()) ?? 0;
                        const countB = shiftCounts.get(b.toLowerCase().trim()) ?? 0;
                        if (countA !== countB) return countA - countB;

                        return Math.random() - 0.5;
                    });
                    
                    const bestCandidate = candidates[0];
                    dailyAssignments[day].push(bestCandidate);
                    shiftCounts.set(bestCandidate.toLowerCase().trim(), (shiftCounts.get(bestCandidate.toLowerCase().trim()) ?? 0) + 1);
                }
            }
            
            // --- 3. Final Assembly ---
            for (let day = 0; day < daysInMonth; day++) {
                const date = new Date(Date.UTC(year, monthNum - 1, day + 1));
                newSchedule.push({
                    date: date.toISOString().split('T')[0],
                    participants: dailyAssignments[day].sort(), 
                });
            }

            setGeneratedSchedule(newSchedule);
            setHasExistingSchedule(true);
            toast({
                title: "Berhasil!",
                description: "Jadwal telah digenerate secara adil dan tanpa duplikat.",
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

    const trimmedNewParticipant = newParticipant.trim();
    const newNorm = trimmedNewParticipant.toLowerCase();

    setGeneratedSchedule(currentSchedule => {
        if (!currentSchedule) return null;

        const newSchedule = [...currentSchedule];
        const targetDay = { ...newSchedule[dayIndex] };
        const newParticipants = [...targetDay.participants];
        
        // Cek ganda (case-insensitive)
        const isDuplicate = newParticipants.some((p, i) => 
            i !== participantIndex && p.toLowerCase().trim() === newNorm
        );

        if (isDuplicate) {
            toast({
                title: "Nama Ganda",
                description: `${trimmedNewParticipant} sudah terdaftar pada hari ini.`,
                variant: "destructive",
            });
            return currentSchedule; 
        }

        newParticipants[participantIndex] = trimmedNewParticipant;
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
              <CardTitle>Hasil Generate (Bisa Edit Manual)</CardTitle>
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
                {hasExistingSchedule ? 'Jadwal bulan ini sudah ada. Klik Regenerate jika ingin membuat ulang.' : "Belum ada jadwal. Klik 'Generate' untuk membuat otomatis."}
                </AlertDescription>
            </Alert>
        )}
      </div>
    </div>
  );
}
