
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { rondaDays, backupRondaPeople, coordinatorRondaPeople, infoItems } from '@/lib/data';
import type { Assignment } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const renderAssignmentRows = (assignments: Assignment[], day: string, date: string, scheduleIndex: number) => {
    return assignments.map((assignment, assignmentIndex) => (
      <TableRow
        key={`${scheduleIndex}-${assignmentIndex}`}
        className={cn(day === 'Jumat' && 'bg-yellow-200 hover:bg-yellow-200/80', 'bg-white even:bg-slate-50')}
      >
        {assignmentIndex === 0 && (
          <TableCell rowSpan={assignments.length} className="font-medium border align-top p-2">
            {day},<br />
            {date}
          </TableCell>
        )}
        <TableCell className="border p-2">{assignment.name}</TableCell>
        <TableCell className="border p-2">{assignment.block}</TableCell>
        <TableCell className="border p-2">{assignment.phone}</TableCell>
        <TableCell className="border p-2">{assignment.substitute || '-'}</TableCell>
      </TableRow>
    ));
  };

  return (
    <div className="container mx-auto p-4 bg-gray-100 min-h-screen">
      <header className="text-center mb-4">
        <h1 className="text-xl font-bold uppercase">Jadwal Ronda Perum. Alam Madani</h1>
        <h2 className="text-lg font-bold">RT 08 / RW 20</h2>
        <p className="text-sm">Periode: Desember 2025</p>
      </header>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Table className="border">
            <TableHeader>
              <TableRow className="bg-yellow-300 hover:bg-yellow-300">
                <TableHead className="w-[150px] border p-2 font-bold text-black">Hari, Tanggal</TableHead>
                <TableHead className="border p-2 font-bold text-black">Nama</TableHead>
                <TableHead className="border p-2 font-bold text-black">Blok</TableHead>
                <TableHead className="border p-2 font-bold text-black">No HP</TableHead>
                <TableHead className="border p-2 font-bold text-black">Pengganti Ronda</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rondaDays.flatMap((schedule, index) => renderAssignmentRows(schedule.assignments, schedule.day, schedule.date, index))}
            </TableBody>
          </Table>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader className="bg-blue-200 p-2 text-center">
              <CardTitle className="text-sm font-bold text-black">Back Up / Pengganti Ronda</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] p-2">No</TableHead>
                    <TableHead className="p-2">Nama</TableHead>
                    <TableHead className="p-2">Blok</TableHead>
                    <TableHead className="p-2">No HP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {backupRondaPeople.map((person, index) => (
                    <TableRow key={index}>
                      <TableCell className="p-2">{index + 1}</TableCell>
                      <TableCell className="p-2">{person.name}</TableCell>
                      <TableCell className="p-2">{person.block}</TableCell>
                      <TableCell className="p-2">{person.phone}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-blue-200 p-2 text-center">
              <CardTitle className="text-sm font-bold text-black">Coordinator Ronda</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px] p-2">No</TableHead>
                    <TableHead className="p-2">Nama</TableHead>
                    <TableHead className="p-2">Blok</TableHead>
                    <TableHead className="p-2">No HP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coordinatorRondaPeople.map((person, index) => (
                    <TableRow key={index}>
                      <TableCell className="p-2">{index + 1}</TableCell>
                      <TableCell className="p-2">{person.name}</TableCell>
                      <TableCell className="p-2">{person.block}</TableCell>
                      <TableCell className="p-2">{person.phone}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="bg-blue-200 p-2 text-center">
              <CardTitle className="text-sm font-bold text-black">Informasi</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <ul className="space-y-1 text-sm">
                {infoItems.map((item) => (
                  <li key={item.id} className="flex items-start">
                    <span className="flex items-center justify-center border border-black rounded-full w-4 h-4 text-xs mr-2 shrink-0 mt-0.5">{item.id}</span>
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
