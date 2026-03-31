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
            <header className="navbar navbar-expand-lg fixed-top border-bottom bg-white bg-opacity-75 shadow-sm ronda-navbar">
                <div className="container-xxl px-3 px-lg-4 d-flex align-items-center justify-content-between" style={{ minHeight: '4.5rem' }}>
                    <Link href="/dashboard" className="navbar-brand d-flex align-items-center gap-2 fw-bold text-primary-emphasis mb-0">
                        <UserCheck className="h-6 w-6" />
                        <span>Ronda Planner</span>
                    </Link>
                    
                    <div className="d-flex align-items-center gap-2">
                        {isUserLoading ? (
                            <div className="placeholder-glow">
                                <span className="placeholder rounded-pill" style={{ width: '5rem', height: '2.25rem' }}></span>
                            </div>
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
                    <DialogHeader className="text-center space-y-2 pb-2 border-bottom">
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
