'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, collectionGroup, doc } from 'firebase/firestore';
import type { RondaSchedule, Warga } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Combobox } from '@/components/ui/combobox';
import { Search, UserMinus, UserPlus, Loader2 } from 'lucide-react';

export function ReplacementManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });
    const [searchQuery, setSearchQuery] = useState('');

    const schedulesQuery = useMemoFirebase(() => (firestore ? collectionGroup(firestore, 'rondaSchedules') : null), [firestore]);
    const { data: allSchedules, isLoading: isSchedulesLoading } = useCollection<RondaSchedule>(schedulesQuery);

    const usersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'users') : null), [firestore]);
    const { data: allUsers, isLoading: isUsersLoading } = useCollection<Warga>(usersQuery);

    const usersMap = useMemo(() => new Map(allUsers?.map((user) => [user.id, user])), [allUsers]);

    const schedulesForMonth = useMemo(() => {
        if (!allSchedules || !usersMap.size) return [];
        const [year, month] = selectedMonth.split('-').map(Number);
        
        let filtered = allSchedules.filter(s => {
            const d = new Date(s.date);
            return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
        });

        const mapped = filtered.map(s => ({ 
            ...s, 
            userName: usersMap.get(s.userId)?.name || 'Unknown' 
        }));

        if (searchQuery) {
            const lowQuery = searchQuery.toLowerCase();
            return mapped.filter(s => 
                s.userName.toLowerCase().includes(lowQuery) || 
                (s.replacementUserName && s.replacementUserName.toLowerCase().includes(lowQuery))
            ).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        }

        return mapped.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [allSchedules, usersMap, selectedMonth, searchQuery]);

    const replacementOptions = useMemo(() => {
        if (!allUsers) return [];
        return [
            { value: 'clear', label: '--- Hapus Pengganti (Kembali ke Asli) ---' },
            ...allUsers.map(u => ({ 
                value: u.id, 
                label: `${u.name} (${u.role === 'backup' ? 'Backup' : u.address})` 
            }))
        ];
    }, [allUsers]);

    const handleReplacementChange = (schedule: any, newReplacementId: string) => {
        if (!firestore) return;
        
        const isClearing = newReplacementId === 'clear' || !newReplacementId;
        const replacementUser = isClearing ? null : allUsers?.find(u => u.id === newReplacementId);
        
        const scheduleRef = doc(firestore, 'users', schedule.userId, 'rondaSchedules', schedule.id);
        
        updateDocumentNonBlocking(scheduleRef, {
            replacementUserId: isClearing ? null : newReplacementId,
            replacementUserName: isClearing ? null : replacementUser?.name,
        });

        toast({ 
            title: isClearing ? 'Pengganti Dihapus' : 'Pengganti Berhasil Dipasang', 
            description: isClearing ? `Jadwal ${schedule.userName} kembali ke nama asli.` : `${replacementUser?.name} sekarang menggantikan ${schedule.userName}.` 
        });
    };

    const isLoading = isSchedulesLoading || isUsersLoading;

    return (
        <div className="space-y-6">
            <Card className="shadow-lg border-none">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Kelola Pengganti / Tukar Nama
                    </CardTitle>
                    <CardDescription>
                        Gunakan menu ini untuk mengganti nama warga pada tanggal yang sudah ada di jadwal tanpa menghapus data asli.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Pilih Bulan</label>
                            <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Cari Nama Warga</label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input 
                                    placeholder="Cari warga asli atau pengganti..." 
                                    className="pl-8"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border rounded-xl overflow-hidden bg-card">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-[150px]">Tanggal</TableHead>
                                    <TableHead>Warga Asli</TableHead>
                                    <TableHead className="w-[300px]">Nama Pengganti (Jika Ada)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-20">
                                            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                                            <p className="mt-2 text-muted-foreground">Memuat data jadwal...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : schedulesForMonth.length > 0 ? (
                                    schedulesForMonth.map((s) => (
                                        <TableRow key={s.id} className="hover:bg-muted/30">
                                            <TableCell className="font-medium">
                                                {format(new Date(s.date), 'dd MMM yyyy', { locale: idLocale })}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold">{s.userName}</span>
                                                    <span className="text-xs text-muted-foreground">{usersMap.get(s.userId)?.address || '-'}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Combobox 
                                                    value={s.replacementUserId || ''} 
                                                    onValueChange={(id) => handleReplacementChange(s, id)}
                                                    options={replacementOptions}
                                                    placeholder="Pilih warga pengganti..."
                                                    searchPlaceholder="Cari nama warga/backup..."
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-20 text-muted-foreground italic">
                                            Tidak ada jadwal ditemukan untuk bulan/pencarian ini.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <div className="grid md:grid-cols-2 gap-6">
                <Card className="bg-primary/5 border-dashed border-primary/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-primary flex items-center gap-2">
                            <UserPlus className="h-4 w-4" /> CARA MENGGANTI NAMA
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2 text-muted-foreground">
                        <p>1. Pilih bulan jadwal yang ingin diubah.</p>
                        <p>2. Cari nama warga asli yang ingin diganti posisinya.</p>
                        <p>3. Pilih nama pengganti dari daftar (Bisa warga lain atau tim Backup).</p>
                        <p>4. Nama pengganti akan otomatis tampil di dashboard dan hasil cetak PDF.</p>
                    </CardContent>
                </Card>

                <Card className="bg-orange-50/50 border-dashed border-orange-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold text-orange-600 flex items-center gap-2">
                            <UserMinus className="h-4 w-4" /> CARA MENGHAPUS PENGGANTI
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs space-y-2 text-muted-foreground">
                        <p>1. Cari warga yang memiliki status pengganti.</p>
                        <p>2. Pada kolom pengganti, pilih opsi <b>"--- Hapus Pengganti ---"</b> di bagian paling atas daftar.</p>
                        <p>3. Jadwal akan otomatis kembali menggunakan nama warga asli.</p>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}