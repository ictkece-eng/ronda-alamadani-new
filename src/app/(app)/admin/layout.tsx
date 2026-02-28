'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();

  const [isAuthorized, setIsAuthorized] = React.useState(false);
  const [isVerifying, setIsVerifying] = React.useState(true);

  React.useEffect(() => {
    if (isUserLoading) return;

    if (!user) {
      router.replace('/dashboard');
      return;
    }

    if (!firestore) {
        setIsVerifying(true);
        return;
    }

    const checkStatus = async () => {
      try {
        // 1. Check Admin Collection
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        const adminSnap = await getDoc(adminRoleRef);
        
        if (adminSnap.exists()) {
          setIsAuthorized(true);
          setIsVerifying(false);
          return;
        }

        // 2. Check User Role in Profile by UID
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.role === 'admin' || userData.role === 'coordinator') {
            setIsAuthorized(true);
            setIsVerifying(false);
            return;
          }
        }

        // 3. Fallback: Check User Role by Email (to handle un-migrated profiles)
        if (user.email) {
            const usersRef = collection(firestore, 'users');
            const q = query(usersRef, where('email', '==', user.email));
            const querySnap = await getDocs(q);
            
            if (!querySnap.empty) {
                const userData = querySnap.docs[0].data();
                if (userData.role === 'admin' || userData.role === 'coordinator') {
                    setIsAuthorized(true);
                    setIsVerifying(false);
                    return;
                }
            }
        }

        // If all checks fail
        setIsAuthorized(false);
        toast({
            title: 'Akses Ditolak',
            description: 'Anda tidak memiliki hak akses untuk halaman ini.',
            variant: 'destructive',
        });
        router.replace('/dashboard');

      } catch (error) {
        console.error("Error verifying status:", error);
        setIsAuthorized(false);
        router.replace('/dashboard');
      } finally {
        setIsVerifying(false);
      }
    };

    checkStatus();
    
  }, [user, isUserLoading, firestore, router, toast]);

  if (isVerifying) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className='text-muted-foreground'>Memverifikasi hak akses...</p>
        </div>
      </div>
    );
  }

  if (isAuthorized) {
    return <>{children}</>;
  }

  return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
}
