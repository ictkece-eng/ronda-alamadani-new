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
import { Button } from '@/components/ui/button';
import { FileDown, Calendar as CalendarIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

// Extend jsPDF with autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}


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

const InfoTable = ({
  title,
  data,
  isLoading,
}: {
  title: string;
  data: PersonInfo[];
  isLoading: boolean;
}) => (
  <Card>
    <CardHeader className="p-4">
      <CardTitle className="text-base text-center font-bold">{title}</CardTitle>
    </CardHeader>
    <CardContent className="p-0">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary hover:bg-secondary">
            <TableHead className="w-[40px]">No</TableHead>
            <TableHead>Nama</TableHead>
            <TableHead>Blok</TableHead>
            <TableHead>No HP</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Skeleton className="h-4 w-4" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-10" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                </TableRow>
              ))
            : data.map((person, index) => (
                <TableRow key={index}>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>{person.nama}</TableCell>
                  <TableCell>{person.blok}</TableCell>
                  <TableCell>{person.noHp}</TableCell>
                </TableRow>
              ))}
        </TableBody>
      </Table>
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

    const scheduleEntries: ScheduleEntry[] = filteredSchedules.map(schedule => {
        const user = usersMap.get(schedule.userId);
        const scheduleDate = new Date(schedule.date);
        return {
            date: scheduleDate,
            hariTanggal: format(scheduleDate, "EEEE, dd MMMM yyyy", { locale: id }),
            nama: user?.name || 'Unknown User',
            blok: user?.address || '-',
            noHp: user?.phone || '-',
        }
    }).sort((a, b) => a.date.getTime() - b.date.getTime());


    const backups = users
      .filter((user) => user.role === 'backup')
      .map(user => ({ nama: user.name, blok: user.address, noHp: user.phone }));
      
    const coordinators = users
        .filter((user) => user.role === 'coordinator')
        .map((user) => ({
            nama: user.name,
            blok: user.address,
            noHp: user.phone,
        }));

    return { processedScheduleEntries: scheduleEntries, backupPersons: backups, coordinatorPersons: coordinators };
  }, [users, allSchedules, selectedMonth]);


  let lastDate = '';
  
  const periodText = useMemo(() => {
    if (!selectedMonth) return '';
    const [year, month] = selectedMonth.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, "MMMM yyyy", { locale: id });
  }, [selectedMonth]);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.width;

    // 1. Title
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('JADWAL RONDA PERUM. ALAM MADANI', pageW / 2, 15, { align: 'center' });
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('RT 08 / RW 20', pageW / 2, 22, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Periode: ${periodText}`, pageW / 2, 28, { align: 'center' });

    // 2. Right Column Tables (to determine height)
    const rightColX = 115;
    let rightColY = 35;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Back Up / Pengganti Ronda', rightColX, rightColY);
    doc.autoTable({
        head: [['No', 'Nama', 'Blok', 'No HP']],
        body: backupPersons.map((p, i) => [i + 1, p.nama, p.blok, p.noHp]),
        startY: rightColY + 2,
        margin: { left: rightColX },
        theme: 'grid',
        headStyles: { fillColor: '#f3f4f6', textColor: 0, fontStyle: 'bold', lineWidth: 0.1, lineColor: 150 },
        styles: { fontSize: 8, lineWidth: 0.1, lineColor: 150 },
    });
    rightColY = doc.autoTable.previous.finalY || rightColY;

    rightColY += 6;
    doc.text('Coordinator Ronda', rightColX, rightColY);
    doc.autoTable({
        head: [['No', 'Nama', 'Blok', 'No HP']],
        body: coordinatorPersons.map((p, i) => [i + 1, p.nama, p.blok, p.noHp]),
        startY: rightColY + 2,
        margin: { left: rightColX },
        theme: 'grid',
        headStyles: { fillColor: '#f3f4f6', textColor: 0, fontStyle: 'bold', lineWidth: 0.1, lineColor: 150 },
        styles: { fontSize: 8, lineWidth: 0.1, lineColor: 150 },
    });
    rightColY = doc.autoTable.previous.finalY || rightColY;

    rightColY += 6;
    doc.text('Informasi', rightColX, rightColY);
    doc.autoTable({
        body: infoItems.map(item => [item.id + '.', item.text]),
        startY: rightColY + 2,
        margin: { left: rightColX },
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: {top: 1, left: 0, right: 0, bottom: 1}},
        columnStyles: {
            0: { cellWidth: 5, fontStyle: 'bold' },
        },
    });
    
    // 3. Main Schedule Table
    const flatMainTableBody = processedScheduleEntries.map(entry => ([
        entry.hariTanggal,
        entry.nama,
        entry.blok,
        entry.noHp,
        entry.pengganti || '-',
    ]));

    doc.autoTable({
        head: [['Hari, Tanggal', 'Nama', 'Blok', 'No HP', 'Pengganti Ronda']],
        body: flatMainTableBody,
        startY: 35,
        margin: { right: pageW - rightColX + 5 },
        theme: 'grid',
        headStyles: { fillColor: '#3b82f6', textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 8, cellPadding: 1.5, lineWidth: 0.1, lineColor: 150 },
        columnStyles: { 
            0: { cellWidth: 25 },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 10 },
            3: { cellWidth: 20 },
            4: { cellWidth: 'auto' },
        },
        didDrawCell: (data) => {
            if (data.section === 'body') {
                const rawRow = data.row.raw as (string | { content: string })[];
                const dateCell = Array.isArray(rawRow) ? rawRow[0] : (rawRow as { content: string }).content;
                if (typeof dateCell === 'string' && dateCell.startsWith('Jumat')) {
                    doc.setFillColor(254, 249, 195);
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
                }
            }
        },
    });

    doc.save(`jadwal-ronda-${selectedMonth}.pdf`);
  };

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6">
      <header className="text-center mb-6">
        <div className='flex justify-between items-start'>
            <div className="w-48 text-left">
                <Label htmlFor="month-picker">Pilih Bulan</Label>
                <div className='relative'>
                    <CalendarIcon className='absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground' />
                    <Input
                        id="month-picker"
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className='pl-8'
                    />
                </div>
            </div>
            <div className='flex flex-col items-center -mt-2'>
                <h1 className="text-xl md:text-2xl font-bold uppercase">
                Jadwal Ronda Perum. Alam Madani
                </h1>
                <p className="text-md md:text-lg text-muted-foreground">RT 08 / RW 20</p>
                <p className="text-sm text-muted-foreground mt-1 capitalize">
                  Periode: {periodText}
                </p>
            </div>
            <Button onClick={handleExportPDF} variant="outline" size="sm">
                <FileDown className="mr-2" />
                PDF
            </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <main className="lg:col-span-3">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-primary hover:bg-primary">
                  <TableHead className="text-primary-foreground w-[28%]">
                    Hari, Tanggal
                  </TableHead>
                  <TableHead className="text-primary-foreground">Nama</TableHead>
                  <TableHead className="text-primary-foreground">Blok</TableHead>
                  <TableHead className="text-primary-foreground">No HP</TableHead>
                  <TableHead className="text-primary-foreground">
                    Pengganti Ronda
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 15 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Skeleton className="h-4 w-32" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-10" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-28" />
                        </TableCell>
                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      </TableRow>
                    ))
                  : processedScheduleEntries.length > 0 ? (
                    processedScheduleEntries.map((entry, index) => {
                      const showDate = entry.hariTanggal !== lastDate;
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
                              isJumat &&
                                'bg-yellow-100 dark:bg-yellow-900/20 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/30'
                            )}
                          >
                            <TableCell
                              className="font-medium align-top p-2"
                              rowSpan={rowSpan}
                            >
                              {entry.hariTanggal}
                            </TableCell>
                            <TableCell className="p-2">{entry.nama}</TableCell>
                            <TableCell className="p-2">{entry.blok}</TableCell>
                            <TableCell className="p-2">{entry.noHp}</TableCell>
                            <TableCell
                              className={cn(
                                'p-2',
                                entry.pengganti && 'font-semibold'
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
                            isJumat &&
                              'bg-yellow-100 dark:bg-yellow-900/20 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/30'
                          )}
                        >
                          <TableCell className="p-2">{entry.nama}</TableCell>
                          <TableCell className="p-2">{entry.blok}</TableCell>
                          <TableCell className="p-2">{entry.noHp}</TableCell>
                          <TableCell
                            className={cn(
                              'p-2',
                              entry.pengganti && 'font-semibold'
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
                        No schedule data found for this month.
                      </TableCell>
                    </TableRow>
                  )}
              </TableBody>
            </Table>
          </div>
        </main>

        <aside className="lg:col-span-2 space-y-6">
          <InfoTable
            title="Back Up / Pengganti Ronda"
            data={backupPersons}
            isLoading={isLoading}
          />
          <InfoTable
            title="Coordinator Ronda"
            data={coordinatorPersons}
            isLoading={isLoading}
          />

          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-base text-center font-bold">
                Informasi
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 text-sm space-y-3">
              {infoItems.map((item) => (
                <div key={item.id} className="flex items-start gap-2">
                  <span className="font-bold text-foreground -mt-0.5">
                    {item.id}.
                  </span>
                  <span className="text-muted-foreground">{item.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
