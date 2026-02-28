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
import { format, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Combobox } from '@/components/ui/combobox';

// Combined type for easier handling
type ScheduleWithUser = RondaSchedule & {
    userName: string;
    userAddress: string;
};

interface ReplacementManagementProps {
    readOnly?: boolean;
}

export function ReplacementManagement({ readOnly = false }: ReplacementManagementProps) {
    const firestore = useFirestore();
    const { toast } = useToast();

    const [selectedMonth, setSelectedMonth] = useState(() => {
        const today = new Date();
        return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    });

    // Fetch all schedules
    const schedulesQuery = useMemoFirebase(
        () => (firestore ? collectionGroup(firestore, 'rondaSchedules') : null),
        [firestore]
    );
    const { data: allSchedules, isLoading: isSchedulesLoading } = useCollection<RondaSchedule>(schedulesQuery);

    // Fetch all users
    const usersQuery = useMemoFirebase(
        () => (firestore ? collection(firestore, 'users') : null),
        [firestore]
    );
    const { data: allUsers, isLoading: isUsersLoading } = useCollection<Warga>(usersQuery);

    const isLoading = isSchedulesLoading || isUsersLoading;

    // Memoize processed data
    const usersMap = useMemo(() => {
        if (!allUsers) return new Map<string, Warga>();
        return new Map(allUsers.map((user) => [user.id, user]));
    }, [allUsers]);

    const dailyScheduledIds = useMemo(() => {
        const map = new Map<string, Set<string>>();
        if (!allSchedules) return map;

        for (const schedule of allSchedules) {
            const dateStr = new Date(schedule.date).toISOString().split('T')[0];
            if (!map.has(dateStr)) {
                map.set(dateStr, new Set());
            }
            const dailySet = map.get(dateStr)!;
            dailySet.add(schedule.userId);
            if (schedule.replacementUserId) {
                dailySet.add(schedule.replacementUserId);
            }
        }
        return map;
    }, [allSchedules]);

    const schedulesForMonth = useMemo(() => {
        if (!allSchedules || !usersMap.size) return [];
        
        const [year, month] = selectedMonth.split('-').map(Number);
        
        return allSchedules
            .filter(schedule => {
                const scheduleDate = new Date(schedule.date);
                return scheduleDate.getUTCFullYear() === year && scheduleDate.getUTCMonth() + 1 === month;
            })
            .map(schedule => {
                const user = usersMap.get(schedule.userId);
                return {
                    ...schedule,
                    userName: user?.name || 'Unknown User',
                    userAddress: user?.address || 'N/A',
                };
            })
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [allSchedules, usersMap, selectedMonth]);

    const handleReplacementChange = (schedule: ScheduleWithUser, newReplacementId: string) => {
        if (!firestore || readOnly) return;

        const isClearing = newReplacementId === 'clear' || !newReplacementId;
        const replacementUser = isClearing ? null : usersMap.get(newReplacementId);

        // --- CONSECUTIVE DAY CHECK ---
        if (replacementUser) {
            const currentScheduleDate = new Date(schedule.date);
            const previousDate = subDays(currentScheduleDate, 1);
            const previousDateStr = previousDate.toISOString().split('T')[0];

            const previousDayIds = dailyScheduledIds.get(previousDateStr);
            if (previousDayIds && previousDayIds.has(replacementUser.id)) {
                 toast({
                    title: 'Peringatan Jadwal Berurutan',
                    description: `${replacementUser.name} sudah bertugas pada hari sebelumnya. Sebaiknya istirahat dulu.`,
                    duration: 5000,
                });
            }
        }
        // --- END CHECK ---

        const scheduleRef = doc(firestore, 'users', schedule.userId, 'rondaSchedules', schedule.id);
        
        const updateData = {
            replacementUserId: replacementUser ? replacementUser.id : null,
            replacementUserName: replacementUser ? replacementUser.name : null,
        };

        updateDocumentNonBlocking(scheduleRef, updateData);

        toast({
            title: 'Replacement Updated',
            description: isClearing
                ? `Replacement for ${schedule.userName}'s shift on ${format(new Date(schedule.date), 'PPP')} has been cleared.`
                : `${schedule.userName}'s shift on ${format(new Date(schedule.date), 'PPP')} will be covered by ${replacementUser!.name}.`,
        });
    };

    return (
        <Card className="shadow-lg border-none">
            <CardHeader>
                <CardTitle>Manage Replacements</CardTitle>
                <CardDescription>Assign replacement users for scheduled ronda duties.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="w-full max-w-xs">
                    <Label htmlFor="month-picker">Filter by Month</Label>
                    <Input
                        id="month-picker"
                        type="month"
                        className="rounded-xl bg-muted/50 border-none h-10 mt-1"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        disabled={isLoading}
                    />
                </div>

                <div className="border rounded-lg overflow-hidden bg-background">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Original Warga</TableHead>
                                <TableHead>Replacement</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={3}><Skeleton className="h-8 w-full" /></TableCell>
                                    </TableRow>
                                ))
                            ) : schedulesForMonth.length > 0 ? (
                                schedulesForMonth.map((schedule) => (
                                    <TableRow key={schedule.id}>
                                        <TableCell className="font-medium">
                                            {format(new Date(schedule.date), 'EEEE, dd MMM yyyy', { locale: idLocale })}
                                        </TableCell>
                                        <TableCell>
                                            <div className="font-medium">{schedule.userName}</div>
                                            <div className="text-sm text-muted-foreground">{schedule.userAddress}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Combobox
                                                value={schedule.replacementUserId || ''}
                                                onValueChange={(newId) => handleReplacementChange(schedule, newId)}
                                                options={[
                                                    { value: 'clear', label: '-- No Replacement --'},
                                                    ...(allUsers
                                                            ?.filter(u => u.role === 'backup' && u.id !== schedule.userId)
                                                            .sort((a,b) => a.name.localeCompare(b.name))
                                                            .map(user => ({
                                                                value: user.id,
                                                                label: user.name,
                                                            })) || [])
                                                ]}
                                                placeholder="Pilih pengganti..."
                                                searchPlaceholder="Cari pengganti..."
                                                emptyPlaceholder="Warga tidak ditemukan."
                                                className="w-[200px]"
                                            />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center h-24">
                                        No schedule found for the selected month.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
