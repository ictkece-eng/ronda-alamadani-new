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
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

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

    setHasExistingSchedule(schedulesForMonth.length > 0);
  }, [month, allSchedules, usersIdMap]);

  const handleGenerateClick = () => {
    if (!month) {
        toast({ title: "Error", description: "Pilih bulan terlebih dahulu.", variant: "destructive" });
        return;
    }
    
    if (availableParticipants.length < 2) {
        toast({ title: "Error", description: "Minimal harus ada 2 warga ronda untuk generate jadwal.", variant: "destructive" });
        return;
    }

    setIsGenerating(true);
    setGeneratedSchedule(null);

    // Use a short timeout to allow UI to show loader and prevent freezing
    setTimeout(() => {
        try {
            const [year, monthNum] = month.split('-').map(Number);
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            const dailyAssignments: string[][] = Array.from({ length: daysInMonth }, () => []);

            // 1. Handle Approved Requests (Prioritas Utama)
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
                    }
                }
            });

            // 2. Fill to ensure min 2 per night (Full Month Safety)
            let residentsPool = [...availableParticipants].sort(() => Math.random() - 0.5);
            let poolIndex = 0;

            const getNextFromPool = (dayIdx: number) => {
                let attempts = 0;
                while (attempts < availableParticipants.length) {
                    const candidate = residentsPool[poolIndex];
                    poolIndex = (poolIndex + 1) % residentsPool.length;
                    
                    if (poolIndex === 0) {
                        residentsPool = [...residentsPool].sort(() => Math.random() - 0.5);
                    }

                    if (!dailyAssignments[dayIdx].includes(candidate.name)) {
                        return candidate.name;
                    }
                    attempts++;
                }
                // Jika sudah mencoba semua tapi masih gagal (karena warga sangat sedikit), 
                // paksa ambil yang sudah ada asal bukan duplikat di malam yang sama
                const fallback = availableParticipants.find(p => !dailyAssignments[dayIdx].includes(p.name));
                return fallback ? fallback.name : null;
            };

            // First pass: Fill every day to at least 2 people
            for (let d = 0; d < daysInMonth; d++) {
                while (dailyAssignments[d].length < 2) {
                    const name = getNextFromPool(d);
                    if (name) dailyAssignments[d].push(name);
                    else break; 
                }
            }

            // Second pass: Distribute any remaining residents to reach max 3 if possible
            const totalSlotsFilled = dailyAssignments.reduce((acc, curr) => acc + curr.length, 0);
            if (availableParticipants.length > totalSlotsFilled) {
                const remainingPeople = availableParticipants.filter(p => 
                    !dailyAssignments.some(day => day.includes(p.name))
                ).sort(() => Math.random() - 0.5);

                for (const person of remainingPeople) {
                    const dayWithLeast = dailyAssignments
                        .map((day, idx) => ({ length: day.length, idx }))
                        .filter(d => d.length < 3 && !dailyAssignments[d.idx].includes(person.name))
                        .sort((a, b) => a.length - b.length)[0];
                    
                    if (dayWithLeast) {
                        dailyAssignments[dayWithLeast.idx].push(person.name);
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
            toast({ title: "Berhasil!", description: "Jadwal sebulan penuh telah dibuat (2-3 orang/malam)." });

        } catch (e) {
            console.error(e);
            toast({ title: "Error", description: "Terjadi kesalahan saat mengolah JSON jadwal.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    }, 50);
  };

  const handleSaveSchedule = async () => {
    if (!generatedSchedule || !firestore || !month) return;
    setIsSaving(true);
    try {
        const batch = writeBatch(firestore);
        const [year, monthNum] = month.split('-').map(Number);
        const start = new Date(Date.UTC(year, monthNum - 1, 1));
        const end = new Date(Date.UTC(year, monthNum, 1));

        // Delete existing for this month first
        const toDelete = allSchedules?.filter(s => {
            const d = new Date(s.date);
            return d >= start && d < end;
        }) || [];
        toDelete.forEach(s => batch.delete(doc(firestore, 'users', s.userId, 'rondaSchedules', s.id)));

        // Save new
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
        setGeneratedSchedule(null);
        toast({ title: 'Berhasil!', description: 'Jadwal telah disimpan ke database.' });
    } catch (e) {
        toast({ title: 'Error', description: 'Gagal menyimpan jadwal. Cek koneksi Anda.', variant: 'destructive' });
    } finally {
        setIsSaving(false);
    }
  };

  const handleClearDatabase = async () => {
    if (!firestore || !month || !allSchedules) return;
    setIsClearing(true);
    try {
        const batch = writeBatch(firestore);
        const [year, monthNum] = month.split('-').map(Number);
        const start = new Date(Date.UTC(year, monthNum - 1, 1));
        const end = new Date(Date.UTC(year, monthNum, 1));

        const toDelete = allSchedules.filter(s => {
            const d = new Date(s.date);
            return d >= start && d < end;
        });

        if (toDelete.length === 0) {
            toast({ title: "Info", description: "Tidak ada jadwal untuk dihapus di bulan ini." });
            return;
        }

        toDelete.forEach(s => batch.delete(doc(firestore, 'users', s.userId, 'rondaSchedules', s.id)));
        await batch.commit();
        setGeneratedSchedule(null);
        toast({ title: 'Berhasil!', description: 'Jadwal bulan ini telah dihapus dari database.' });
    } catch (e) {
        toast({ title: 'Error', description: 'Gagal menghapus data.', variant: 'destructive' });
    } finally {
        setIsClearing(false);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="month">Pilih Bulan (YYYY-MM)</Label>
          <Input id="month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={isLoading || isGenerating} />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleGenerateClick} disabled={isGenerating || !month || isLoading}>
            {isGenerating ? <Loader2 className="animate-spin mr-2" /> : <Wand2 className="mr-2" />}
            Generate Pratinjau
          </Button>

          {hasExistingSchedule && (
              <AlertDialog>
                  <AlertDialogTrigger asChild>
                      <Button variant="destructive" disabled={isClearing}>
                          {isClearing ? <Loader2 className="animate-spin mr-2" /> : <Trash2 className="mr-2" />}
                          Hapus Jadwal (DB)
                      </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                      <AlertDialogHeader>
                          <AlertDialogTitle>Hapus Jadwal?</AlertDialogTitle>
                          <AlertDialogDescription>
                              Ini akan menghapus semua jadwal ronda yang sudah tersimpan untuk bulan {month} secara permanen dari database.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearDatabase} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Hapus Permanen
                          </AlertDialogAction>
                      </AlertDialogFooter>
                  </AlertDialogContent>
              </AlertDialog>
          )}

          {generatedSchedule && (
              <Button variant="outline" onClick={() => setGeneratedSchedule(null)} disabled={isGenerating}>
                  Batal Pratinjau
              </Button>
          )}
        </div>

        <Alert className="bg-primary/5 border-primary/20">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertTitle>Aturan Penjadwalan Otomatis</AlertTitle>
            <AlertDescription className="text-xs space-y-1 mt-1">
                <p>• <b>Garansi:</b> Setiap malam diisi 2-3 orang tanpa ada hari yang kosong.</p>
                <p>• <b>Prioritas:</b> Mengunci "Request Schedule" yang sudah disetujui.</p>
                <p>• <b>Adil:</b> Warga akan dijadwalkan secara merata.</p>
            </AlertDescription>
        </Alert>
      </div>

      <div>
        {generatedSchedule ? (
          <Card className="bg-secondary/30 shadow-none border-dashed border-2">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex justify-between items-center">
                    Pratinjau Jadwal
                    <Badge variant="secondary">{generatedSchedule.length} Hari</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-auto p-0 border-t">
                <Table>
                    <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Warga Ronda</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {generatedSchedule.map((day) => (
                            <TableRow key={day.date} className="hover:bg-transparent">
                                <TableCell className="font-medium text-xs whitespace-nowrap">
                                    {format(new Date(day.date + 'T00:00:00Z'), 'dd MMM', { locale: idLocale })}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {day.participants.map(p => (
                                            <span key={p} className="px-2 py-0.5 bg-background border rounded text-[10px] font-medium">
                                                {p}
                                            </span>
                                        ))}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
            <CardFooter className="pt-4 flex flex-col gap-2">
                <Button className="w-full" onClick={handleSaveSchedule} disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                    Simpan ke Database
                </Button>
                <p className="text-[10px] text-muted-foreground text-center italic">
                    *Menyimpan akan menimpa jadwal lama di bulan yang sama.
                </p>
            </CardFooter>
          </Card>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl opacity-50 bg-muted/20">
              <Wand2 className="h-12 w-12 mb-4 text-muted-foreground" />
              <p className="text-sm font-medium">Belum ada pratinjau</p>
              <p className="text-xs text-muted-foreground text-center mt-1">Pilih bulan dan klik Generate untuk melihat simulasi jadwal satu bulan penuh.</p>
          </div>
        )}
      </div>
    </div>
  );
}