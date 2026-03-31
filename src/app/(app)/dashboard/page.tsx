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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  infoItems,
} from '@/lib/data';
import { cn } from '@/lib/utils';
import type { PersonInfo, Warga, ScheduleEntry, RondaSchedule } from '@/lib/types';
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

const InfoCard = ({
  title,
  data,
  isLoading,
}: {
  title: string;
  data: PersonInfo[];
  isLoading: boolean;
}) => (
  <Card className="border-0 shadow-sm app-surface dashboard-side-card">
    <CardHeader className="pb-3 border-bottom border-opacity-10">
      <CardTitle className="text-lg d-flex align-items-center justify-content-between gap-3">
        <span>{title}</span>
        <span className="badge rounded-pill text-bg-light border text-primary-emphasis px-3 py-2">
          {data.length}
        </span>
      </CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((person, index) => (
            <li key={index} className="dashboard-contact-item flex items-center justify-between gap-4 p-3 rounded-4 bg-secondary/50 border border-light-subtle">
                <div className="flex flex-col">
                    <span className="font-semibold">{person.nama}</span>
                    <span className="text-xs text-muted-foreground">{person.blok}</span>
                </div>
                <span className="text-sm text-muted-foreground">{person.noHp}</span>
            </li>
          ))}
        </ul>
      )}
    </CardContent>
  </Card>
);

