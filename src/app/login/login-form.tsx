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
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';


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
      const userCredential = await signInWithEmailAndPassword(auth, email.toLowerCase().trim(), password);
      const uid = userCredential.user.uid;
      const userEmail = userCredential.user.email?.toLowerCase().trim();

      // Check Role
      const adminRoleRef = doc(firestore, 'roles_admin', uid);
      const adminSnap = await getDoc(adminRoleRef);
      
      const userRef = doc(firestore, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      let role = 'user';
      if (adminSnap.exists()) {
        role = 'admin';
      } else if (userSnap.exists()) {
        role = userSnap.data().role || 'user';
      } else if (userEmail) {
        // Fallback check by email
        const q = query(collection(firestore, 'users'), where('email', '==', userEmail), limit(1));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
            role = qSnap.docs[0].data().role || 'user';
        }
      }

      if (role === 'admin' || role === 'coordinator') {
        toast({ title: 'Login Berhasil', description: `Selamat datang kembali.` });
        router.push('/admin');
      } else {
        toast({ title: 'Login Berhasil', description: 'Mengarahkan ke dashboard.' });
        router.push('/dashboard');
      }

      onLoginSuccess?.();
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: 'Login Gagal',
        description: 'Email atau password salah.',
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
