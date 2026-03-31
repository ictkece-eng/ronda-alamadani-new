'use client';

import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { Warga, ScheduleEntry, RondaSchedule } from '@/lib/types';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, collectionGroup } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarIcon, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

function countConsecutiveDates(schedule: any[], startIndex: number) {
  let count = 1;
  if (startIndex >= schedule.length) return count;

  const targetDate = schedule[startIndex].hariTanggal;
  for (let i = startIndex + 1; i < schedule.length; i++) {
    if (schedule[i].hariTanggal === targetDate) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

export function ScheduleHistory() {
  const firestore = useFirestore();
  const { isUserLoading: isAuthLoading } = useUser();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });
  const [searchQuery, setSearchQuery] = useState('');

  const usersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersCollection);

  const schedulesQuery = useMemoFirebase(
      () => (firestore ? collectionGroup(firestore, 'rondaSchedules') : null),
      [firestore]
  );
  const { data: allSchedules, isLoading: isSchedulesLoading } = useCollection<RondaSchedule>(schedulesQuery);
  
  const isLoading = isSchedulesLoading || isUsersLoading || isAuthLoading;

  const processedScheduleEntries = useMemo(() => {
    if (!users || !allSchedules) {
        return [];
    }
    
    const [year, month] = selectedMonth.split('-').map(Number);
    
    const filteredSchedules = allSchedules.filter(schedule => {
        const scheduleDate = new Date(schedule.date);
        return scheduleDate.getUTCFullYear() === year && scheduleDate.getUTCMonth() + 1 === month;
    });

    const usersMap = new Map(users.map((user) => [user.id, user]));

    let scheduleEntries: ScheduleEntry[] = filteredSchedules.map(schedule => {
        const user = usersMap.get(schedule.userId);
        const scheduleDate = new Date(schedule.date);
        return {
            date: scheduleDate,
            hariTanggal: format(scheduleDate, "EEEE, dd MMMM yyyy", { locale: id }),
            nama: user?.name || 'Unknown User',
            blok: user?.address || '-',
            noHp: user?.phone || '-',
            pengganti: schedule.replacementUserName || undefined,
        }
    }).sort((a, b) => a.date.getTime() - b.date.getTime());

    if (searchQuery) {
        const lowercasedQuery = searchQuery.toLowerCase();
        scheduleEntries = scheduleEntries.filter(entry => 
            entry.nama.toLowerCase().includes(lowercasedQuery) ||
            (entry.pengganti && entry.pengganti.toLowerCase().includes(lowercasedQuery))
        );
    }

    return scheduleEntries;
  }, [users, allSchedules, selectedMonth, searchQuery]);


  let lastDate = '';
  let dateGroupIndex = 0;
  
  const periodText = useMemo(() => {
    if (!selectedMonth) return '';
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, "MMMM yyyy", { locale: id });
  }, [selectedMonth]);


  return (
    <Card className="border-0 shadow-sm app-surface overflow-hidden">
        <CardHeader>
            <CardTitle>Schedule History</CardTitle>
            <CardDescription>View previously generated schedules for any month.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="rounded-4 border bg-white p-4 shadow-sm">
              <div className="d-flex align-items-start gap-3 mb-3">
                <div className="rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-10 p-3 text-primary">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <div className="small text-uppercase fw-semibold text-primary mb-1">History Viewer</div>
                  <div className="fw-semibold">Telusuri jadwal ronda per bulan</div>
                  <div className="small text-muted">Cari nama warga atau pengganti dari jadwal yang pernah dibuat sebelumnya.</div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-2 self-start sm:self-center w-full sm:w-auto">
                 <div className="relative w-full sm:w-48">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="search-name"
                        placeholder="Cari nama..."
                        className="pl-8 rounded-pill"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="relative w-full sm:w-48">
                    <Label htmlFor="month-picker" className="sr-only">Pilih Bulan</Label>
                    <CalendarIcon className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                    <Input
                        id="month-picker"
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className='pl-8 rounded-pill'
                    />
                </div>
              </div>
            </div>

            <div className="border rounded-4 overflow-hidden bg-white shadow-sm">
                <Table>
                  <TableHeader className="bg-body-tertiary">
                    <TableRow>
                      <TableHead>Hari, Tanggal</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Blok</TableHead>
                      <TableHead>No HP</TableHead>
                      <TableHead>Pengganti Ronda</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? Array.from({ length: 10 }).map((_, index) => (
                          <TableRow key={index}>
                            <TableCell colSpan={5}>
                              <Skeleton className="h-5 w-full" />
                            </TableCell>
                          </TableRow>
                        ))
                      : processedScheduleEntries.length > 0 ? (
                        processedScheduleEntries.map((entry, index) => {
                          const showDate = entry.hariTanggal !== lastDate;
                          if (showDate) {
                            dateGroupIndex++;
                          }
                          const isEvenGroup = dateGroupIndex % 2 === 0;
                          const isJumat = entry.hariTanggal.startsWith('Jumat');

                          if (showDate) {
                            lastDate = entry.hariTanggal;
                            const rowSpan = countConsecutiveDates(
                              processedScheduleEntries,
                              index
                            );
                            return (
                              <TableRow
                                key={index}
                                className={cn(
                                  "transition-colors hover:bg-muted/10",
                                  isJumat 
                                    ? "bg-yellow-100/50 dark:bg-yellow-900/20" 
                                    : !isEvenGroup 
                                    ? "bg-secondary" 
                                    : ""
                                )}
                              >
                                <TableCell
                                  className="font-medium align-top p-3"
                                  rowSpan={rowSpan}
                                >
                                  {entry.hariTanggal}
                                </TableCell>
                                <TableCell className="p-3">{entry.nama}</TableCell>
                                <TableCell className="p-3">{entry.blok}</TableCell>
                                <TableCell className="p-3">{entry.noHp}</TableCell>
                                <TableCell
                                  className={cn(
                                    'p-3',
                                    entry.pengganti && 'font-semibold text-accent-foreground'
                                  )}
                                >
                                  {entry.pengganti || '-'}
                                </TableCell>
                              </TableRow>
                            );
                          }
                          return (
                            <TableRow
                              key={index}
                              className={cn(
                                "transition-colors hover:bg-muted/10",
                                isJumat 
                                  ? "bg-yellow-100/50 dark:bg-yellow-900/20" 
                                  : !isEvenGroup 
                                  ? "bg-secondary" 
                                  : ""
                              )}
                            >
                              <TableCell className="p-3">{entry.nama}</TableCell>
                              <TableCell className="p-3">{entry.blok}</TableCell>
                              <TableCell className="p-3">{entry.noHp}</TableCell>
                              <TableCell
                                className={cn(
                                  'p-3',
                                  entry.pengganti && 'font-semibold text-accent-foreground'
                                )}
                              >
                                  {entry.pengganti || '-'}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center h-24">
                            {searchQuery ? "Nama tidak ditemukan pada jadwal bulan ini." : "Jadwal untuk bulan ini belum dibuat."}
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
