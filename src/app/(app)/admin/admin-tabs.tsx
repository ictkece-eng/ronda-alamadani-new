'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GenerateScheduleForm } from './generate-schedule-form';
import { UserManagement } from './user-management';
import { Activity, Users, FileText, GitPullRequest, Download, History, Search, Bell, LogOut, Menu, UserCheck } from 'lucide-react';
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


export function AdminTabs() {
    const [view, setView] = useState('users');
    const auth = useAuth();
    const { toast } = useToast();
    const router = useRouter();

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
                description: 'Terjadi kesalahan saat mencoba logout.',
                variant: 'destructive',
            });
        }
    };

    const navItems = [
        { id: 'generate-schedule', label: 'Generate Schedule', icon: Activity },
        { id: 'users', label: 'Users/Warga', icon: Users },
        { id: 'requests', label: 'Schedule Requests', icon: FileText },
        { id: 'replacements', label: 'Replacements', icon: GitPullRequest },
        { id: 'export', label: 'Export Schedule', icon: Download },
        { id: 'history', label: 'Schedule History', icon: History },
    ];

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            <header className="sticky top-0 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6 z-40">
                <nav className="hidden flex-col gap-6 text-lg font-medium md:flex md:flex-row md:items-center md:gap-5 md:text-sm lg:gap-6">
                    <Link
                        href="#"
                        className="flex items-center gap-2 text-lg font-semibold md:text-base"
                    >
                        <UserCheck className="h-6 w-6 text-primary" />
                        <span className="">Ronda Planner</span>
                    </Link>
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id)}
                            className={cn(
                                "transition-colors hover:text-foreground",
                                view === item.id ? "text-foreground font-semibold" : "text-muted-foreground"
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </nav>
                
                {/* --- MOBILE NAV --- */}
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
                    <SheetContent side="left">
                        <nav className="grid gap-6 text-lg font-medium">
                            <Link
                                href="#"
                                className="flex items-center gap-2 text-lg font-semibold mb-4"
                            >
                                <UserCheck className="h-6 w-6 text-primary" />
                                <span className="">Ronda Planner</span>
                            </Link>
                            {navItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setView(item.id)}
                                    className={cn(
                                        "flex items-center gap-4 rounded-xl px-3 py-2 transition-colors hover:text-foreground",
                                        view === item.id ? "text-foreground bg-muted" : "text-muted-foreground"
                                    )}
                                >
                                    <item.icon className="h-5 w-5" />
                                    {item.label}
                                </button>
                            ))}
                        </nav>
                    </SheetContent>
                </Sheet>

                {/* --- HEADER RIGHT --- */}
                <div className="flex w-full items-center gap-4 md:ml-auto md:gap-2 lg:gap-4">
                    <form className="ml-auto flex-1 sm:flex-initial">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                type="search"
                                placeholder="Search..."
                                className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
                            />
                        </div>
                    </form>
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
                           <DropdownMenuLabel className="font-normal">
                                <div className="flex flex-col space-y-1">
                                    <p className="text-sm font-medium leading-none">Admin</p>
                                    <p className="text-xs leading-none text-muted-foreground">
                                    tirtopbas@gmail.com
                                    </p>
                                </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem disabled>
                                    Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem disabled>
                                    Settings
                                </DropdownMenuItem>
                                 <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={handleLogout}>
                                    <LogOut className="mr-2 h-4 w-4" />
                                    <span>Log out</span>
                                </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
                <div className="grid gap-8">
                     {view === 'generate-schedule' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Automated Schedule Generation</CardTitle>
                                <CardDescription>Generate a one-month ronda schedule automatically using AI, then save it to the database.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <GenerateScheduleForm />
                            </CardContent>
                        </Card>
                    )}
                    {view === 'users' && <UserManagement />}
                    {view === 'requests' && <ScheduleRequests />}
                    {view === 'replacements' && <ReplacementManagement />}
                    {view === 'export' && (
                         <Card>
                            <CardHeader>
                                <CardTitle>Export Schedule</CardTitle>
                                <CardDescription>Export the monthly ronda schedule to PDF or PNG format.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <ExportSchedule />
                            </CardContent>
                        </Card>
                    )}
                    {view === 'history' && <ScheduleHistory />}
                </div>
            </main>
        </div>
    );
}