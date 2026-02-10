'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GenerateScheduleForm } from './generate-schedule-form';
import { UserManagement } from './user-management';
import { Activity, Users, FileText, GitPullRequest, Download, History, Building, LogOut } from 'lucide-react';
import { ScheduleRequests } from './schedule-requests';
import { ReplacementManagement } from './replacement-management';
import { ExportSchedule } from './export-schedule';
import { ScheduleHistory } from './schedule-history';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

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

    const getTitle = () => {
        return navItems.find(item => item.id === view)?.label || 'Admin Panel';
    };

    return (
        <div className="flex min-h-screen bg-muted/30">
            {/* Sidebar */}
            <aside className="w-20 bg-card p-4 flex flex-col items-center justify-between border-r sticky top-0 h-screen">
                <div className='flex flex-col items-center gap-y-6'>
                    <Link href="/dashboard" className="p-2 bg-primary text-primary-foreground rounded-xl">
                        <Building className="h-6 w-6" />
                    </Link>
                    <nav className="flex flex-col items-center gap-y-3">
                        {navItems.map(item => (
                             <button
                                key={item.id}
                                onClick={() => setView(item.id)}
                                className={cn(
                                    "p-3 rounded-lg transition-colors w-full",
                                    view === item.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                                title={item.label}
                            >
                                <item.icon className="h-5 w-5 mx-auto" />
                            </button>
                        ))}
                    </nav>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} title="Logout">
                    <LogOut className="h-5 w-5 text-muted-foreground" />
                </Button>
            </aside>

            {/* Main Content */}
            <div className="flex-1 p-6 sm:p-8">
                <header className="flex items-center justify-between mb-8">
                    <h1 className="text-3xl font-bold text-foreground">{getTitle()}</h1>
                    {/* Placeholder for future elements like user avatar */}
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
