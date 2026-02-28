'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, updateDocumentNonBlocking } from '@/firebase';
import { collection, collectionGroup, doc } from 'firebase/firestore';
import type { RondaSchedule, Warga } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Combobox } from '@/components/ui/combobox';

export function ReplacementManagement() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });

    const schedulesQuery = useMemoFirebase(() => (firestore ? collectionGroup(firestore, 'rondaSchedules') : null), [firestore]);
    const { data: allSchedules, isLoading: isSchedulesLoading } = useCollection<RondaSchedule>(schedulesQuery);

    const usersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'users') : null), [firestore]);
    const { data: allUsers, isLoading: isUsersLoading } = useCollection<Warga>(usersQuery);

    const usersMap = useMemo(() => new Map(allUsers?.map((user) => [user.id, user])), [allUsers]);

    const schedulesForMonth = useMemo(() => {
        if (!allSchedules || !usersMap.size) return [];
        const [year, month] = selectedMonth.split('-').map(Number);
        return allSchedules
            .filter(s => {
                const d = new Date(s.date);
                return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
            })
            .map(s => ({ ...s, userName: usersMap.get(s.userId)?.name || 'Unknown' }))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [allSchedules, usersMap, selectedMonth]);

    const handleReplacementChange = (schedule: any, newReplacementId: string) => {
        if (!firestore) return;
        const replacementUser = allUsers?.find(u => u.id === newReplacementId);
        const scheduleRef = doc(firestore, 'users', schedule.userId, 'rondaSchedules', schedule.id);
        updateDocumentNonBlocking(scheduleRef, {
            replacementUserId: newReplacementId === 'clear' ? null : newReplacementId,
            replacementUserName: newReplacementId === 'clear' ? null : replacementUser?.name,
        });
        toast({ title: 'Success', description: 'Replacement updated.' });
    };

    return (
        <Card className="shadow-lg border-none">
            <CardHeader><CardTitle>Manage Replacements</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <Input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} />
                <div className="border rounded-lg overflow-hidden">
                    <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Warga</TableHead><TableHead>Replacement</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {isSchedulesLoading ? <TableRow><TableCell colSpan={3} className="text-center">Loading...</TableCell></TableRow> : schedulesForMonth.map((s) => (
                                <TableRow key={s.id}>
                                    <TableCell>{format(new Date(s.date), 'dd MMM yyyy', { locale: idLocale })}</TableCell>
                                    <TableCell>{s.userName}</TableCell>
                                    <TableCell>
                                        <Combobox 
                                            value={s.replacementUserId || ''} 
                                            onValueChange={(id) => handleReplacementChange(s, id)}
                                            options={[
                                                { value: 'clear', label: 'No Replacement' },
                                                ...(allUsers?.filter(u => u.role === 'backup').map(u => ({ value: u.id, label: u.name })) || [])
                                            ]}
                                        />
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
