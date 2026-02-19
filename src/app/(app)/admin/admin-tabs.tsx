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
import { collection, collectionGroup } from 'firebase/firestore';
import type { Warga, ScheduleRequest, RondaSchedule } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const StatCard = ({ title, value, icon: Icon, isLoading }: { title: string, value: string | number, icon: React.ElementType, isLoading: boolean }) => (
    <Card className="shadow-lg">
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
        <>
            <div className="mb-6">
                <h2 className="text-2xl font-semibold">Hi, welcome back!</h2>
                <p className="text-muted-foreground">Last login was 23 hours ago. View details</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-4">
                <StatCard title="Total Warga" value={stats.totalUsers} icon={Users} isLoading={isLoading} />
                <StatCard title="Koordinator" value={stats.totalCoordinators} icon={UserCheck} isLoading={isLoading} />
                <StatCard title="Permintaan Tertunda" value={stats.pendingRequests} icon={FileText} isLoading={isLoading} />
                <StatCard title="Penggantian Bulan Ini" value={stats.replacementsThisMonth} icon={GitPullRequest} isLoading={isLoading} />
            </div>
        </>
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
                    <Card className="shadow-lg">
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
                     <Card className="shadow-lg">
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

    const MainNav = ({ className }: { className?: string }) => (
         <nav className={cn("flex items-center space-x-4 lg:space-x-6", className)}>
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={cn(
                        "flex flex-col items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-primary",
                        view === item.id && "text-primary border-b-2 border-primary"
                    )}
                >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                </button>
            ))}
        </nav>
    );

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-card px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
                 <Sheet>
                    <SheetTrigger asChild>
                        <Button size="icon" variant="outline" className="sm:hidden">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle Menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="sm:max-w-xs">
                        <nav className="grid gap-6 text-lg font-medium">
                            <Link
                                href="#"
                                className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
                            >
                                <UserCheck className="h-5 w-5 transition-all group-hover:scale-110" />
                                <span className="sr-only">Ronda Planner</span>
                            </Link>
                            {navItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setView(item.id)}
                                    className={cn(
                                        "flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground",
                                        view === item.id && "text-foreground"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                    </SheetContent>
                </Sheet>
                 <div className="relative ml-auto flex-1 md:grow-0">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search..."
                        className="w-full rounded-lg bg-background pl-8 md:w-[200px] lg:w-[320px]"
                    />
                </div>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                        variant="outline"
                        size="icon"
                        className="overflow-hidden rounded-full"
                        >
                            <Avatar className="h-9 w-9">
                                <AvatarImage src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjBwb3J0cmFpdHxlbnwwfHx8fDE3Njk3NDY1MTR8MA" alt="Admin" />
                                <AvatarFallback>A</AvatarFallback>
                            </Avatar>
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
                            Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </header>
            <div className="border-b bg-card">
                 <div className="px-4 sm:px-6">
                    <div className="hidden sm:block">
                        <MainNav />
                    </div>
                </div>
            </div>
            <main className="flex flex-1 flex-col gap-4 p-4 sm:px-6 sm:py-6 md:gap-8">
                {renderView()}
            </main>
        </div>
    );
}
