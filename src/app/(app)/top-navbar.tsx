'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  LogOut,
  LogIn,
  UserCheck,
} from 'lucide-react';
import { useAuth, useUser } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
  } from '@/components/ui/dialog';
import { LoginForm } from '../login/login-form';

export function TopNavbar() {
    const { user, isUserLoading } = useUser();
    const auth = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [isLoginOpen, setIsLoginOpen] = React.useState(false);

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
    
    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b shadow-sm">
                <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
                    <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-primary">
                        <UserCheck className="h-6 w-6" />
                        <span>Ronda Planner</span>
                    </Link>
                    
                    <div className="flex items-center gap-2">
                        {isUserLoading ? (
                            <div className="h-8 w-20 animate-pulse rounded-md bg-muted"></div>
                        ) : user ? (
                            <Button variant="ghost" size="sm" onClick={handleLogout}>
                                <LogOut className="mr-2 h-4 w-4" />
                                Logout
                            </Button>
                        ) : (
                            <Button size="sm" onClick={() => setIsLoginOpen(true)}>
                                <LogIn className="mr-2 h-4 w-4" />
                                Login
                            </Button>
                        )}
                    </div>
                </div>
            </header>
            
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
        </>
    );
}
