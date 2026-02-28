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
import { collection, writeBatch, doc, query, collectionGroup, deleteDoc } from 'firebase/firestore';
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

  // Check if schedule exists for selected month
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
            
            // LOGIC: Every day MUST HAVE at least 2 people, max 3.
            // Total slots needed = residentCount (since 1:1)
            // But if residentCount < daysInMonth * 2, we must repeat.
            const minTotalSlots = daysInMonth * 2;
            const targetTotalSlots = Math.max(residentCount, minTotalSlots);
            
            // Plan distribution: fill 2 per night first
            const dailyAssignments: string[][] = Array.from({ length: daysInMonth }, () => []);
            let residentsPool = [...availableParticipants].sort(() => Math.random() - 0.5);

            // If we need to repeat people to meet minimum
            if (residentCount < minTotalSlots) {
                toast({
                    title: "Info Kuota",
                    description: "Warga kurang untuk minimal 2 orang/malam. Sistem akan mengulang beberapa warga.",
                });
                while (residentsPool.length < targetTotalSlots) {
                    residentsPool = residentsPool.concat([...availableParticipants].sort(() => Math.random() - 0.5));
                }
            }

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
                        // Remove from pool to keep it 1:1 as much as possible
                        const poolIdx = residentsPool.findIndex(r => r.id === user.id);
                        if (poolIdx !== -1) residentsPool.splice(poolIdx, 1);
                    }
                }
            });

            // 2. Fill to ensure min 2 per night
            for (let d = 0; d < daysInMonth; d++) {
                while (dailyAssignments[d].length < 2 && residentsPool.length > 0) {
                    const alreadyInDay = dailyAssignments[d].map(n => n.toLowerCase());
                    const nextIdx = residentsPool.findIndex(r => !alreadyInDay.includes(r.name.toLowerCase()));
                    if (nextIdx !== -1) {
                        dailyAssignments[d].push(residentsPool.splice(nextIdx, 1)[0].name);
                    } else break;
                }
            }

            // 3. Distribute remaining residents (up to max 3 per night)
            for (let d = 0; d < daysInMonth; d++) {
                while (dailyAssignments[d].length < 3 && residentsPool.length > 0) {
                    const alreadyInDay = dailyAssignments[d].map(n => n.toLowerCase());
                    const nextIdx = residentsPool.findIndex(r => !alreadyInDay.includes(r.name.toLowerCase()));
                    if (nextIdx !== -1) {
                        dailyAssignments[d].push(residentsPool.splice(nextIdx, 1)[0].name);
                    } else break;
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
            toast({ title: "Berhasil!", description: "Pratinjau jadwal dibuat (Minimal 2 orang/malam)." });

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
        toast({ title: 'Error', description: 'Gagal menyimpan jadwal.', variant: 'destructive' });
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
        toast({ title: 'Error', description: 'Gagal menghapus jadwal.', variant: 'destructive' });
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
            <AlertTitle>Aturan Penjadwalan</AlertTitle>
            <AlertDescription className="text-xs space-y-1 mt-1">
                <p>• Minimal 2 orang, maksimal 3 orang per malam.</p>
                <p>• Memprioritaskan "Request Schedule" yang sudah disetujui.</p>
                <p>• Mengutamakan pembagian merata (1 warga = 1 shift).</p>
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
              <p className="text-xs text-muted-foreground text-center mt-1">Pilih bulan dan klik Generate untuk melihat simulasi jadwal.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'secondary' }) => (
    <span className={cn(
        "px-2 py-0.5 rounded-full text-[10px] font-bold",
        variant === 'default' ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
    )}>
        {children}
    </span>
);

function cn(...inputs: any[]) {
    return inputs.filter(Boolean).join(' ');
}
