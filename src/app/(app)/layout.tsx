'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  LogIn,
  LogOut,
  FilePlus2,
  Users,
  UserCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

function BottomNavbar() {
    const pathname = usePathname();
    const { user, isUserLoading } = useUser();
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
            router.push('/login');
        } catch (error) {
            toast({
                title: 'Logout Gagal',
                description: 'Terjadi kesalahan saat mencoba logout.',
                variant: 'destructive',
            });
        }
    };
    
    // Simple role check based on email for UI purposes
    const isAdmin = user?.email === 'tirtopbas@gmail.com';

    const navItems = user
      ? [
          { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
          ...(isAdmin
            ? [{ href: '/admin', icon: UserCheck, label: 'Admin' }]
            : [{ href: '/schedule/request', icon: FilePlus2, label: 'Request' }]),
        ]
      : [{ href: '/login', icon: LogIn, label: 'Login' }];


    if (isUserLoading) {
        return (
             <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-card shadow-t-lg">
                <div className="flex h-16 items-center justify-around">
                    <div className="h-8 w-20 animate-pulse rounded-md bg-muted"></div>
                    <div className="h-8 w-20 animate-pulse rounded-md bg-muted"></div>
                </div>
            </nav>
        )
    }

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-card shadow-t-lg">
        <div className="flex h-16 items-center justify-around">
            {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
                <Link
                key={item.href}
                href={item.href}
                className={cn(
                    'flex flex-col items-center justify-center gap-1 text-xs w-full h-full',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                )}
                >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
                </Link>
            );
            })}
            {user && (
                 <button
                    onClick={handleLogout}
                    className="flex flex-col items-center justify-center gap-1 text-xs w-full h-full text-muted-foreground"
                >
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                </button>
            )}
        </div>
        </nav>
    );
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
        <main className="pb-16">
            {children}
        </main>
        <BottomNavbar />
    </div>
  );
}
