'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  setDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useUser,
} from '@/firebase';
import { collection, doc } from 'firebase/firestore';
import type { Warga } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
  } from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil, Plus, Trash } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const wargaSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  email: z.string().email({ message: 'Invalid email address' }),
  phone: z.string().min(1, { message: 'Phone is required' }),
  address: z.string().min(1, { message: 'Address is required' }),
  role: z.enum(['user', 'coordinator', 'admin']),
});

type WargaFormValues = z.infer<typeof wargaSchema>;

export function UserManagement() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  
  const usersCollection = useMemoFirebase(
    () => (firestore && user ? collection(firestore, 'users') : null),
    [firestore, user]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersCollection);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<Warga | null>(null);

  const isLoading = isUserLoading || isUsersLoading;

  const form = useForm<WargaFormValues>({
    resolver: zodResolver(wargaSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      role: 'user',
    },
  });

  const handleAddNew = () => {
    setCurrentUser(null);
    form.reset({ name: '', email: '', phone: '', address: '', role: 'user' });
    setIsDialogOpen(true);
  };

  const handleEdit = (user: Warga) => {
    setCurrentUser(user);
    form.reset(user);
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: WargaFormValues) => {
    if (!firestore) return;
    
    try {
      if (currentUser) {
        // Update existing user
        const userRef = doc(firestore, 'users', currentUser.id);
        setDocumentNonBlocking(userRef, values, { merge: true });

        const adminRoleRef = doc(firestore, 'roles_admin', currentUser.id);
        if (values.role === 'admin') {
          // If role is admin, ensure the roles_admin doc exists
          setDocumentNonBlocking(adminRoleRef, { role: 'admin' }, { merge: true });
        } else if (currentUser.role === 'admin' && values.role !== 'admin') {
          // If role was admin and now it's not, delete the roles_admin doc
          deleteDocumentNonBlocking(adminRoleRef);
        }

        toast({ title: 'Success', description: 'User updated successfully.' });
      } else {
        // Create new user
        const usersCol = collection(firestore, 'users');
        const newUserRef = doc(usersCol);
        const newUserData = { ...values, id: newUserRef.id };
        setDocumentNonBlocking(newUserRef, newUserData, {});

        if (values.role === 'admin') {
          const adminRoleRef = doc(firestore, 'roles_admin', newUserRef.id);
          setDocumentNonBlocking(adminRoleRef, { role: 'admin' }, {});
        }
        toast({ title: 'Success', description: 'User created successfully.' });
      }
      setIsDialogOpen(false);
      setCurrentUser(null);
    } catch (error) {
      console.error("Error saving user:", error);
      toast({ title: 'Error', description: 'Failed to save user.', variant: 'destructive' });
    }
  };

  const handleDelete = (userId: string) => {
    if (!firestore) return;
    const userRef = doc(firestore, 'users', userId);
    deleteDocumentNonBlocking(userRef);
    toast({ title: 'Success', description: 'User deleted successfully.' });
  };

  return (
    <div className="space-y-4">
        <div className='text-right'>
            <Button onClick={handleAddNew}>
                <Plus className="mr-2" /> Add User
            </Button>
        </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell className="text-right"><Skeleton className="h-8 w-[76px] ml-auto" /></TableCell>
                    </TableRow>
                ))
            ) : users && users.length > 0 ? (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>{user.address}</TableCell>
                  <TableCell>{user.role}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className='text-destructive hover:text-destructive'>
                            <Trash className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the user account.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(user.id)}>Continue</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24">
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{currentUser ? 'Edit User' : 'Add New User'}</DialogTitle>
            <DialogDescription>
              {currentUser ? 'Update the user details below.' : 'Fill in the details to create a new user.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="08123..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
               <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Input placeholder="Blok A1" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                        <select {...field} className='flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1'>
                            <option value="user">User</option>
                            <option value="coordinator">Coordinator</option>
                            <option value="admin">Admin</option>
                        </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={form.formState.isSubmitting}>
                      {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save
                    </Button>
                </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
