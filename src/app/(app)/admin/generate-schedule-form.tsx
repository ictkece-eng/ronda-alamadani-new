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

  const usersIdMap = useMemo(() => {
    if (!users) return new Map<string, Warga>();
    return new Map(users.map((user) => [user.id, user]));
  }, [users]);

  // Check if schedule already exists for this month
  useEffect(() => {
    if (!month || !allSchedules) {
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
  }, [month, allSchedules]);

  const handleGenerateClick = () => {
    if (!month) {
        toast({ title: "Error", description: "Pilih bulan terlebih dahulu.", variant: "destructive" });
        return;
    }
    
    if (!users || users.length < 2) {
        toast({ title: "Error", description: "Minimal harus ada 2 warga ronda untuk generate jadwal.", variant: "destructive" });
        return;
    }

    setIsGenerating(true);
    setGeneratedSchedule(null);

    // Short timeout to let UI update
    setTimeout(() => {
        try {
            const [year, monthNum] = month.split('-').map(Number);
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            const dailyAssignments: string[][] = Array.from({ length: daysInMonth }, () => []);

            // 1. Ambil warga yang berpartisipasi (User, Coordinator, atau Backup yang masuk jadwal)
            let allParticipants = users.filter(u => 
                u.role === 'user' || 
                u.role === 'coordinator' ||
                (u.role === 'backup' && u.includeInSchedule === true)
            );

            // 2. Filter Approved Requests khusus bulan ini (Gunakan UTC agar akurat)
            const approvedRequestsForMonth = (requests || []).filter(req => {
                if (req.status !== 'approved') return false;
                const reqDate = new Date(req.requestedScheduleDate);
                // Bandingkan Tahun dan Bulan (1-based)
                return reqDate.getUTCFullYear() === year && (reqDate.getUTCMonth() + 1) === monthNum;
            });

            const assignedUserIds = new Set<string>();

            // 3. Fase 1: Masukkan Warga yang pengajuannya DISETUJUI (Prioritas Utama)
            approvedRequestsForMonth.forEach(req => {
                const user = usersIdMap.get(req.userId);
                // Pastikan user ada dan belum dijadwalkan di hari lain bulan ini (Anti-Double)
                if (user && !assignedUserIds.has(user.id)) {
                    const reqDate = new Date(req.requestedScheduleDate);
                    const dayIndex = reqDate.getUTCDate() - 1;
                    
                    if (dayIndex >= 0 && dayIndex < daysInMonth) {
                        dailyAssignments[dayIndex].push(user.name);
                        assignedUserIds.add(user.id);
                    }
                }
            });

            // 4. Fase 2: Distribusikan sisa warga ke malam yang kosong (Anti-Double Ronda)
            let remainingWarga = allParticipants
                .filter(u => !assignedUserIds.has(u.id))
                .sort(() => Math.random() - 0.5); // Acak untuk keadilan

            // Langkah A: Pastikan minimal ada 2 orang per malam
            for (let d = 0; d < daysInMonth; d++) {
                while (dailyAssignments[d].length < 2 && remainingWarga.length > 0) {
                    const candidate = remainingWarga.pop();
                    if (candidate) {
                        dailyAssignments[d].push(candidate.name);
                        assignedUserIds.add(candidate.id);
                    }
                }
            }

            // Langkah B: Jika masih ada warga sisa, tambahkan hingga maksimal 3 orang per malam
            for (let d = 0; d < daysInMonth; d++) {
                while (dailyAssignments[d].length < 3 && remainingWarga.length > 0) {
                    const candidate = remainingWarga.pop();
                    if (candidate) {
                        dailyAssignments[d].push(candidate.name);
                        assignedUserIds.add(candidate.id);
                    }
                }
            }

            // Cek jika ada hari yang kekurangan warga (Hanya sebagai peringatan)
            const isUnderstaffed = dailyAssignments.some(day => day.length < 2);
            if (isUnderstaffed) {
                toast({ 
                    title: "Peringatan: Stok Warga Kurang", 
                    description: "Warga tidak cukup untuk mengisi minimal 2 orang per malam tanpa double shift.",
                    variant: "destructive"
                });
            }

            const newSchedule: GeneratedSchedule[] = dailyAssignments.map((participants, i) => {
                const date = new Date(Date.UTC(year, monthNum - 1, i + 1));
                return {
                    date: date.toISOString().split('T')[0],
                    participants: participants.sort(),
                };
            });

            setGeneratedSchedule(newSchedule);
            toast({ title: "Berhasil!", description: "Pratinjau jadwal dibuat dengan mematuhi pengajuan warga dan aturan tanpa double shift." });

        } catch (e) {
            console.error("Generate error:", e);
            toast({ title: "Error", description: "Terjadi kesalahan saat memproses data jadwal.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    }, 50);
  };

  const handleSaveSchedule = async () => {
    if (!generatedSchedule || !firestore || !month) return;
    setIsSaving(true);
    
    // Map names back to IDs for saving
    const usersByName = new Map<string, string>();
    users?.forEach(u => usersByName.set(u.name.toLowerCase().trim(), u.id));

    try {
        const batch = writeBatch(firestore);
        const [year, monthNum] = month.split('-').map(Number);
        const start = new Date(Date.UTC(year, monthNum - 1, 1));
        const end = new Date(Date.UTC(year, monthNum, 1));

        // Hapus jadwal lama di bulan yang sama sebelum menyimpan yang baru
        const toDelete = (allSchedules || []).filter(s => {
            const d = new Date(s.date);
            return d >= start && d < end;
        });
        toDelete.forEach(s => batch.delete(doc(firestore, 'users', s.userId, 'rondaSchedules', s.id)));

        // Simpan jadwal baru
        for (const day of generatedSchedule) {
            for (const pName of day.participants) {
                const userId = usersByName.get(pName.toLowerCase().trim());
                if (userId) {
                    const ref = doc(collection(firestore, 'users', userId, 'rondaSchedules'));
                    batch.set(ref, {
                        id: ref.id,
                        userId: userId,
                        date: new Date(day.date + 'T00:00:00Z').toISOString(),
                        startTime: '22:00',
                        endTime: '06:00',
                    });
                }
            }
        }
        
        await batch.commit();
        setGeneratedSchedule(null);
        toast({ title: 'Berhasil!', description: 'Jadwal telah disimpan dan diaktifkan.' });
    } catch (e) {
        console.error("Save error:", e);
        toast({ title: 'Error', description: 'Gagal menyimpan jadwal. Cek izin database.', variant: 'destructive' });
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
            setIsClearing(false);
            return;
        }

        toDelete.forEach(s => batch.delete(doc(firestore, 'users', s.userId, 'rondaSchedules', s.id)));
        await batch.commit();
        setGeneratedSchedule(null);
        toast({ title: 'Berhasil!', description: 'Jadwal bulan ini telah dihapus.' });
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
                              Ini akan menghapus jadwal permanen dari database untuk bulan {month}. Tindakan ini tidak bisa dibatalkan.
                          </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                          <AlertDialogCancel>Batal</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearDatabase} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Ya, Hapus
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
            <AlertTitle>Aturan Penjadwalan Adil</AlertTitle>
            <AlertDescription className="text-xs space-y-1 mt-1">
                <p>• <b>Satu Orang Satu Kali:</b> Menjamin warga tidak ronda ganda dalam sebulan.</p>
                <p>• <b>Keamanan Terjaga:</b> Target 2-3 orang per malam selama stok warga mencukupi.</p>
                <p>• <b>Prioritas Request:</b> Mengunci tanggal bagi warga yang pengajuannya sudah disetujui.</p>
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
                                        {day.participants.length > 0 ? day.participants.map(p => (
                                            <span key={p} className="px-2 py-0.5 bg-background border rounded text-[10px] font-medium">
                                                {p}
                                            </span>
                                        )) : <span className="text-destructive text-[10px] italic">Warga tidak cukup</span>}
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
            </CardFooter>
          </Card>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl opacity-50 bg-muted/20">
              <Wand2 className="h-12 w-12 mb-4 text-muted-foreground" />
              <p className="text-sm font-medium">Belum ada pratinjau</p>
              <p className="text-xs text-muted-foreground text-center mt-1">Klik Generate untuk membagi warga ke jadwal sebulan penuh tanpa ada yang ganda.</p>
          </div>
        )}
      </div>
    </div>
  );
}
