'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const router = useRouter();
  const firestore = useFirestore();

  const adminRoleRef = useMemoFirebase(
    () => (user && firestore ? doc(firestore, 'roles_admin', user.uid) : null),
    [user, firestore]
  );

  const { data: adminRoleDoc, isLoading: isAdminRoleLoading } = useDoc(adminRoleRef);
  
  // This effect handles redirection.
  // It triggers whenever the loading states or the final admin document changes.
  React.useEffect(() => {
    const isFinishedChecking = !isUserLoading && !isAdminRoleLoading;
    // If all checks are done and we find out the user is not logged in or not an admin...
    if (isFinishedChecking && (!user || !adminRoleDoc)) {
      // ...redirect them away.
      router.replace('/dashboard');
    }
  }, [user, adminRoleDoc, isUserLoading, isAdminRoleLoading, router]);

  // Determine if we are still in a loading/verifying state.
  const isVerifying = isUserLoading || isAdminRoleLoading;

  // Show a loading spinner if we're still verifying, OR if the user is confirmed not to be an admin.
  // This prevents a brief flash of content before the redirect effect can run.
  if (isVerifying || !adminRoleDoc) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-muted/40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If we're past the loading checks AND we have an admin document, it's safe to render the admin content.
  return <>{children}</>;
}
