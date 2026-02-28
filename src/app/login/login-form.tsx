'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, LogIn as LogInIcon, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth, useFirestore } from '@/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function LoginForm({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  
  const { toast } = useToast();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);

    if (!auth || !firestore) {
        toast({
            variant: "destructive",
            title: 'Error',
            description: 'Firebase belum siap. Silakan refresh halaman.',
        });
        setIsLoading(false);
        return;
    }

    const cleanEmail = email.toLowerCase().trim();

    try {
      if (mode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        const uid = userCredential.user.uid;

        const userRef = doc(firestore, 'users', uid);
        await setDoc(userRef, {
            id: uid,
            name: cleanEmail.split('@')[0],
            email: cleanEmail,
            phone: '-',
            address: '-',
            role: cleanEmail === 'tirtopbas@gmail.com' ? 'admin' : 'user',
        }, { merge: true });

        // Auto-promote master admin
        if (cleanEmail === 'tirtopbas@gmail.com') {
            await setDoc(doc(firestore, 'roles_admin', uid), { id: uid, email: cleanEmail }, { merge: true });
        }

        toast({ title: 'Pendaftaran Berhasil', description: 'Akun Anda telah dibuat. Silakan login.' });
        setMode('login');
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const uid = userCredential.user.uid;

        // Ensure master admin has the record in roles_admin and profile
        if (cleanEmail === 'tirtopbas@gmail.com') {
            await setDoc(doc(firestore, 'roles_admin', uid), { id: uid, email: cleanEmail }, { merge: true });
            await setDoc(doc(firestore, 'users', uid), { role: 'admin' }, { merge: true });
        }

        const adminRoleRef = doc(firestore, 'roles_admin', uid);
        const adminSnap = await getDoc(adminRoleRef);
        
        const userRef = doc(firestore, 'users', uid);
        const userSnap = await getDoc(userRef);
        
        let role = 'user';
        if (adminSnap.exists() || cleanEmail === 'tirtopbas@gmail.com') {
          role = 'admin';
        } else if (userSnap.exists()) {
          role = userSnap.data()?.role || 'user';
        }

        if (role === 'admin' || role === 'coordinator') {
          toast({ title: 'Login Berhasil', description: `Selamat datang kembali, Admin.` });
          router.push('/admin');
        } else {
          toast({ title: 'Login Berhasil', description: 'Mengarahkan ke dashboard warga.' });
          router.push('/dashboard');
        }
        onLoginSuccess?.();
      }
    } catch (error: any) {
      let message = 'Terjadi kesalahan. Silakan coba lagi.';
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        message = 'Email atau password salah. Pastikan akun sudah terdaftar.';
      } else if (error.code === 'auth/email-already-in-use') {
        message = 'Email sudah terdaftar. Silakan gunakan email lain atau login.';
      } else if (error.code === 'auth/weak-password') {
        message = 'Password terlalu lemah (minimal 6 karakter).';
      }

      toast({
        variant: "destructive",
        title: mode === 'login' ? 'Login Gagal' : 'Pendaftaran Gagal',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Masuk</TabsTrigger>
                <TabsTrigger value="signup">Daftar</TabsTrigger>
            </TabsList>
            
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        placeholder="nama@email.com"
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
                    {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : mode === 'login' ? (
                        <LogInIcon className="mr-2 h-4 w-4" />
                    ) : (
                        <UserPlus className="mr-2 h-4 w-4" />
                    )}
                    {mode === 'login' ? 'Masuk' : 'Daftar Akun Baru'}
                </Button>
            </form>
        </Tabs>
        
        {mode === 'signup' && (
            <p className="text-[10px] text-muted-foreground text-center italic">
                *Akun tirtopbas@gmail.com akan otomatis menjadi Admin Utama.
            </p>
        )}
    </div>
  );
}