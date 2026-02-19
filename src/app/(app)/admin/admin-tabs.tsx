'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useAuth, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GenerateScheduleForm } from './generate-schedule-form';
import { UserManagement } from './user-management';
import { Activity, Users, FileText, GitPullRequest, Download, History, Search, LogOut, Menu, UserCheck, Home, Bell, Users2, CalendarClock } from 'lucide-react';
import { ScheduleRequests } from './schedule-requests';
import { ReplacementManagement } from './replacement-management';
import { ExportSchedule } from './export-schedule';
import { ScheduleHistory } from './schedule-history';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { collection, collectionGroup, query, where } from 'firebase/firestore';
import type { Warga, ScheduleRequest, RondaSchedule } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const StatCard = ({ title, value, icon: Icon, isLoading }: { title: string, value: string | number, icon: React.ElementType, isLoading: boolean }) => (
    <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <Skeleton className="h-8 w-24" />
            ) : (
                <div className="text-2xl font-bold">{value}</div>
            )}
        </CardContent>
    </Card>
)

const DashboardView = () => {
    const firestore = useFirestore();

    const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersQuery);

    const requestsQuery = useMemoFirebase(() => firestore ? collectionGroup(firestore, 'scheduleRequests') : null, [firestore]);
    const { data: requests, isLoading: isRequestsLoading } = useCollection<ScheduleRequest>(requestsQuery);

    const schedulesQuery = useMemoFirebase(() => firestore ? collectionGroup(firestore, 'rondaSchedules') : null, [firestore]);
    const { data: allSchedules, isLoading: isSchedulesLoading } = useCollection<RondaSchedule>(schedulesQuery);

    const isLoading = isUsersLoading || isRequestsLoading || isSchedulesLoading;

    const stats = useMemo(() => {
        const [year, month] = new Date().toISOString().split('T')[0].substring(0, 7).split('-').map(Number);
        
        const pendingRequests = requests?.filter(r => r.status === 'pending').length ?? 0;
        const totalUsers = users?.filter(u => u.role === 'user' || u.role === 'coordinator').length ?? 0;
        const replacementsThisMonth = allSchedules?.filter(s => {
            if (!s.replacementUserId) return false;
            const scheduleDate = new Date(s.date);
            return scheduleDate.getUTCFullYear() === year && scheduleDate.getUTCMonth() + 1 === month;
        }).length ?? 0;
        const totalCoordinators = users?.filter(u => u.role === 'coordinator').length ?? 0;

        return { pendingRequests, totalUsers, replacementsThisMonth, totalCoordinators };
    }, [users, requests, allSchedules]);

    return (
        <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
            <StatCard title="Total Warga" value={stats.totalUsers} icon={Users} isLoading={isLoading} />
            <StatCard title="Koordinator" value={stats.totalCoordinators} icon={UserCheck} isLoading={isLoading} />
            <StatCard title="Permintaan Tertunda" value={stats.pendingRequests} icon={FileText} isLoading={isLoading} />
            <StatCard title="Penggantian Bulan Ini" value={stats.replacementsThisMonth} icon={GitPullRequest} isLoading={isLoading} />
        </div>
    );
};


export function AdminTabs() {
    const [view, setView] = useState('dashboard');
    const auth = useAuth();
    const { toast } = useToast();
    const router = useRouter();

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            toast({
                title: 'Logout Successful',
                description: 'You have been logged out.',
            });
            router.push('/dashboard');
        } catch (error) {
            toast({
                title: 'Logout Failed',
                description: 'An error occurred during logout.',
                variant: 'destructive',
            });
        }
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: Home },
        { id: 'generate-schedule', label: 'Generate Schedule', icon: CalendarClock },
        { id: 'users', label: 'Users/Warga', icon: Users2 },
        { id: 'requests', label: 'Schedule Requests', icon: FileText },
        { id: 'replacements', label: 'Replacements', icon: GitPullRequest },
        { id: 'export', label: 'Export Schedule', icon: Download },
        { id: 'history', label: 'Schedule History', icon: History },
    ];

    const renderView = () => {
        switch (view) {
            case 'dashboard':
                return <DashboardView />;
            case 'generate-schedule':
                return (
                    <Card className="shadow-md">
                        <CardHeader>
                            <CardTitle>Automated Schedule Generation</CardTitle>
                            <CardDescription>Generate a one-month ronda schedule automatically, then save it to the database.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <GenerateScheduleForm />
                        </CardContent>
                    </Card>
                );
            case 'users':
                return <UserManagement />;
            case 'requests':
                return <ScheduleRequests />;
            case 'replacements':
                return <ReplacementManagement />;
            case 'export':
                return (
                     <Card className="shadow-md">
                        <CardHeader>
                            <CardTitle>Export Schedule</CardTitle>
                            <CardDescription>Export the monthly ronda schedule to PDF or PNG format.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ExportSchedule />
                        </CardContent>
                    </Card>
                );
            case 'history':
                return <ScheduleHistory />;
            default:
                return <DashboardView />;
        }
    };

    const SidebarNav = () => (
        <nav className="grid items-start px-2 text-sm font-medium lg:px-4">
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary",
                        view === item.id && "bg-muted text-primary"
                    )}
                >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                </button>
            ))}
        </nav>
    );

    return (
        <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
            <aside className="hidden border-r bg-card md:block">
                <div className="flex h-full max-h-screen flex-col gap-2">
                    <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                        <Link href="/admin" className="flex items-center gap-2 font-semibold text-primary">
                            <UserCheck className="h-6 w-6" />
                            <span className="">Ronda Planner</span>
                        </Link>
                    </div>
                    <div className="flex-1 overflow-auto py-2">
                        <SidebarNav />
                    </div>
                </div>
            </aside>
            <div className="flex flex-col">
                <header className="flex h-14 items-center gap-4 border-b bg-card px-4 lg:h-[60px] lg:px-6">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="outline"
                                size="icon"
                                className="shrink-0 md:hidden"
                            >
                                <Menu className="h-5 w-5" />
                                <span className="sr-only">Toggle navigation menu</span>
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="left" className="flex flex-col p-0">
                             <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
                                <Link href="/admin" className="flex items-center gap-2 font-semibold text-primary">
                                    <UserCheck className="h-6 w-6" />
                                    <span className="">Ronda Planner</span>
                                </Link>
                            </div>
                             <div className="flex-1 overflow-auto py-2">
                                <SidebarNav />
                             </div>
                        </SheetContent>
                    </Sheet>

                    <div className="w-full flex-1">
                        <form>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="search"
                                    placeholder="Search..."
                                    className="w-full appearance-none bg-background pl-8 shadow-none md:w-2/3 lg:w-1/3"
                                />
                            </div>
                        </form>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="secondary" size="icon" className="rounded-full">
                                <Avatar className="h-8 w-8">
                                    <AvatarImage src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjBwb3J0cmFpdHxlbnwwfHx8fDE3Njk3NDY1MTR8MA" alt="Admin" />
                                    <AvatarFallback>A</AvatarFallback>
                                </Avatar>
                                <span className="sr-only">Toggle user menu</span>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>My Account</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled>Settings</DropdownMenuItem>
                            <DropdownMenuItem disabled>Support</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout}>
                                <LogOut className="mr-2 h-4 w-4" />
                                <span>Logout</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </header>
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-muted/40">
                    {renderView()}
                </main>
            </div>
        </div>
    );
}
