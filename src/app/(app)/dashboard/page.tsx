'use client';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  rondaDays,
  backupRondaPeople,
  coordinatorRondaPeople,
  infoItems,
} from '@/lib/data';
import type { RondaDay } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Phone, User, Shield, Info, MoreVertical } from 'lucide-react';
import { SidebarTrigger } from '@/components/ui/sidebar';

const ScheduleCard = ({ schedule }: { schedule: RondaDay }) => {
  const dayInitial = schedule.date.split(' ')[0];

  return (
    <Card className="mb-4 shadow-md">
      <CardHeader className="flex flex-row items-start justify-between p-4">
        <div>
          <CardTitle className="text-base font-bold">{schedule.day}</CardTitle>
          <CardDescription className="text-xs">{schedule.date}</CardDescription>
        </div>
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white',
            schedule.day === 'Jumat' ? 'bg-yellow-500' : 'bg-primary'
          )}
        >
          {dayInitial}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="space-y-3">
            {schedule.assignments.map((assignment, index) => (
            <div key={index} className="flex items-center space-x-3 text-sm">
                <User className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1">
                <p className="font-semibold">{assignment.name}</p>
                <p className="text-muted-foreground">
                    {assignment.block}
                </p>
                 {assignment.substitute && (
                    <p className="text-xs text-amber-600">
                    Pengganti: {assignment.substitute}
                    </p>
                )}
                </div>
                 <a href={`tel:${assignment.phone}`} className="flex items-center gap-2 rounded-full border px-3 py-1 text-xs hover:bg-secondary">
                    <Phone className="h-3 w-3"/>
                    <span>Call</span>
                 </a>
            </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
};

const InfoListCard = ({ title, icon, items, renderItem }: { title: string; icon: React.ReactNode; items: any[]; renderItem: (item: any, index: number) => React.ReactNode }) => {
    return (
        <Card className="shadow-md">
            <CardHeader className="flex flex-row items-center gap-3 space-y-0 p-4">
                {icon}
                <CardTitle className="text-base font-semibold">{title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 text-sm space-y-3">
                {items.map(renderItem)}
            </CardContent>
        </Card>
    )
}

export default function DashboardPage() {
  return (
    <div className="bg-background">
       <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-card px-4 shadow-sm md:hidden">
        <div className="flex items-center gap-4">
          <SidebarTrigger />
          <div>
            <h1 className="text-lg font-bold">Jadwal Ronda</h1>
            <p className="text-xs text-muted-foreground">Desember 2025</p>
          </div>
        </div>
        <button>
            <MoreVertical className="h-5 w-5 text-muted-foreground" />
        </button>
      </header>
      
      <div className="hidden md:block p-6 pt-4">
        <h1 className="text-2xl font-bold">Jadwal Ronda Perum. Alam Madani</h1>
        <p className="text-muted-foreground">RT 08 / RW 20 - Periode: Desember 2025</p>
      </div>

      <div className="p-4 md:p-6 md:pt-0">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {rondaDays.map((schedule, index) => (
              <ScheduleCard key={index} schedule={schedule} />
            ))}
          </div>

          <div className="space-y-6">
            <InfoListCard 
                title="Back Up / Pengganti Ronda" 
                icon={<Shield className="h-5 w-5 text-muted-foreground" />}
                items={backupRondaPeople}
                renderItem={(person, index) => (
                    <div key={index} className="flex items-center gap-3">
                        <User className="h-4 w-4 shrink-0 text-muted-foreground"/>
                        <div>
                            <p className="font-medium">{person.name} ({person.block})</p>
                            <p className="text-muted-foreground">{person.phone}</p>
                        </div>
                    </div>
                )}
            />

            <InfoListCard 
                title="Koordinator Ronda" 
                icon={<User className="h-5 w-5 text-muted-foreground" />}
                items={coordinatorRondaPeople}
                renderItem={(person, index) => (
                    <div key={index} className="flex items-center gap-3">
                        <User className="h-4 w-4 shrink-0 text-muted-foreground"/>
                        <div>
                            <p className="font-medium">{person.name} ({person.block})</p>
                            <p className="text-muted-foreground">{person.phone}</p>
                        </div>
                    </div>
                )}
            />

            <InfoListCard 
                title="Informasi" 
                icon={<Info className="h-5 w-5 text-muted-foreground" />}
                items={infoItems}
                renderItem={(item) => (
                   <div key={item.id} className="flex items-start gap-2">
                    <span className="font-bold text-foreground -mt-0.5">{item.id}.</span>
                    <span className="text-muted-foreground">{item.text}</span>
                  </div>
                )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
