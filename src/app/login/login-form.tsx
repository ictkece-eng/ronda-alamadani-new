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
import { doc, getDoc, setDoc, collection, query, where, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';


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
      
      if (!userEmail) throw new Error("Email not found");

      // 1. Handle Special Super Admin Email
      if (userEmail === 'tirtopbas@gmail.com') {
        const adminRoleRef = doc(firestore, 'roles_admin', uid);
        await setDoc(adminRoleRef, { userId: uid }, { merge: true });
        
        toast({ title: 'Login Admin Berhasil', description: 'Selamat datang, Super Admin.' });
        router.push('/admin');
        onLoginSuccess?.();
        return;
      }

      // 2. Lookup and CLEANUP/MIGRATE User Data by Email to prevent duplicates
      const usersRef = collection(firestore, 'users');
      const q = query(usersRef, where('email', '==', userEmail));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const batch = writeBatch(firestore);
        let primaryUserData = querySnap.docs[0].data();
        let role = primaryUserData.role || 'user';

        // Delete ALL existing documents with this email that are NOT the new UID
        querySnap.docs.forEach(userDoc => {
            if (userDoc.id !== uid) {
                batch.delete(doc(firestore, 'users', userDoc.id));
            }
        });

        // Set/Update the document with ID = UID
        const targetRef = doc(firestore, 'users', uid);
        batch.set(targetRef, { ...primaryUserData, id: uid, email: userEmail }, { merge: true });
        
        await batch.commit();

        if (role === 'admin' || role === 'coordinator') {
          toast({ title: 'Login Berhasil', description: `Selamat datang, ${role}.` });
          router.push('/admin');
        } else {
          toast({ title: 'Login Berhasil', description: 'Mengarahkan ke dashboard warga.' });
          router.push('/dashboard');
        }
      } else {
        toast({ title: 'Login Berhasil', description: 'Profil Anda belum terdaftar di sistem warga.' });
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
