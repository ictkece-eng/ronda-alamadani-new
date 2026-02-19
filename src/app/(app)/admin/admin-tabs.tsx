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
        <div className="flex bg-background min-h-screen">
            {/* Sidebar */}
            <aside className="w-20 bg-card p-4 flex flex-col items-center justify-between border-r">
                <div className='flex flex-col items-center gap-y-6'>
                    <div className="h-10 w-10 bg-primary text-primary-foreground flex items-center justify-center rounded-full font-bold text-xl">
                        S
                    </div>
                    <nav className="flex flex-col items-center gap-y-2">
                        {navItems.map(item => (
                             <button
                                key={item.id}
                                onClick={() => setView(item.id)}
                                className={cn(
                                    "p-3 rounded-xl transition-colors w-full",
                                    view === item.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                                title={item.label}
                            >
                                <item.icon className="h-5 w-5 mx-auto" />
                            </button>
                        ))}
                    </nav>
                </div>
                 <div>
                    <button
                        onClick={handleLogout}
                        className="p-3 rounded-xl transition-colors w-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Logout"
                    >
                        <LogOut className="h-5 w-5 mx-auto" />
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 p-6 sm:p-8">
                <header className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
                    <div className="flex items-center gap-4">
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input placeholder="Search for anything..." className="pl-10" />
                        </div>
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
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </header>
                
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
            </div>
        </div>
    );
}
