'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useState, useMemo } from 'react';
import { Loader2, Wand2, Save, Trash2, AlertCircle, Database, LayoutPanelTop, UserRoundPen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
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
    docId?: string;
    sourceUserId?: string;
    isLocked?: boolean;
    lockReason?: 'approved-request' | 'teacher';
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
    const { user } = useUser();

    const usersCollection = useMemoFirebase(
        () => (firestore ? collection(firestore, 'users') : null),
        [firestore]
    );
    const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersCollection);

    const requestsQuery = useMemoFirebase(
        () => (firestore && user ? query(collectionGroup(firestore, 'scheduleRequests')) : null),
        [firestore, user]
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
            const effectiveUserId = s.replacementUserId || s.userId;
            const effectiveUser = usersIdMap.get(effectiveUserId);
        
                grouped[dateStr].push({
                userId: effectiveUserId,
                name: effectiveUser?.name || s.replacementUserName || usersIdMap.get(s.userId)?.name || 'Unknown',
                docId: s.id,
                sourceUserId: s.userId,
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
                toast({ title: 'Error', description: 'Pilih bulan terlebih dahulu.', variant: 'destructive' });
                return;
        }
    
        if (!users || users.length < 2) {
                toast({ title: 'Error', description: 'Minimal harus ada 2 warga ronda untuk generate jadwal.', variant: 'destructive' });
                return;
        }

        setIsGenerating(true);
        setGeneratedSchedule(null);

        setTimeout(() => {
                try {
                        const [year, monthNum] = month.split('-').map(Number);
                        const daysInMonth = new Date(year, monthNum, 0).getDate();
                        const dailyAssignments: ParticipantInfo[][] = Array.from({ length: daysInMonth }, () => []);
                    const MAX_PARTICIPANTS_PER_DAY = 3;

                const getDayIndex = (dateLike: string | Date) => {
                    const date = typeof dateLike === 'string' ? new Date(dateLike) : dateLike;
                    return date.getUTCDay();
                };

                const fridaySaturdayIndices = Array.from({ length: daysInMonth }, (_, index) => index).filter((index) => {
                    const date = new Date(Date.UTC(year, monthNum - 1, index + 1));
                    const day = getDayIndex(date);
                    return day === 5 || day === 6;
                });

                const sortByLeastFilled = (indices: number[]) => {
                    return [...indices].sort((a, b) => {
                        const countDiff = dailyAssignments[a].length - dailyAssignments[b].length;
                        return countDiff !== 0 ? countDiff : a - b;
                    });
                };

                const assignParticipantToDay = (dayIndex: number, participant: ParticipantInfo) => {
                    if (dayIndex < 0 || dayIndex >= daysInMonth) return false;
                    if (assignedUserIds.has(participant.userId)) return false;
                    if (dailyAssignments[dayIndex].length >= MAX_PARTICIPANTS_PER_DAY) return false;

                    dailyAssignments[dayIndex].push(participant);
                    assignedUserIds.add(participant.userId);
                    return true;
                };

                const findBestAvailableSlot = (preferredIndices: number[] = [], fallbackIndices?: number[]) => {
                    const hasCapacity = (dayIndex: number) => dailyAssignments[dayIndex].length < MAX_PARTICIPANTS_PER_DAY;

                    const preferredAvailable = sortByLeastFilled(
                        preferredIndices.filter((dayIndex) => dayIndex >= 0 && dayIndex < daysInMonth && hasCapacity(dayIndex))
                    );
                    if (preferredAvailable.length > 0) {
                        return preferredAvailable[0];
                    }

                    const fallbackPool = fallbackIndices ?? Array.from({ length: daysInMonth }, (_, index) => index);
                    const fallbackAvailable = sortByLeastFilled(
                        fallbackPool.filter((dayIndex) => dayIndex >= 0 && dayIndex < daysInMonth && hasCapacity(dayIndex))
                    );

                    return fallbackAvailable[0];
                };

                const assignUserToDay = (
                    userRecord: Warga,
                    preferredIndices: number[] = [],
                    options?: Pick<ParticipantInfo, 'isLocked' | 'lockReason'>
                ) => {
                    if (assignedUserIds.has(userRecord.id)) return false;

                    const targetDayIndex = findBestAvailableSlot(preferredIndices, Array.from({ length: daysInMonth }, (_, index) => index));

                    if (typeof targetDayIndex !== 'number' || targetDayIndex < 0 || targetDayIndex >= daysInMonth) return false;

                    return assignParticipantToDay(targetDayIndex, {
                        userId: userRecord.id,
                        name: userRecord.name,
                        ...options,
                    });
                };

                        const allParticipants = users.filter(u => 
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
                                const userRecord = usersIdMap.get(req.userId);
                                if (userRecord && !assignedUserIds.has(userRecord.id)) {
                                        const reqDate = new Date(req.requestedScheduleDate);
                                        const dayIndex = reqDate.getUTCDate() - 1;
                                    if (dayIndex >= 0 && dayIndex < daysInMonth) {
                                        const assigned = assignParticipantToDay(dayIndex, {
                                            userId: userRecord.id,
                                            name: userRecord.name,
                                            isLocked: true,
                                            lockReason: 'approved-request',
                                        });

                                        if (!assigned) {
                                            throw new Error(`Tanggal request ${format(reqDate, 'dd MMM yyyy', { locale: idLocale })} sudah penuh. Kurangi request approved di tanggal tersebut lalu generate ulang.`);
                                        }
                                    }
                                }
                        });

                        const teacherParticipants = allParticipants.filter((participant) => participant.isTeacher === true && !assignedUserIds.has(participant.id));
                        teacherParticipants.forEach((teacher) => {
                                assignUserToDay(teacher, fridaySaturdayIndices, {
                                    isLocked: true,
                                    lockReason: 'teacher',
                                });
                        });

                        const remainingWarga = allParticipants
                                .filter(u => !assignedUserIds.has(u.id))
                                .sort(() => Math.random() - 0.5);

                        for (let d = 0; d < daysInMonth; d++) {
                            while (dailyAssignments[d].length < 2 && dailyAssignments[d].length < MAX_PARTICIPANTS_PER_DAY && remainingWarga.length > 0) {
                                        const candidate = remainingWarga.pop();
                                        if (candidate) {
                                                dailyAssignments[d].push({ userId: candidate.id, name: candidate.name });
                                                assignedUserIds.add(candidate.id);
                                        }
                                }
                        }

                        for (let d = 0; d < daysInMonth; d++) {
                            while (dailyAssignments[d].length < MAX_PARTICIPANTS_PER_DAY && remainingWarga.length > 0) {
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
                        toast({ title: 'Berhasil!', description: 'Pratinjau jadwal dibuat sesuai aturan.' });
                } catch {
                        toast({ title: 'Error', description: 'Gagal generate jadwal.', variant: 'destructive' });
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

                const toDelete = (allSchedules || []).filter(s => {
                        const d = new Date(s.date);
                        return d >= start && d < end;
                });
                toDelete.forEach(s => batch.delete(doc(firestore, 'users', s.userId, 'rondaSchedules', s.id)));

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
        } catch {
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
        } catch {
                toast({ title: 'Error', description: 'Gagal menghapus data.', variant: 'destructive' });
        } finally {
                setIsClearing(false);
        }
    };

        const handleParticipantChange = async (date: string, oldUserId: string, newUserId: string, docId?: string, sourceUserId?: string) => {
            if (!newUserId || newUserId === oldUserId) return;
            const newUser = usersIdMap.get(newUserId);
            if (!newUser) return;

            const targetDay = displayData?.find((day) => day.date === date);
            const isAlreadyAssignedThatNight = targetDay?.participants.some((participant) => participant.userId === newUserId && participant.userId !== oldUserId);

            if (isAlreadyAssignedThatNight) {
                toast({
                    title: 'Nama Sudah Terdaftar',
                    description: `${newUser.name} sudah terjadwal pada tanggal ini. Pilih warga lain agar tidak dobel satu malam.`,
                    variant: 'destructive',
                });
                return;
            }

            if (isPreview) {
                const targetParticipant = (generatedSchedule || [])
                .find((day) => day.date === date)
                ?.participants.find((participant) => participant.userId === oldUserId);

                if (targetParticipant?.isLocked) {
                    const reasonLabel = targetParticipant.lockReason === 'approved-request' ? 'request approved' : 'status guru';
                    toast({
                    title: 'Nama Terkunci',
                    description: `Warga ini dikunci karena prioritas ${reasonLabel} dan tidak bisa diganti di mode pratinjau.`,
                    variant: 'destructive',
                    });
                    return;
                }

                    const updated = (generatedSchedule || []).map(day => ({
                            ...day,
                            participants: day.participants.map(p => 
                        p.userId === oldUserId ? { ...p, userId: newUser.id, name: newUser.name } : p
                            )
                    }));
                    setGeneratedSchedule(updated);
                    toast({ title: 'Berhasil', description: `Pratinjau diubah: ${newUser.name}` });
            } else if (docId && firestore) {
                    const owningUserId = sourceUserId || oldUserId;
                    const scheduleRecord = (allSchedules || []).find((schedule) => schedule.id === docId && schedule.userId === owningUserId);

                    if (!scheduleRecord) {
                        toast({
                            title: 'Data Tidak Ditemukan',
                            description: 'Data jadwal yang ingin dipindahkan tidak ditemukan. Silakan muat ulang halaman.',
                            variant: 'destructive',
                        });
                        return;
                    }

                    try {
                        const batch = writeBatch(firestore);
                        const currentScheduleRef = doc(firestore, 'users', owningUserId, 'rondaSchedules', docId);

                        if (owningUserId === newUser.id) {
                            batch.update(currentScheduleRef, {
                                userId: newUser.id,
                                replacementUserId: null,
                                replacementUserName: null,
                            });
                        } else {
                            const movedScheduleRef = doc(firestore, 'users', newUser.id, 'rondaSchedules', docId);
                            batch.set(movedScheduleRef, {
                                ...scheduleRecord,
                                userId: newUser.id,
                                replacementUserId: null,
                                replacementUserName: null,
                            });
                            batch.delete(currentScheduleRef);
                        }

                        await batch.commit();
                        toast({
                            title: 'Jadwal Dipindahkan',
                            description: `${newUser.name} sekarang menjadi warga ronda aktif pada ${format(new Date(date + 'T00:00:00Z'), 'dd MMM yyyy', { locale: idLocale })}.`,
                        });
                    } catch {
                        toast({
                            title: 'Gagal Memindahkan Jadwal',
                            description: 'Perubahan belum tersimpan ke database. Coba lagi sebentar.',
                            variant: 'destructive',
                        });
                    }
            }
    };

    return (
        <div className="row g-4 align-items-start">
            <div className="col-12 col-xl-5">
                <div className="space-y-4">
                    <Card className="border-0 shadow-sm app-surface overflow-hidden">
                        <CardContent className="p-4 p-lg-4">
                            <div className="d-flex align-items-start gap-3">
                                <div className="rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-10 p-3 text-primary">
                                    <Wand2 className="h-5 w-5" />
                                </div>
                                <div>
                                    <div className="small text-uppercase fw-semibold text-primary mb-1">Generate Schedule</div>
                                    <h3 className="h5 fw-bold mb-2">Buat dan kelola jadwal ronda bulanan</h3>
                                    <p className="text-muted mb-0 small">Preview jadwal, edit peserta langsung dari tabel, lalu simpan ke database saat sudah final.</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-0 shadow-sm app-surface">
                        <CardContent className="p-4 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="month">Pilih Bulan (YYYY-MM)</Label>
                                <Input id="month" className="rounded-pill" type="month" value={month} onChange={(e) => { setMonth(e.target.value); setGeneratedSchedule(null); }} disabled={isLoading || isGenerating} />
                            </div>
                            <div className="d-flex flex-wrap gap-2">
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
                        </CardContent>
                    </Card>

                    <Alert className="bg-blue-50 border-blue-200 rounded-4 shadow-sm">
                        <UserRoundPen className="h-4 w-4 text-blue-600" />
                        <AlertTitle className="text-blue-600">Pindah Nama Langsung</AlertTitle>
                        <AlertDescription className="text-xs text-blue-800">
                            Pada jadwal yang sudah tersimpan, klik nama warga di tabel sebelah kanan untuk memindahkan jadwal langsung ke warga lain tanpa lewat menu replacement.
                        </AlertDescription>
                    </Alert>

                    <Alert className="bg-primary/5 border-primary/20 rounded-4 shadow-sm">
                        <AlertCircle className="h-4 w-4 text-primary" />
                        <AlertTitle>Aturan Penjadwalan Adil</AlertTitle>
                        <AlertDescription className="text-xs space-y-1 mt-1">
                            <p>• <b>Anti-Double:</b> Menjamin warga tidak ronda ganda dalam sebulan.</p>
                            <p>• <b>Keamanan:</b> Target 2-3 orang per malam.</p>
                            <p>• <b>Prioritas Request:</b> Mengunci tanggal bagi warga yang pengajuannya sudah disetujui.</p>
                            <p>• <b>Prioritas Jumat/Sabtu:</b> Warga dengan request yang disetujui dan warga berstatus guru diprioritaskan ke jadwal hari Jumat atau Sabtu.</p>
                        </AlertDescription>
                    </Alert>
                </div>
            </div>

            <div className="col-12 col-xl-7">
                {displayData ? (
                    <Card className={cn('shadow-sm border-2 overflow-hidden', isPreview ? 'bg-primary/5 border-dashed border-primary/30' : 'bg-green-50/30 border-green-200')}>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex justify-between items-center">
                                <div className="flex items-center gap-2">
                                    {isPreview ? <Wand2 className="h-5 w-5 text-primary" /> : <Database className="h-5 w-5 text-green-600" />}
                                    {isPreview ? 'Pratinjau Jadwal Baru' : 'Jadwal Aktif (DB)'}
                                </div>
                                <Badge variant={isPreview ? 'default' : 'secondary'}>{displayData.length} Hari</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="max-h-[600px] overflow-auto p-0 border-t bg-white">
                            <Table>
                                <TableHeader className="bg-body-tertiary">
                                    <TableRow>
                                        <TableHead className="w-24">Tanggal</TableHead>
                                        <TableHead>Warga Ronda (Klik untuk Pindah)</TableHead>
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
                                                            {isPreview && p.isLocked ? (
                                                                <div className="d-flex align-items-center justify-content-between gap-2 rounded-3 border border-primary border-opacity-25 bg-primary bg-opacity-10 px-3 py-2">
                                                                    <div className="d-flex flex-column">
                                                                        <span className="fw-semibold text-body small">{p.name}</span>
                                                                        <span className="text-muted small">
                                                                            {p.lockReason === 'approved-request' ? 'Terkunci dari request approved' : 'Terkunci karena status guru'}
                                                                        </span>
                                                                    </div>
                                                                    <Badge variant="outline" className="border-primary text-primary">Locked</Badge>
                                                                </div>
                                                            ) : (
                                                                <Combobox 
                                                                    value={p.userId}
                                                                    onValueChange={(newId) => handleParticipantChange(day.date, p.userId, newId, p.docId, p.sourceUserId)}
                                                                    options={userOptions}
                                                                    placeholder="Pilih warga..."
                                                                    className={cn('h-8 text-[11px] justify-start', isPreview ? 'bg-white' : 'bg-green-100/30 border-green-200')}
                                                                />
                                                            )}
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
                            <CardFooter className="pt-4 flex flex-col gap-2 bg-muted/20 border-top">
                                <Button className="w-full" onClick={handleSaveSchedule} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                                    Simpan dan Aktifkan Jadwal
                                </Button>
                            </CardFooter>
                        )}
                    </Card>
                ) : (
                    <div className="h-full min-h-[420px] flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-4 opacity-75 bg-white shadow-sm">
                        <LayoutPanelTop className="h-12 w-12 mb-4 text-muted-foreground" />
                        <p className="text-sm font-medium">Belum ada data jadwal</p>
                        <p className="text-xs text-muted-foreground text-center mt-1">Pilih bulan dan klik Generate untuk memulai, atau pilih bulan yang sudah memiliki jadwal.</p>
                    </div>
                )}
            </div>
        </div>
    );
}