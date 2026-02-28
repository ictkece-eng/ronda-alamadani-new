'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useMemo } from 'react';
import { Loader2, Wand2, Save, Trash2, AlertCircle, Database, LayoutPanelTop, UserRoundPen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
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
import { Combobox } from '@/components/ui/combobox';

type ParticipantInfo = {
    userId: string;
    name: string;
    docId?: string; // Hanya ada jika sudah di DB
};

type GeneratedSchedule = {
  date: string;
  participants: ParticipantInfo[];
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

  const userOptions = useMemo(() => {
      if (!users) return [];
      return users.map(u => ({
          value: u.id,
          label: `${u.name} (${u.role === 'backup' ? 'Backup' : u.address})`
      })).sort((a, b) => a.label.localeCompare(b.label));
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

    const grouped: { [key: string]: ParticipantInfo[] } = {};
    monthSchedules.forEach(s => {
        const dateStr = new Date(s.date).toISOString().split('T')[0];
        if (!grouped[dateStr]) grouped[dateStr] = [];
        
        grouped[dateStr].push({
            userId: s.userId,
            name: s.replacementUserName || usersIdMap.get(s.userId)?.name || 'Unknown',
            docId: s.id
        });
    });

    return Object.entries(grouped).map(([date, participants]) => ({
        date,
        participants: participants.sort((a, b) => a.name.localeCompare(b.name))
    })).sort((a, b) => a.date.localeCompare(b.date));
  }, [month, allSchedules, usersIdMap]);

  const hasExistingSchedule = !!existingScheduleData;
  const displayData = generatedSchedule || existingScheduleData;
  const isPreview = !!generatedSchedule;

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
            const dailyAssignments: ParticipantInfo[][] = Array.from({ length: daysInMonth }, () => []);

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

            // 1. Fill from requests
            approvedRequestsForMonth.forEach(req => {
                const user = usersIdMap.get(req.userId);
                if (user && !assignedUserIds.has(user.id)) {
                    const reqDate = new Date(req.requestedScheduleDate);
                    const dayIndex = reqDate.getUTCDate() - 1;
                    if (dayIndex >= 0 && dayIndex < daysInMonth) {
                        dailyAssignments[dayIndex].push({ userId: user.id, name: user.name });
                        assignedUserIds.add(user.id);
                    }
                }
            });

            // 2. Fill sisa warga (Anti-Double Shift)
            let remainingWarga = allParticipants
                .filter(u => !assignedUserIds.has(u.id))
                .sort(() => Math.random() - 0.5);

            // Fill each night to at least 2 people if possible
            for (let d = 0; d < daysInMonth; d++) {
                while (dailyAssignments[d].length < 2 && remainingWarga.length > 0) {
                    const candidate = remainingWarga.pop();
                    if (candidate) {
                        dailyAssignments[d].push({ userId: candidate.id, name: candidate.name });
                        assignedUserIds.add(candidate.id);
                    }
                }
            }

            // Fill to 3 people if sisa masih ada
            for (let d = 0; d < daysInMonth; d++) {
                while (dailyAssignments[d].length < 3 && remainingWarga.length > 0) {
                    const candidate = remainingWarga.pop();
                    if (candidate) {
                        dailyAssignments[d].push({ userId: candidate.id, name: candidate.name });
                        assignedUserIds.add(candidate.id);
                    }
                }
            }

            const newSchedule: GeneratedSchedule[] = dailyAssignments.map((participants, i) => {
                const date = new Date(Date.UTC(year, monthNum - 1, i + 1));
                return {
                    date: date.toISOString().split('T')[0],
                    participants: participants.sort((a, b) => a.name.localeCompare(b.name)),
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

    try {
        const batch = writeBatch(firestore);
        const [year, monthNum] = month.split('-').map(Number);
        const start = new Date(Date.UTC(year, monthNum - 1, 1));
        const end = new Date(Date.UTC(year, monthNum, 1));

        // Delete existing for this month
        const toDelete = (allSchedules || []).filter(s => {
            const d = new Date(s.date);
            return d >= start && d < end;
        });
        toDelete.forEach(s => batch.delete(doc(firestore, 'users', s.userId, 'rondaSchedules', s.id)));

        // Add new
        for (const day of generatedSchedule) {
            for (const participant of day.participants) {
                const ref = doc(collection(firestore, 'users', participant.userId, 'rondaSchedules'));
                batch.set(ref, {
                    id: ref.id,
                    userId: participant.userId,
                    date: new Date(day.date + 'T00:00:00Z').toISOString(),
                    startTime: '22:00',
                    endTime: '06:00',
                    replacementUserId: null,
                    replacementUserName: null,
                });
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

  const handleParticipantChange = (date: string, oldUserId: string, newUserId: string, docId?: string) => {
      if (!newUserId || newUserId === oldUserId) return;
      const newUser = usersIdMap.get(newUserId);
      if (!newUser) return;

      if (isPreview) {
          // Update local preview state
          const updated = (generatedSchedule || []).map(day => {
              if (day.date === date) {
                  return {
                      ...day,
                      participants: day.participants.map(p => 
                          p.userId === oldUserId ? { userId: newUser.id, name: newUser.name } : p
                      )
                  };
              }
              return day;
          });
          setGeneratedSchedule(updated);
          toast({ title: "Berhasil", description: `Pratinjau diubah: ${newUser.name}` });
      } else if (docId && firestore) {
          // Update directly to DB via replacement mechanism
          const scheduleRef = doc(firestore, 'users', oldUserId, 'rondaSchedules', docId);
          updateDocumentNonBlocking(scheduleRef, {
              replacementUserId: newUser.id,
              replacementUserName: newUser.name
          });
          toast({ title: "Berhasil", description: `${newUser.name} kini menggantikan warga di database.` });
      }
  };

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

        <Alert className="bg-blue-50 border-blue-200">
            <UserRoundPen className="h-4 w-4 text-blue-600" />
            <AlertTitle className="text-blue-600">Ganti Nama Langsung</AlertTitle>
            <AlertDescription className="text-xs text-blue-800">
                Anda bisa langsung klik pada nama warga di tabel sebelah kanan untuk menggantinya dengan warga lain tanpa harus pindah menu.
            </AlertDescription>
        </Alert>

        <Alert className="bg-primary/5 border-primary/20">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertTitle>Aturan Penjadwalan Adil</AlertTitle>
            <AlertDescription className="text-xs space-y-1 mt-1">
                <p>• <b>Anti-Double:</b> Menjamin warga tidak ronda ganda dalam sebulan.</p>
                <p>• <b>Keamanan:</b> Target 2-3 orang per malam.</p>
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
            <CardContent className="max-h-[600px] overflow-auto p-0 border-t">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-24">Tanggal</TableHead>
                            <TableHead>Warga Ronda (Klik untuk Ganti)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayData.map((day) => (
                            <TableRow key={day.date} className="hover:bg-transparent">
                                <TableCell className="font-medium text-xs whitespace-nowrap align-top pt-4">
                                    {format(new Date(day.date + 'T00:00:00Z'), 'dd MMM yyyy', { locale: idLocale })}
                                </TableCell>
                                <TableCell className="py-2">
                                    <div className="flex flex-col gap-2">
                                        {day.participants.length > 0 ? day.participants.map((p, idx) => (
                                            <div key={`${day.date}-${p.userId}-${idx}`} className="w-full">
                                                <Combobox 
                                                    value={p.userId} 
                                                    onValueChange={(newId) => handleParticipantChange(day.date, p.userId, newId, p.docId)}
                                                    options={userOptions}
                                                    placeholder="Pilih warga..."
                                                    className={cn(
                                                        "h-8 text-[11px] justify-start",
                                                        isPreview ? "bg-white" : "bg-green-100/30 border-green-200"
                                                    )}
                                                />
                                            </div>
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
