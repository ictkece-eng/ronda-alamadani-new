
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
  scheduleEntries,
  backupPersons,
  coordinatorPersons,
  infoItems,
} from '@/lib/data';
import { cn } from '@/lib/utils';
import type { PersonInfo } from '@/lib/types';

function countConsecutiveDates(startIndex: number) {
  let count = 1;
  if (startIndex >= scheduleEntries.length) return count;
  
  const targetDate = scheduleEntries[startIndex].hariTanggal;
  for (let i = startIndex + 1; i < scheduleEntries.length; i++) {
    if (scheduleEntries[i].hariTanggal === targetDate) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

const InfoTable = ({ title, data }: { title: string; data: PersonInfo[] }) => (
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
          {data.map((person, index) => (
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
  let lastDate = '';

  return (
    <div className="container mx-auto p-2 sm:p-4 md:p-6">
      <header className="text-center mb-6">
        <h1 className="text-xl md:text-2xl font-bold uppercase">
          Jadwal Ronda Perum. Alam Madani
        </h1>
        <p className="text-md md:text-lg text-muted-foreground">RT 08 / RW 20</p>
        <p className="text-sm text-muted-foreground mt-1">
          Periode: Desember 2025
        </p>
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
                {scheduleEntries.map((entry, index) => {
                  const showDate = entry.hariTanggal !== lastDate;
                  const isJumat = entry.hariTanggal.startsWith('Jumat');

                  if (showDate) {
                    lastDate = entry.hariTanggal;
                    const rowSpan = countConsecutiveDates(index);
                    return (
                      <TableRow key={index} className={cn(isJumat && 'bg-yellow-100 dark:bg-yellow-900/20 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/30')}>
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
                    <TableRow key={index} className={cn(isJumat && 'bg-yellow-100 dark:bg-yellow-900/20 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/30')}>
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
                })}
              </TableBody>
            </Table>
          </div>
        </main>

        <aside className="lg:col-span-2 space-y-6">
          <InfoTable title="Back Up / Pengganti Ronda" data={backupPersons} />
          <InfoTable title="Coordinator Ronda" data={coordinatorPersons} />

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
