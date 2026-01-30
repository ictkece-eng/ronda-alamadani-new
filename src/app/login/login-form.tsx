'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn as LogInIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';


export function LoginForm({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    if (!auth || !firestore) {
        toast({
            variant: "destructive",
            title: 'Error',
            description: 'Firebase not initialized correctly.',
        });
        setIsLoading(false);
        return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      if (email === 'tirtopbas@gmail.com') {
        const adminRoleRef = doc(firestore, 'roles_admin', userCredential.user.uid);
        // Ensure the admin role document exists
        await setDoc(adminRoleRef, { userId: userCredential.user.uid }, { merge: true });

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
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleEmailSubmit} className="space-y-4">
        <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
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
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogInIcon />}
            Masuk
        </Button>
    </form>
  );
}
