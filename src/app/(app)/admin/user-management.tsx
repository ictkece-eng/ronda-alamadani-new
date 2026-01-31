'use client';

import { useState, useMemo, useEffect } from 'react';
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Pencil, Plus, Trash, Search } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Checkbox } from '@/components/ui/checkbox';


const wargaSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  email: z.string().email({ message: 'Invalid email address' }),
  phone: z.string().min(1, { message: 'Phone is required' }),
  address: z.string().min(1, { message: 'Address is required' }),
  role: z.enum(['user', 'coordinator', 'admin', 'backup']),
  includeInSchedule: z.boolean().optional(),
  isTeacher: z.boolean().optional(),
});

type WargaFormValues = z.infer<typeof wargaSchema>;

const ITEMS_PER_PAGE = 10;

export function UserManagement() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [canFetch, setCanFetch] = useState(false);

  useEffect(() => {
    // Only allow fetching if user is loaded and authenticated
    if (!isUserLoading && user) {
        setCanFetch(true);
    } else {
        setCanFetch(false);
    }
  }, [isUserLoading, user]);
  
  const usersCollection = useMemoFirebase(
    () => (firestore && canFetch ? collection(firestore, 'users') : null),
    [firestore, canFetch]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersCollection);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<Warga | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const isLoading = isUserLoading || isUsersLoading || !canFetch;

  const form = useForm<WargaFormValues>({
    resolver: zodResolver(wargaSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      address: '',
      role: 'user',
      includeInSchedule: false,
      isTeacher: false,
    },
  });

  const watchedRole = form.watch('role');

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter(user =>
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const handleAddNew = () => {
    setCurrentUser(null);
    form.reset({ name: '', email: '', phone: '', address: '', role: 'user', includeInSchedule: false, isTeacher: false });
    setIsDialogOpen(true);
  };

  const handleEdit = (user: Warga) => {
    setCurrentUser(user);
    form.reset(user);
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: WargaFormValues) => {
    if (!firestore || !user) return;

    const dataToSave = {
        ...values,
        includeInSchedule: values.role === 'backup' ? !!values.includeInSchedule : false,
        isTeacher: !!values.isTeacher,
    };
    
    try {
      if (currentUser) {
        // Update existing user
        const userRef = doc(firestore, 'users', currentUser.id);
        setDocumentNonBlocking(userRef, dataToSave, { merge: true });

        const adminRoleRef = doc(firestore, 'roles_admin', currentUser.id);
        if (values.role === 'admin') {
          // If role is admin, ensure the roles_admin doc exists
          setDocumentNonBlocking(adminRoleRef, { userId: currentUser.id }, { merge: true });
        } else if (currentUser.role === 'admin' && values.role !== 'admin') {
          // If role was admin and now it's not, delete the roles_admin doc
          deleteDocumentNonBlocking(adminRoleRef);
        }

        toast({ title: 'Success', description: 'User updated successfully.' });
      } else {
        // Create new user - this requires authentication to get a UID
        // For simplicity, let's assume we can't create users directly this way without auth logic
        // We will use a placeholder ID for now. In a real app, you'd create an auth user first.
        const usersCol = collection(firestore, 'users');
        const newUserRef = doc(usersCol); // Firestore generates an ID
        const newUserData: Warga = { ...dataToSave, id: newUserRef.id };
        setDocumentNonBlocking(newUserRef, newUserData, {});

        if (values.role === 'admin') {
            const adminRoleRef = doc(firestore, 'roles_admin', newUserRef.id);
            setDocumentNonBlocking(adminRoleRef, { userId: newUserRef.id }, {});
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
    const adminRoleRef = doc(firestore, 'roles_admin', userId);
    deleteDocumentNonBlocking(adminRoleRef); // Also remove from admin roles if they were an admin
    toast({ title: 'Success', description: 'User deleted successfully.' });
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Manage Users / Warga</CardTitle>
        <CardDescription>View, add, edit, or remove users from the system.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className='flex flex-col sm:flex-row justify-between items-center gap-2'>
            <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search users..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1); // Reset to first page on new search
                    }}
                />
            </div>
            <div className='flex gap-2 self-end'>
                <Button onClick={handleAddNew}>
                    <Plus className="mr-2" /> Add User
                </Button>
            </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className='hidden md:table-cell'>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Guru</TableHead>
                <TableHead>Include in Schedule</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell className='hidden md:table-cell'><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-6" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-8 w-[76px] ml-auto" /></TableCell>
                        </TableRow>
                    ))
                ) : paginatedUsers.length > 0 ? (
                paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className='hidden md:table-cell'>{user.email}</TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>
                        <div className='flex justify-center'>
                            <Checkbox
                                checked={!!user.isTeacher}
                                disabled
                            />
                        </div>
                    </TableCell>
                    <TableCell>
                        {user.role === 'backup' && (
                            <div className='flex justify-center'>
                                <Checkbox
                                    checked={!!user.includeInSchedule}
                                    disabled
                                />
                            </div>
                        )}
                    </TableCell>
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
                    <TableCell colSpan={7} className="text-center h-24">
                        {searchQuery ? "No users found for your search." : "No users found. Click 'Add User' to add initial data."}
                    </TableCell>
                </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
      </CardContent>
        {totalPages > 1 && (
            <CardFooter className='justify-between'>
                 <div className="text-xs text-muted-foreground">
                    Showing <strong>{paginatedUsers.length}</strong> of <strong>{filteredUsers.length}</strong> users
                </div>
                <Pagination>
                    <PaginationContent>
                        <PaginationItem>
                            <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.max(1, p - 1))}} className={currentPage === 1 ? 'pointer-events-none opacity-50' : ''} />
                        </PaginationItem>
                        
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                             <PaginationItem key={page}>
                                <PaginationLink href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(page)}} isActive={currentPage === page}>
                                    {page}
                                </PaginationLink>
                            </PaginationItem>
                        ))}
                       
                        <PaginationItem>
                            <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(p => Math.min(totalPages, p + 1))}} className={currentPage === totalPages ? 'pointer-events-none opacity-50' : ''} />
                        </PaginationItem>
                    </PaginationContent>
                </Pagination>
            </CardFooter>
        )}

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
                            <option value="backup">Backup</option>
                        </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {watchedRole === 'backup' && (
                <FormField
                    control={form.control}
                    name="includeInSchedule"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <FormLabel>Include in Schedule</FormLabel>
                                <FormDescription>
                                    If checked, this backup user will be included in schedule generation.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />
              )}

                <FormField
                    control={form.control}
                    name="isTeacher"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                            <div className="space-y-0.5">
                                <FormLabel>Guru</FormLabel>
                                <FormDescription>
                                    Jadwalkan pengguna ini pada hari Jumat atau Sabtu jika memungkinkan.
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
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
    </Card>
  );
}
