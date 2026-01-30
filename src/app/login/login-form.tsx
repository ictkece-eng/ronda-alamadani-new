'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/firebase';
import { signInAnonymously, signInWithEmailAndPassword } from 'firebase/auth';

export function LoginForm({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isEmailLoading, setIsEmailLoading] = useState(false);
  const [isAnonymousLoading, setIsAnonymousLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const auth = useAuth();

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsEmailLoading(true);

    if (!auth) {
        toast({
            variant: "destructive",
            title: 'Error',
            description: 'Firebase Auth not initialized.',
        });
        setIsEmailLoading(false);
        return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (email === 'tirtopbas@gmail.com') {
        toast({
          title: 'Login Admin Berhasil',
          description: 'Anda akan diarahkan ke halaman admin.',
        });
        router.push('/admin');
      } else {
        toast({
          title: 'Login Berhasil',
          description: 'Anda akan diarahkan ke dashboard.',
        });
        router.push('/dashboard');
      }
      onLoginSuccess?.();
    } catch (error: any) {
      console.error(error);
      toast({
        variant: "destructive",
        title: 'Login Gagal',
        description: 'Email atau password salah. Coba lagi.',
      });
    } finally {
      setIsEmailLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setIsAnonymousLoading(true);
    if (!auth) {
        toast({ variant: "destructive", title: 'Error', description: 'Firebase Auth not initialized.' });
        setIsAnonymousLoading(false);
        return;
    }
    try {
        await signInAnonymously(auth);
        toast({
            title: 'Login Berhasil',
            description: 'Selamat datang di Ronda Planner!',
        });
        router.push('/dashboard');
        onLoginSuccess?.();
    } catch (error: any) {
        console.error("Anonymous sign-in error:", error);
        toast({
            variant: "destructive",
            title: 'Login Gagal',
            description: 'Tidak dapat masuk sebagai tamu. Coba lagi.',
        });
    } finally {
        setIsAnonymousLoading(false);
    }
  };


  const isLoading = isEmailLoading || isAnonymousLoading;

  return (
    <div className="space-y-6">
        <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="email">Email Admin</Label>
                <Input
                id="email"
                type="email"
                placeholder="admin@contoh.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                id="password"
                type="password"
                required
                placeholder="******"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
                {isEmailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Masuk sebagai Admin
            </Button>
        </form>

        <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                Atau
                </span>
            </div>
        </div>

        <Button variant="secondary" className="w-full" onClick={handleAnonymousSignIn} disabled={isLoading}>
            {isAnonymousLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <User />}
            Masuk sebagai Warga (Tamu)
        </Button>
    </div>
  );
}
