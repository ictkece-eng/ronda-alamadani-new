'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  // Create a memoized reference to the user's admin role document.
  const adminRoleRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, 'roles_admin', user.uid) : null),
    [firestore, user]
  );

  // useDoc will fetch the document and give us its state.
  const { data: adminRole, isLoading: isAdminRoleLoading } = useDoc(adminRoleRef);

  const isVerifying = isUserLoading || (user && isAdminRoleLoading);

  // An authorized admin is one who is logged in, and for whom the admin role document exists.
  const isAuthorized = !isVerifying && !!user && !!adminRole;

  React.useEffect(() => {
    // Wait until all loading is complete.
    if (isVerifying) {
      return;
    }

    // If, after loading, the user is not authorized, redirect them.
    if (!isAuthorized) {
      router.replace('/dashboard');
    }
  }, [isAuthorized, isVerifying, router]);

  // While verifying, or if not authorized, show a loader.
  if (!isAuthorized) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Only when authorized, render the admin content.
  return <>{children}</>;
}
