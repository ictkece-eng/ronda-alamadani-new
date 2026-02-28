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
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';


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
      const uid = userCredential.user.uid;
      const userEmail = userCredential.user.email;
      
      // 1. Handle Special Super Admin Email
      if (userEmail === 'tirtopbas@gmail.com') {
        const adminRoleRef = doc(firestore, 'roles_admin', uid);
        await setDoc(adminRoleRef, { userId: uid }, { merge: true });
        
        toast({ title: 'Login Admin Berhasil', description: 'Selamat datang, Super Admin.' });
        router.push('/admin');
        onLoginSuccess?.();
        return;
      }

      // 2. Lookup and Migrate User Data by Email
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('email', '==', userEmail));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const userDoc = querySnap.docs[0];
        const userData = userDoc.data();
        const role = userData.role || 'user';

        // Migrate ID to UID for direct lookups in the future if they don't match
        if (userDoc.id !== uid) {
          await setDoc(doc(firestore, 'users', uid), { ...userData, id: uid }, { merge: true });
          // Only delete if it's a different document ID to prevent accidental deletion
          if (userDoc.id !== uid) {
            await deleteDoc(doc(firestore, 'users', userDoc.id));
          }
        }

        if (role === 'admin' || role === 'coordinator') {
          toast({
            title: 'Login Berhasil',
            description: `Selamat datang, ${role}.`,
          });
          router.push('/admin');
        } else {
          toast({
            title: 'Login Berhasil',
            description: 'Anda akan diarahkan ke dashboard warga.',
          });
          router.push('/dashboard');
        }
      } else {
        // No Firestore doc found, fallback to dashboard or create a default user doc
        toast({
            title: 'Login Berhasil',
            description: 'Profil Anda belum terdaftar di sistem warga.',
        });
        router.push('/dashboard');
      }

      onLoginSuccess?.();
    } catch (error: any) {
      console.error("Login error:", error);
      toast({
        variant: "destructive",
        title: 'Login Gagal',
        description: 'Email atau password salah atau akun belum terdaftar.',
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
