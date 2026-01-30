'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  LogOut,
  FilePlus2,
  UserCheck,
  LogIn,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoginForm } from '../login/login-form';


function BottomNavbar({ onLoginClick }: { onLoginClick: () => void }) {
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
            router.push('/dashboard'); // Redirect to dashboard after logout
        } catch (error) {
            toast({
                title: 'Logout Gagal',
                description: 'Terjadi kesalahan saat mencoba logout.',
                variant: 'destructive',
            });
        }
    };
    
    // A simple check for admin role. In a real app, this should be based on custom claims.
    const isAdmin = user?.email === 'tirtopbas@gmail.com';

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

    const navItems = [
        { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', show: true },
        { href: '/admin', icon: UserCheck, label: 'Admin', show: !!user && isAdmin },
        { href: '/schedule/request', icon: FilePlus2, label: 'Request', show: !!user && !isAdmin },
    ];


    return (
        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t bg-card shadow-t-lg">
        <div className="flex h-16 items-center justify-around">
            {navItems.filter(item => item.show).map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
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
           
            {user ? (
                 <button
                    onClick={handleLogout}
                    className="flex flex-col items-center justify-center gap-1 text-xs w-full h-full text-muted-foreground"
                >
                    <LogOut className="h-5 w-5" />
                    <span>Logout</span>
                </button>
            ) : (
                 <button
                    onClick={onLoginClick}
                    className="flex flex-col items-center justify-center gap-1 text-xs w-full h-full text-muted-foreground"
                >
                    <LogIn className="h-5 w-5" />
                    <span>Login</span>
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
  const [isLoginOpen, setIsLoginOpen] = React.useState(false);
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();

  // Redirect non-admins away from admin page
  React.useEffect(() => {
    if (!isUserLoading && user && pathname.startsWith('/admin')) {
      if (user.email !== 'tirtopbas@gmail.com') {
        router.replace('/dashboard');
      }
    }
  }, [user, isUserLoading, pathname, router]);

  return (
    <div>
        <main className="pb-16">
            {children}
        </main>
        
        <Dialog open={isLoginOpen} onOpenChange={setIsLoginOpen}>
            <DialogContent className="sm:max-w-md">
                 <DialogHeader className="text-center space-y-2">
                    <DialogTitle className="text-2xl font-bold">Ronda Planner Login</DialogTitle>
                    <DialogDescription>
                        Masukkan kredensial Anda untuk masuk.
                    </DialogDescription>
                </DialogHeader>
                <LoginForm onLoginSuccess={() => setIsLoginOpen(false)} />
            </DialogContent>
        </Dialog>

        <BottomNavbar onLoginClick={() => setIsLoginOpen(true)} />
    </div>
  );
}
