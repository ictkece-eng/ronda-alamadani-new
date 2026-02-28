'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useAuth, useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GenerateScheduleForm } from './generate-schedule-form';
import { UserManagement } from './user-management';
import { Users, FileText, GitPullRequest, Download, History, Search, LogOut, Menu, UserCheck, Home, Users2, CalendarClock, Loader2 } from 'lucide-react';
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
import { collection, collectionGroup, doc } from 'firebase/firestore';
import type { Warga, ScheduleRequest, RondaSchedule } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';

const StatCard = ({ title, value, icon: Icon, isLoading }: { title: string, value: string | number, icon: React.ElementType, isLoading: boolean }) => (
    <Card className="shadow-lg border-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
            <div className="bg-primary/10 p-2 rounded-lg">
                <Icon className="h-4 w-4 text-primary" />
            </div>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                <Skeleton className="h-8 w-24" />
            ) : (
                <div className="text-3xl font-bold mt-1">{value}</div>
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
        const today = new Date();
        const year = today.getUTCFullYear();
        const month = today.getUTCMonth() + 1;
        
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
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight text-primary">Hi, welcome back!</h2>
                <p className="text-muted-foreground mt-1 text-lg">Ringkasan aktivitas ronda lingkungan Anda hari ini.</p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Warga" value={stats.totalUsers} icon={Users} isLoading={isLoading} />
                <StatCard title="Koordinator" value={stats.totalCoordinators} icon={UserCheck} isLoading={isLoading} />
                <StatCard title="Permintaan Tertunda" value={stats.pendingRequests} icon={FileText} isLoading={isLoading} />
                <StatCard title="Penggantian Bulan Ini" value={stats.replacementsThisMonth} icon={GitPullRequest} isLoading={isLoading} />
            </div>
        </div>
    );
};


export function AdminTabs() {
    const [view, setView] = useState('dashboard');
    const auth = useAuth();
    const { user: authUser } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const router = useRouter();

    const userDocRef = useMemoFirebase(() => (firestore && authUser ? doc(firestore, 'users', authUser.uid) : null), [firestore, authUser]);
    const { data: userData, isLoading: isRoleLoading } = useDoc<Warga>(userDocRef);

    const isAdmin = userData?.role === 'admin';
    const isCoordinator = userData?.role === 'coordinator';

    const handleLogout = async () => {
        if (!auth) return;
        try {
            await signOut(auth);
            toast({
                title: 'Logout Berhasil',
                description: 'Anda telah keluar dari aplikasi.',
            });
            router.push('/dashboard');
        } catch (error) {
            toast({
                title: 'Logout Gagal',
                description: 'An error occurred during logout.',
                variant: 'destructive',
            });
        }
    };

    const navItems = useMemo(() => {
        const items = [
            { id: 'dashboard', label: 'Dashboard', icon: Home, show: true },
            { id: 'generate-schedule', label: 'Generate Schedule', icon: CalendarClock, show: isAdmin },
            { id: 'users', label: 'Users/Warga', icon: Users2, show: true },
            { id: 'requests', label: 'Schedule Requests', icon: FileText, show: true },
            { id: 'replacements', label: 'Replacements', icon: GitPullRequest, show: true },
            { id: 'export', label: 'Export Schedule', icon: Download, show: true },
            { id: 'history', label: 'Schedule History', icon: History, show: true },
        ];
        return items.filter(i => i.show);
    }, [isAdmin]);

    const renderView = () => {
        if (isRoleLoading) return <div className="flex justify-center p-24"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

        switch (view) {
            case 'dashboard':
                return <DashboardView />;
            case 'generate-schedule':
                return isAdmin ? (
                    <Card className="shadow-lg border-none">
                        <CardHeader>
                            <CardTitle>Automated Schedule Generation</CardTitle>
                            <CardDescription>Generate a one-month ronda schedule automatically, then save it to the database.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <GenerateScheduleForm />
                        </CardContent>
                    </Card>
                ) : <DashboardView />;
            case 'users':
                return <UserManagement readOnly={isCoordinator} />;
            case 'requests':
                return <ScheduleRequests readOnly={isCoordinator} />;
            case 'replacements':
                return <ReplacementManagement readOnly={isCoordinator} />;
            case 'export':
                return (
                     <Card className="shadow-lg border-none">
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
         <nav className={cn("flex items-center space-x-6", className)}>
            {navItems.map(item => (
                <button
                    key={item.id}
                    onClick={() => setView(item.id)}
                    className={cn(
                        "flex flex-col items-center gap-1.5 text-sm font-semibold text-muted-foreground transition-all hover:text-primary py-4 relative",
                        view === item.id && "text-primary"
                    )}
                >
                    <item.icon className="h-5 w-5" />
                    <span>{item.label}</span>
                    {view === item.id && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full" />
                    )}
                </button>
            ))}
        </nav>
    );

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            {/* Main Header */}
            <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-card px-4 md:px-6 shadow-sm">
                 <Sheet>
                    <SheetTrigger asChild>
                        <Button size="icon" variant="outline" className="lg:hidden">
                        <Menu className="h-5 w-5" />
                        <span className="sr-only">Toggle Menu</span>
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-[300px] sm:max-max-xs">
                        <nav className="grid gap-6 text-lg font-medium mt-10">
                            <Link
                                href="#"
                                className="group flex h-12 w-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-primary-foreground md:text-base mb-4"
                            >
                                <UserCheck className="h-6 w-6 transition-all group-hover:scale-110" />
                                <span className="sr-only">Ronda Planner</span>
                            </Link>
                            {navItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => { setView(item.id); }}
                                    className={cn(
                                        "flex items-center gap-4 px-3 py-2 rounded-lg transition-colors text-muted-foreground hover:text-primary hover:bg-primary/5",
                                        view === item.id && "text-primary bg-primary/10 font-bold"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                    </SheetContent>
                </Sheet>
                
                <div className="flex items-center gap-2 font-bold text-xl text-primary lg:mr-8">
                    <UserCheck className="h-7 w-7" />
                    <span className="hidden sm:inline">Ronda Planner</span>
                </div>

                 <div className="relative flex-1 md:max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        type="search"
                        placeholder="Search dashboard..."
                        className="w-full h-10 rounded-xl bg-muted/50 border-none pl-10 focus-visible:ring-primary"
                    />
                </div>

                 <div className="ml-auto flex items-center gap-4">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                            variant="ghost"
                            className="relative h-10 w-10 rounded-full border-2 border-primary/20 p-0 overflow-hidden"
                            >
                                <Avatar className="h-full w-full">
                                    <AvatarImage src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjBwb3J0cmFpdHxlbnwwfHx8fDE3Njk3NDY1MTR8MA" alt="User" />
                                    <AvatarFallback>U</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">{userData?.name || 'User'}</p>
                                    <p className="text-xs leading-none text-muted-foreground uppercase">{userData?.role || 'Role'}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem disabled>
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem disabled>
                                Support
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10">
                                <LogOut className="mr-2 h-4 w-4" />
                                Logout
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                 </div>
            </header>

            {/* Sub Nav / Nav Tabs */}
            <div className="hidden lg:block border-b bg-card px-4 md:px-6">
                <MainNav />
            </div>

            <main className="flex-1 p-4 md:p-8 max-w-7xl mx-auto w-full">
                {renderView()}
            </main>
        </div>
    );
}