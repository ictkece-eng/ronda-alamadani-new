'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GenerateScheduleForm } from './generate-schedule-form';
import { UserManagement } from './user-management';
import { Activity, Users, FileText, GitPullRequest, Download, History, Search, Bell, LogOut } from 'lucide-react';
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
        <div className="bg-muted/40 min-h-screen">
             {/* Top Header Bar */}
            <header className="bg-card shadow-sm sticky top-0 z-40 border-b">
                <div className="container mx-auto flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
                     <div className="flex items-center gap-4">
                        <div className="h-8 w-8 bg-primary text-primary-foreground flex items-center justify-center rounded-md font-bold text-lg">
                            S
                        </div>
                        <h1 className="text-xl font-bold text-foreground hidden sm:block">Admin Dashboard</h1>
                    </div>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center gap-1">
                        {navItems.map(item => (
                            <Button
                                key={item.id}
                                variant={view === item.id ? 'secondary' : 'ghost'}
                                size="sm"
                                onClick={() => setView(item.id)}
                            >
                                <item.icon className="mr-2" />
                                {item.label}
                            </Button>
                        ))}
                    </nav>

                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon">
                            <Search className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon">
                            <Bell className="h-5 w-5" />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                                    <Avatar className="h-10 w-10">
                                        <AvatarImage src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3NDE5ODJ8MHwxfHNlYXJjaHwxfHxwZXJzb24lMjBwb3J0cmFpdHxlbnwwfHx8fDE3Njk3NDY1MTR8MA" alt="Admin" />
                                        <AvatarFallback>A</AvatarFallback>
                                    </Avatar>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end" forceMount>
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
                </div>
                 {/* Mobile Navigation */}
                <nav className="md:hidden bg-card border-t">
                    <div className="flex items-center overflow-x-auto p-2 gap-1">
                         {navItems.map(item => (
                            <Button
                                key={item.id}
                                variant={view === item.id ? 'secondary' : 'ghost'}
                                size="sm"
                                className="shrink-0"
                                onClick={() => setView(item.id)}
                            >
                                <item.icon className="mr-2 h-4 w-4" />
                                {item.label}
                            </Button>
                        ))}
                    </div>
                </nav>
            </header>

            {/* Main Content */}
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
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
