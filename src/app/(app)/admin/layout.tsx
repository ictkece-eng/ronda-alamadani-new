'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
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
    // Don't do anything until we know who the user is.
    if (isUserLoading) {
      return;
    }

    // If there's no user after loading, they are not logged in. Redirect.
    if (!user) {
      router.replace('/dashboard');
      return;
    }

    // If Firebase isn't ready, wait.
    if (!firestore) {
        setIsVerifying(true);
        return;
    }

    const checkAdminStatus = async () => {
      try {
        const adminRoleRef = doc(firestore, 'roles_admin', user.uid);
        const docSnap = await getDoc(adminRoleRef);
        
        if (docSnap.exists()) {
          setIsAuthorized(true);
        } else {
          // User is logged in but doesn't have an admin role doc.
          setIsAuthorized(false);
          toast({
            title: 'Akses Ditolak',
            description: 'Anda tidak memiliki hak akses untuk halaman ini.',
            variant: 'destructive',
          });
          router.replace('/dashboard');
        }
      } catch (error) {
        console.error("Error verifying admin status:", error);
        setIsAuthorized(false);
        router.replace('/dashboard');
      } finally {
        setIsVerifying(false);
      }
    };

    checkAdminStatus();
    
  }, [user, isUserLoading, firestore, router, toast]);

  // While verifying, show a full-page loader.
  if (isVerifying) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className='ml-2'>Verifying access...</p>
      </div>
    );
  }

  // If verification is complete and user is authorized, show the admin content.
  if (isAuthorized) {
    return <>{children}</>;
  }

  // If not authorized after verification, show a loader while redirecting.
  return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
}
