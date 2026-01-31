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
import { FileDown, Calendar as CalendarIcon, Image as ImageIcon, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';
import html2canvas from 'html2canvas';

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

const InfoCard = ({
  title,
  data,
  isLoading,
}: {
  title: string;
  data: PersonInfo[];
  isLoading: boolean;
}) => (
  <Card>
    <CardHeader>
      <CardTitle className="text-lg">{title}</CardTitle>
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
            <li key={index} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/50">
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
  const [isExportingPNG, setIsExportingPNG] = useState(false);

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
            pengganti: schedule.replacementUserName || undefined,
        }
    }).sort((a, b) => a.date.getTime() - b.date.getTime());


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
    const margin = 10;

    // --- Document Header ---
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(40, 52, 72);
    doc.text('JADWAL RONDA PERUM. ALAM MADANI', pageW / 2, 12, { align: 'center' });
    
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('RT 08 / RW 20', pageW / 2, 18, { align: 'center' });

    doc.setFontSize(9);
    doc.text(`Periode: ${periodText}`, pageW / 2, 23, { align: 'center' });


    // --- Right Column (Side Info) ---
    const rightColX = 120;
    let rightColY = 30;

    // Backup Table
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 52, 72);
    doc.text('Back Up / Pengganti Ronda', rightColX, rightColY - 3);
    doc.autoTable({
        head: [['No', 'Nama', 'Blok', 'No HP']],
        body: backupPersons.map((p, i) => [i + 1, p.nama, p.blok, p.noHp]),
        startY: rightColY,
        margin: { left: rightColX, right: margin },
        theme: 'grid',
        headStyles: {
            fillColor: [26, 188, 156],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 7,
            cellPadding: 1,
        },
        styles: { 
            fontSize: 6.5,
            lineWidth: 0.1, 
            lineColor: [221, 221, 221],
            cellPadding: 1,
        },
        columnStyles: { 0: { halign: 'center', cellWidth: 8 } }
    });
    rightColY = (doc as any).autoTable.previous.finalY + 5;

    // Coordinator Table
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 52, 72);
    doc.text('Koordinator Ronda', rightColX, rightColY - 3);
    doc.autoTable({
        head: [['No', 'Nama', 'Blok', 'No HP']],
        body: coordinatorPersons.map((p, i) => [i + 1, p.nama, p.blok, p.noHp]),
        startY: rightColY,
        margin: { left: rightColX, right: margin },
        theme: 'grid',
        headStyles: {
            fillColor: [52, 152, 219],
            textColor: 255,
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 7,
            cellPadding: 1,
        },
        styles: { 
            fontSize: 6.5,
            lineWidth: 0.1, 
            lineColor: [221, 221, 221],
            cellPadding: 1,
        },
        columnStyles: { 0: { halign: 'center', cellWidth: 8 } }
    });
    rightColY = (doc as any).autoTable.previous.finalY + 5;

    // Info section
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 52, 72);
    doc.text('Informasi Penting', rightColX, rightColY - 3);
    doc.autoTable({
        body: infoItems.map(item => [item.id + '.', item.text]),
        startY: rightColY,
        margin: { left: rightColX, right: margin },
        theme: 'plain',
        styles: { 
            fontSize: 6,
            cellPadding: {top: 0.5, left: 0, right: 0, bottom: 0.5} 
        },
        columnStyles: {
            0: { cellWidth: 4, fontStyle: 'bold' },
        },
    });

    // --- Main Schedule Table ---
    const mainTableBody: (string | number)[][] = [];
    const groupedByDate = processedScheduleEntries.reduce((acc, entry) => {
        (acc[entry.hariTanggal] = acc[entry.hariTanggal] || []).push(entry);
        return acc;
    }, {} as Record<string, ScheduleEntry[]>);

    let rowSpans: { [key: number]: number } = {};
    let rowIndex = 0;
    Object.keys(groupedByDate).forEach(date => {
        const entriesForDate = groupedByDate[date];
        rowSpans[rowIndex] = entriesForDate.length;
        entriesForDate.forEach((entry, index) => {
            mainTableBody.push([
                date,
                entry.nama,
                entry.blok,
                entry.noHp,
                entry.pengganti || '-',
            ]);
            rowIndex++;
        });
    });
    
    doc.autoTable({
        head: [['Hari, Tanggal', 'Nama', 'Blok', 'No HP', 'Pengganti Ronda']],
        body: mainTableBody,
        startY: 30,
        margin: { right: pageW - rightColX + 5, left: margin },
        theme: 'grid',
        headStyles: { 
            fillColor: [41, 128, 185],
            textColor: 255, 
            fontStyle: 'bold',
            halign: 'center',
            fontSize: 7,
            cellPadding: 1,
        },
        styles: { 
            fontSize: 6.5,
            cellPadding: 1,
            lineWidth: 0.1, 
            lineColor: [221, 221, 221]
        },
        columnStyles: { 
            0: { cellWidth: 25, fontStyle: 'bold' },
            1: { cellWidth: 'auto' },
            2: { cellWidth: 8, halign: 'center' },
            3: { cellWidth: 20 },
            4: { cellWidth: 'auto' },
        },
        alternateRowStyles: {
            fillColor: [248, 249, 250]
        },
        didDrawCell: (data) => {
            if (data.column.index === 0 && rowSpans[data.row.index]) {
                const span = rowSpans[data.row.index];
                if (span > 1) {
                    doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height * span, 'S');
                    const textY = data.cell.y + (data.cell.height * span) / 2;
                    doc.text(data.cell.text, data.cell.x + data.cell.padding('left'), textY, { valign: 'middle' });
                }
            }

            const originalDateText = mainTableBody[data.row.index]?.[0] as string;
            if (data.section === 'body' && originalDateText && originalDateText.startsWith('Jumat')) {
                doc.setFillColor(254, 249, 195);
                doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            }
        },
         willDrawCell: (data) => {
            if (data.column.index === 0 && data.row.index > 0 && mainTableBody[data.row.index][0] === mainTableBody[data.row.index - 1][0]) {
               return false;
            }
        }
    });

    doc.save(`jadwal-ronda-${selectedMonth}.pdf`);
  };

  const handleExportPNG = async () => {
    setIsExportingPNG(true);
    const element = document.getElementById('capture-area');
    if (element) {
        const canvas = await html2canvas(element, { 
            backgroundColor: 'hsl(220 20% 97%)',
            useCORS: true, 
            scale: 2
        });
        const data = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.href = data;
        link.download = `jadwal-ronda-${selectedMonth}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    setIsExportingPNG(false);
  };


  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
                <h1 className="text-2xl md:text-3xl font-bold">Dashboard Jadwal Ronda</h1>
                <p className="text-muted-foreground">Lihat, kelola, dan ekspor jadwal ronda bulanan.</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-center">
                <div className="w-48">
                    <Label htmlFor="month-picker" className="sr-only">Pilih Bulan</Label>
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
                 <Button onClick={handleExportPDF} variant="outline" size="sm" disabled={isLoading || processedScheduleEntries.length === 0}>
                    <FileDown />
                    <span>PDF</span>
                </Button>
                <Button onClick={handleExportPNG} variant="outline" size="sm" disabled={isLoading || processedScheduleEntries.length === 0 || isExportingPNG}>
                    {isExportingPNG ? <Loader2 className="animate-spin" /> : <ImageIcon />}
                    <span>PNG</span>
                </Button>
            </div>
        </header>

      <div id="capture-area" className="bg-card p-4 sm:p-6 rounded-lg border">
          <div className="text-center mb-6">
              <h2 className="text-xl md:text-2xl font-bold uppercase text-primary">
              Jadwal Ronda Perum. Alam Madani
              </h2>
              <p className="text-md md:text-lg text-muted-foreground">RT 08 / RW 20</p>
              <p className="text-sm text-muted-foreground mt-1 capitalize font-medium">
                Periode: {periodText}
              </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            <main className="lg:col-span-3">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
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
                                  "transition-colors",
                                  isJumat ? 'bg-yellow-100/50 dark:bg-yellow-900/20 hover:bg-yellow-100/70' : 'hover:bg-muted/50'
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
                                "transition-colors",
                                isJumat ? 'bg-yellow-100/50 dark:bg-yellow-900/20 hover:bg-yellow-100/70' : 'hover:bg-muted/50'
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
                            Jadwal untuk bulan ini belum dibuat.
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

              <Card>
                <CardHeader>
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
