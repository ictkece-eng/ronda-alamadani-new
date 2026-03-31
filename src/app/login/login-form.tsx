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
import { doc, getDoc, setDoc } from 'firebase/firestore';

export function LoginForm({ onLoginSuccess }: { onLoginSuccess?: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
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
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      const uid = userCredential.user.uid;

      // Force sync admin status on login for Master Account
      if (cleanEmail === 'tirtopbas@gmail.com' || uid === 'hKUvl9TWZ8eR4wwjMFsTP49xfG22') {
          try {
              await setDoc(doc(firestore, 'roles_admin', uid), { id: uid, email: cleanEmail }, { merge: true });
              await setDoc(doc(firestore, 'users', uid), { role: 'admin' }, { merge: true });
          } catch (e) {
              console.warn("Syncing admin status failed, but hardcoded UID rules will bypass this.");
          }
      }

      toast({ title: 'Login Berhasil', description: 'Selamat datang kembali!' });
      
      const userSnap = await getDoc(doc(firestore, 'users', uid));
      const userData = userSnap.data();
      const role = userData?.role || 'user';

      if (role === 'admin' || role === 'coordinator' || cleanEmail === 'tirtopbas@gmail.com' || uid === 'hKUvl9TWZ8eR4wwjMFsTP49xfG22') {
        router.push('/admin');
      } else {
        router.push('/dashboard');
      }
      onLoginSuccess?.();
    } catch (error: any) {
      let message = 'Terjadi kesalahan. Silakan coba lagi.';
      
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
        message = 'Email atau password salah.';
      } else if (error.code === 'auth/user-not-found') {
        message = 'Akun tidak ditemukan.';
      }

      toast({
        variant: "destructive",
        title: 'Login Gagal',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-4 border bg-white p-4 shadow-sm">
        <div className="d-flex align-items-start gap-3 mb-4">
          <div className="rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-10 p-3 text-primary">
            <LogInIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="small text-uppercase fw-semibold text-primary mb-1">Login</div>
            <div className="fw-semibold">Masuk ke akun Anda</div>
            <div className="small text-muted">Gunakan email dan password yang sudah terdaftar untuk melanjutkan.</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              className="rounded-pill"
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
              className="rounded-pill"
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <LogInIcon className="mr-2 h-4 w-4" />
            )}
            Masuk
          </Button>
        </form>
      </div>
    </div>
  );
}