export default function DashboardPage() {
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

  const { processedScheduleEntries, backupPersons, coordinatorPersons } = useMemo(() => {
    if (!users || !allSchedules) {
        return {
            processedScheduleEntries: [],
            backupPersons: [],
            coordinatorPersons: []
        };
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


    const backups = users
      .filter((user) => user.role === 'backup')
      .map(user => ({ nama: user.name, blok: user.address, noHp: user.phone }))
      .sort((a, b) => a.nama.localeCompare(b.nama));
      
    const coordinators = users
        .filter((user) => user.role === 'coordinator')
        .map((user) => ({
            nama: user.name,
            blok: user.address,
            noHp: user.phone,
        }))
        .sort((a, b) => a.nama.localeCompare(b.nama));

    return { processedScheduleEntries: scheduleEntries, backupPersons: backups, coordinatorPersons: coordinators };
  }, [users, allSchedules, selectedMonth, searchQuery]);


  let lastDate = '';
  let dateGroupIndex = 0;

  const uniqueScheduleDays = useMemo(() => new Set(processedScheduleEntries.map((entry) => entry.hariTanggal)).size, [processedScheduleEntries]);
  
  const periodText = useMemo(() => {
    if (!selectedMonth) return '';
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, "MMMM yyyy", { locale: id });
  }, [selectedMonth]);


  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6">
      <header className="dashboard-hero rounded-4 border-0 shadow-sm app-surface p-4 p-lg-5 mb-4 mb-lg-5 overflow-hidden position-relative">
        <div className="row g-4 align-items-center position-relative">
          <div className="col-12 col-xl-7">
            <div className="dashboard-hero-copy">
              <div className="d-inline-flex align-items-center gap-2 rounded-pill bg-white border border-primary border-opacity-10 px-3 py-2 shadow-sm mb-3">
                <span className="badge text-bg-primary rounded-pill px-3 py-2">Dashboard Utama</span>
                <span className="small fw-semibold text-primary-emphasis">Pantauan jadwal ronda bulanan</span>
              </div>

              <h1 className="text-2xl md:text-4xl font-bold text-primary mb-2">Dashboard Jadwal Ronda</h1>
              <p className="text-muted-foreground mb-4 dashboard-hero-description">
                Lihat, kelola, dan pantau jadwal ronda bulanan dengan tampilan Bootstrap yang lebih rapi, informatif, dan enak dipindai.
              </p>

              <div className="dashboard-hero-metrics">
                <div className="dashboard-hero-metric">
                  <div className="dashboard-hero-metric-label">Periode Aktif</div>
                  <div className="dashboard-hero-metric-value text-primary">{periodText}</div>
                </div>
                <div className="dashboard-hero-metric">
                  <div className="dashboard-hero-metric-label">Hari Terjadwal</div>
                  <div className="dashboard-hero-metric-value">{uniqueScheduleDays}</div>
                </div>
                <div className="dashboard-hero-metric">
                  <div className="dashboard-hero-metric-label">Total Baris</div>
                  <div className="dashboard-hero-metric-value">{processedScheduleEntries.length}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-12 col-xl-5">
            <div className="dashboard-filter-panel">
              <div className="dashboard-filter-panel-header">
                <div className="small text-uppercase fw-semibold text-primary mb-1">Filter Jadwal</div>
                <div className="small text-muted">Gunakan filter di bawah untuk mencari nama warga dan memilih periode jadwal.</div>
              </div>

              <div className="dashboard-filter-bar w-full">
                <div className="dashboard-filter-group">
                  <Label htmlFor="search-name" className="dashboard-filter-label">Cari Nama</Label>
                  <div className="dashboard-filter-control position-relative">
                    <Search className="dashboard-filter-icon" />
                    <Input
                      id="search-name"
                      placeholder="Cari nama warga..."
                      className="dashboard-filter-input"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <div className="dashboard-filter-group">
                  <Label htmlFor="month-picker" className="dashboard-filter-label">Pilih Bulan</Label>
                  <div className="dashboard-filter-control position-relative">
                    <CalendarIcon className="dashboard-filter-icon" />
                    <Input
                      id="month-picker"
                      type="month"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="dashboard-filter-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="dashboard-sheet bg-card p-4 sm:p-6 rounded-4 border shadow-sm app-surface">
          <div className="text-center mb-4 mb-lg-5">
              <div className="d-inline-flex align-items-center gap-2 rounded-pill bg-white border border-primary border-opacity-10 px-3 py-2 shadow-sm mb-3">
                <span className="badge text-bg-primary rounded-pill px-3 py-2">Live Schedule</span>
                <span className="small fw-semibold text-primary-emphasis">Monitoring jadwal warga</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold uppercase text-primary">
                Jadwal Ronda Perum. Alam Madani
              </h2>
              <p className="text-md md:text-lg text-muted-foreground">RT 08 / RW 20</p>
              <p className="text-sm text-muted-foreground mt-1 capitalize font-medium">
                Periode: {periodText}
              </p>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-4">
              <div className="dashboard-stat card border-0 shadow-sm h-100">
                <div className="card-body py-3 px-4">
                  <div className="small text-uppercase text-muted fw-semibold mb-1">Hari Terjadwal</div>
                  <div className="d-flex align-items-end justify-content-between gap-3">
                    <div className="display-6 fw-bold text-primary mb-0">{uniqueScheduleDays}</div>
                    <span className="badge rounded-pill text-bg-primary-subtle text-primary-emphasis px-3 py-2">Aktif</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="dashboard-stat card border-0 shadow-sm h-100">
                <div className="card-body py-3 px-4">
                  <div className="small text-uppercase text-muted fw-semibold mb-1">Total Baris Jadwal</div>
                  <div className="d-flex align-items-end justify-content-between gap-3">
                    <div className="display-6 fw-bold text-primary mb-0">{processedScheduleEntries.length}</div>
                    <span className="badge rounded-pill text-bg-info-subtle text-info-emphasis px-3 py-2">Realtime</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="col-md-4">
              <div className="dashboard-stat card border-0 shadow-sm h-100">
                <div className="card-body py-3 px-4">
                  <div className="small text-uppercase text-muted fw-semibold mb-1">Support Person</div>
                  <div className="d-flex align-items-end justify-content-between gap-3">
                    <div className="display-6 fw-bold text-primary mb-0">{backupPersons.length + coordinatorPersons.length}</div>
                    <span className="badge rounded-pill text-bg-success-subtle text-success-emphasis px-3 py-2">Backup + kord</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <main className="lg:col-span-3">
              <div className="dashboard-main-card border rounded-4 overflow-hidden bg-white shadow-sm">
                <div className="px-4 px-lg-5 pt-4 pt-lg-5 pb-3 border-bottom bg-white">
                  <div className="d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div>
                      <div className="small text-uppercase fw-semibold text-primary mb-1">Tabel Utama</div>
                      <div className="fw-bold text-dark">Daftar ronda harian warga</div>
                    </div>
                    <div className="d-flex flex-wrap gap-2">
                      <span className="badge rounded-pill text-bg-light border px-3 py-2">Bootstrap Table</span>
                      <span className="badge rounded-pill text-bg-warning-subtle text-warning-emphasis px-3 py-2">Highlight Jumat</span>
                    </div>
                  </div>
                </div>
                <Table className="dashboard-main-table table-striped table-bordered align-middle">
                  <TableHeader className="bg-body-tertiary">
                    <TableRow className="bg-primary/10 hover:bg-primary/20 border-b-primary/20">
                      <TableHead className="w-[28%] text-primary font-bold">
                        Hari, Tanggal
                      </TableHead>
                      <TableHead className="text-primary font-bold">Nama</TableHead>
                      <TableHead className="text-primary font-bold">Blok</TableHead>
                      <TableHead className="text-primary font-bold">No HP</TableHead>
                      <TableHead className="text-primary font-bold">
                        Pengganti Ronda
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading
                      ? Array.from({ length: 15 }).map((_, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <Skeleton className="h-5 w-32" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-24" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-10" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-28" />
                            </TableCell>
                            <TableCell>
                              <Skeleton className="h-5 w-20" />
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
                                  "transition-colors hover:bg-primary/10 dashboard-row",
                                  isJumat 
                                    ? "bg-yellow-100/50 dark:bg-yellow-900/20 dashboard-friday" 
                                    : !isEvenGroup 
                                    ? "bg-secondary dashboard-alt-row" 
                                    : ""
                                )}
                              >
                                <TableCell
                                  className="font-medium align-top p-3 dashboard-date-cell"
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
                                "transition-colors hover:bg-primary/10 dashboard-row",
                                isJumat 
                                  ? "bg-yellow-100/50 dark:bg-yellow-900/20 dashboard-friday" 
                                  : !isEvenGroup 
                                  ? "bg-secondary dashboard-alt-row" 
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
            </main>

            <aside className="lg:col-span-2 space-y-6">
              <InfoCard
                title="Back Up / Pengganti Ronda"
                data={backupPersons}
                isLoading={isLoading}
              />
              <InfoCard
                title="Koordinator Ronda"
                data={coordinatorPersons}
                isLoading={isLoading}
              />

              <Card className="border-0 shadow-sm app-surface dashboard-side-card">
                <CardHeader className="pb-3 border-bottom border-opacity-10">
                  <CardTitle className="text-lg">
                    Informasi
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-4">
                  {infoItems.map((item) => (
                    <div key={item.id} className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-xs mt-0.5">
                        {item.id}
                      </div>
                      <span className="text-muted-foreground">{item.text}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </aside>
          </div>
      </div>
    </div>
  );
}
