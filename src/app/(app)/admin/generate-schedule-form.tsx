'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useMemo, useEffect } from 'react';
import { Loader2, Wand2, Save, Trash2, AlertCircle, Database, LayoutPanelTop } from 'lucide-react';
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

  // Derive existing schedule data from database for the selected month
  const existingScheduleData = useMemo(() => {
    if (!month || !allSchedules || !usersIdMap.size) return null;

    const [year, monthNum] = month.split('-').map(Number);
    const startDate = new Date(Date.UTC(year, monthNum - 1, 1));
    const endDate = new Date(Date.UTC(year, monthNum, 1));

    const monthSchedules = allSchedules.filter(s => {
        const d = new Date(s.date);
        return d >= startDate && d < endDate;
    });

    if (monthSchedules.length === 0) return null;

    const grouped: { [key: string]: string[] } = {};
    monthSchedules.forEach(s => {
        const dateStr = new Date(s.date).toISOString().split('T')[0];
        if (!grouped[dateStr]) grouped[dateStr] = [];
        const userName = usersIdMap.get(s.userId)?.name || 'Unknown';
        grouped[dateStr].push(userName);
    });

    return Object.entries(grouped).map(([date, participants]) => ({
        date,
        participants: participants.sort()
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [month, allSchedules, usersIdMap]);

  useEffect(() => {
    setHasExistingSchedule(!!existingScheduleData);
  }, [existingScheduleData]);

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

    setTimeout(() => {
        try {
            const [year, monthNum] = month.split('-').map(Number);
            const daysInMonth = new Date(year, monthNum, 0).getDate();
            const dailyAssignments: string[][] = Array.from({ length: daysInMonth }, () => []);

            let allParticipants = users.filter(u => 
                u.role === 'user' || 
                u.role === 'coordinator' ||
                (u.role === 'backup' && u.includeInSchedule === true)
            );

            const approvedRequestsForMonth = (requests || []).filter(req => {
                if (req.status !== 'approved') return false;
                const reqDate = new Date(req.requestedScheduleDate);
                return reqDate.getUTCFullYear() === year && (reqDate.getUTCMonth() + 1) === monthNum;
            });

            const assignedUserIds = new Set<string>();

            approvedRequestsForMonth.forEach(req => {
                const user = usersIdMap.get(req.userId);
                if (user && !assignedUserIds.has(user.id)) {
                    const reqDate = new Date(req.requestedScheduleDate);
                    const dayIndex = reqDate.getUTCDate() - 1;
                    if (dayIndex >= 0 && dayIndex < daysInMonth) {
                        dailyAssignments[dayIndex].push(user.name);
                        assignedUserIds.add(user.id);
                    }
                }
            });

            let remainingWarga = allParticipants
                .filter(u => !assignedUserIds.has(u.id))
                .sort(() => Math.random() - 0.5);

            for (let d = 0; d < daysInMonth; d++) {
                while (dailyAssignments[d].length < 2 && remainingWarga.length > 0) {
                    const candidate = remainingWarga.pop();
                    if (candidate) {
                        dailyAssignments[d].push(candidate.name);
                        assignedUserIds.add(candidate.id);
                    }
                }
            }

            for (let d = 0; d < daysInMonth; d++) {
                while (dailyAssignments[d].length < 3 && remainingWarga.length > 0) {
                    const candidate = remainingWarga.pop();
                    if (candidate) {
                        dailyAssignments[d].push(candidate.name);
                        assignedUserIds.add(candidate.id);
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
            toast({ title: "Berhasil!", description: "Pratinjau jadwal dibuat sesuai aturan." });
        } catch (e) {
            toast({ title: "Error", description: "Gagal generate jadwal.", variant: "destructive" });
        } finally {
            setIsGenerating(false);
        }
    }, 100);
  };

  const handleSaveSchedule = async () => {
    if (!generatedSchedule || !firestore || !month) return;
    setIsSaving(true);
    const usersByName = new Map<string, string>();
    users?.forEach(u => usersByName.set(u.name.toLowerCase().trim(), u.id));

    try {
        const batch = writeBatch(firestore);
        const [year, monthNum] = month.split('-').map(Number);
        const start = new Date(Date.UTC(year, monthNum - 1, 1));
        const end = new Date(Date.UTC(year, monthNum, 1));

        const toDelete = (allSchedules || []).filter(s => {
            const d = new Date(s.date);
            return d >= start && d < end;
        });
        toDelete.forEach(s => batch.delete(doc(firestore, 'users', s.userId, 'rondaSchedules', s.id)));

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
        toast({ title: 'Berhasil!', description: 'Jadwal telah disimpan.' });
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

  const displayData = generatedSchedule || existingScheduleData;
  const isPreview = !!generatedSchedule;

  return (
    <div className="grid md:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="month">Pilih Bulan (YYYY-MM)</Label>
          <Input id="month" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setGeneratedSchedule(null); }} disabled={isLoading || isGenerating} />
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleGenerateClick} disabled={isGenerating || !month || isLoading}>
            {isGenerating ? <Loader2 className="animate-spin mr-2" /> : <Wand2 className="mr-2" />}
            Generate Pratinjau
          </Button>

          {hasExistingSchedule && !isPreview && (
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
                              Ini akan menghapus jadwal permanen dari database untuk bulan {month}.
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

          {isPreview && (
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
        {displayData ? (
          <Card className={cn(
            "shadow-none border-2",
            isPreview ? "bg-primary/5 border-dashed border-primary/30" : "bg-green-50/30 border-green-200"
          )}>
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        {isPreview ? <Wand2 className="h-5 w-5 text-primary" /> : <Database className="h-5 w-5 text-green-600" />}
                        {isPreview ? "Pratinjau Jadwal Baru" : "Jadwal Aktif (DB)"}
                    </div>
                    <Badge variant={isPreview ? "default" : "secondary"}>
                        {displayData.length} Hari
                    </Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[500px] overflow-auto p-0 border-t">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tanggal</TableHead>
                            <TableHead>Warga Ronda</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayData.map((day) => (
                            <TableRow key={day.date} className="hover:bg-transparent">
                                <TableCell className="font-medium text-xs whitespace-nowrap">
                                    {format(new Date(day.date + 'T00:00:00Z'), 'dd MMM yyyy', { locale: idLocale })}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-wrap gap-1">
                                        {day.participants.length > 0 ? day.participants.map(p => (
                                            <span key={p} className={cn(
                                                "px-2 py-0.5 border rounded text-[10px] font-medium",
                                                isPreview ? "bg-white" : "bg-green-100/50 border-green-200"
                                            )}>
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
            {isPreview && (
                <CardFooter className="pt-4 flex flex-col gap-2 bg-muted/20">
                    <Button className="w-full" onClick={handleSaveSchedule} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                        Simpan dan Aktifkan Jadwal
                    </Button>
                </CardFooter>
            )}
          </Card>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-xl opacity-50 bg-muted/20">
              <LayoutPanelTop className="h-12 w-12 mb-4 text-muted-foreground" />
              <p className="text-sm font-medium">Belum ada data jadwal</p>
              <p className="text-xs text-muted-foreground text-center mt-1">Pilih bulan dan klik Generate untuk memulai, atau pilih bulan yang sudah memiliki jadwal.</p>
          </div>
        )}
      </div>
    </div>
  );
}