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
import { Loader2, Pencil, Plus, Trash, Search, Users, UserCheck, ShieldCheck, LifeBuoy, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';


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

type FilterType = 'all' | 'active' | 'backup' | 'admin';

export function UserManagement() {
  const firestore = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();
  const [canFetch, setCanFetch] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  useEffect(() => {
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

  const stats = useMemo(() => {
    if (!users) return { total: 0, active: 0, backups: 0, admins: 0 };
    return {
        total: users.length,
        active: users.filter(u => u.role === 'user' || u.role === 'coordinator').length,
        backups: users.filter(u => u.role === 'backup').length,
        admins: users.filter(u => u.role === 'admin').length,
    };
  }, [users]);

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
    
    return users.filter(user => {
      // 1. Text Search Filter
      const matchesSearch = 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.address.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Category Card Filter
      let matchesCategory = true;
      if (activeFilter === 'active') {
        matchesCategory = user.role === 'user' || user.role === 'coordinator';
      } else if (activeFilter === 'backup') {
        matchesCategory = user.role === 'backup';
      } else if (activeFilter === 'admin') {
        matchesCategory = user.role === 'admin';
      }

      return matchesSearch && matchesCategory;
    });
  }, [users, searchQuery, activeFilter]);

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
        const userRef = doc(firestore, 'users', currentUser.id);
        setDocumentNonBlocking(userRef, dataToSave, { merge: true });

        const adminRoleRef = doc(firestore, 'roles_admin', currentUser.id);
        if (values.role === 'admin') {
          setDocumentNonBlocking(adminRoleRef, { userId: currentUser.id }, { merge: true });
        } else if (currentUser.role === 'admin' && values.role !== 'admin') {
          deleteDocumentNonBlocking(adminRoleRef);
        }

        toast({ title: 'Success', description: 'User updated successfully.' });
      } else {
        const usersCol = collection(firestore, 'users');
        const newUserRef = doc(usersCol);
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
    deleteDocumentNonBlocking(adminRoleRef);
    toast({ title: 'Success', description: 'User deleted successfully.' });
  };

  const toggleFilter = (filter: FilterType) => {
    setActiveFilter(prev => {
        const next = prev === filter ? 'all' : filter;
        setCurrentPage(1); // Reset page on filter change
        return next;
    });
  };
  
  return (
    <div className="space-y-6">
      {/* Stat Cards as Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card 
            className={cn(
                "cursor-pointer transition-all hover:shadow-md border-primary/20",
                activeFilter === 'all' ? "bg-primary/10 ring-2 ring-primary" : "bg-primary/5 shadow-sm"
            )}
            onClick={() => toggleFilter('all')}
          >
              <CardContent className="p-4 flex items-center justify-between">
                  <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Warga</p>
                      <h3 className="text-2xl font-bold mt-1">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.total}</h3>
                  </div>
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
              </CardContent>
          </Card>

          <Card 
            className={cn(
                "cursor-pointer transition-all hover:shadow-md border-green-500/20",
                activeFilter === 'active' ? "bg-green-500/10 ring-2 ring-green-500" : "bg-green-500/5 shadow-sm"
            )}
            onClick={() => toggleFilter('active')}
          >
              <CardContent className="p-4 flex items-center justify-between">
                  <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">User Ronda</p>
                      <h3 className="text-2xl font-bold mt-1">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.active}</h3>
                  </div>
                  <div className="bg-green-500/10 p-2 rounded-lg">
                    <UserCheck className="h-5 w-5 text-green-600" />
                  </div>
              </CardContent>
          </Card>

          <Card 
            className={cn(
                "cursor-pointer transition-all hover:shadow-md border-orange-500/20",
                activeFilter === 'backup' ? "bg-orange-500/10 ring-2 ring-orange-500" : "bg-orange-500/5 shadow-sm"
            )}
            onClick={() => toggleFilter('backup')}
          >
              <CardContent className="p-4 flex items-center justify-between">
                  <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Backup</p>
                      <h3 className="text-2xl font-bold mt-1">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.backups}</h3>
                  </div>
                  <div className="bg-orange-500/10 p-2 rounded-lg">
                    <LifeBuoy className="h-5 w-5 text-orange-600" />
                  </div>
              </CardContent>
          </Card>

          <Card 
            className={cn(
                "cursor-pointer transition-all hover:shadow-md border-blue-500/20",
                activeFilter === 'admin' ? "bg-blue-500/10 ring-2 ring-blue-500" : "bg-blue-500/5 shadow-sm"
            )}
            onClick={() => toggleFilter('admin')}
          >
              <CardContent className="p-4 flex items-center justify-between">
                  <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Admin</p>
                      <h3 className="text-2xl font-bold mt-1">{isLoading ? <Skeleton className="h-8 w-12" /> : stats.admins}</h3>
                  </div>
                  <div className="bg-blue-500/10 p-2 rounded-lg">
                    <ShieldCheck className="h-5 w-5 text-blue-600" />
                  </div>
              </CardContent>
          </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
            <div>
              <CardTitle>Manage Users / Warga</CardTitle>
              <CardDescription>View, add, edit, or remove users from the system.</CardDescription>
            </div>
            {activeFilter !== 'all' && (
              <Badge variant="secondary" className="gap-1 px-3 py-1 bg-primary/20 text-primary hover:bg-primary/30 cursor-pointer" onClick={() => setActiveFilter('all')}>
                Filter: <span className="capitalize font-bold">{activeFilter}</span>
                <X className="h-3 w-3 ml-1" />
              </Badge>
            )}
          </div>
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
                          setCurrentPage(1);
                      }}
                  />
              </div>
              <div className='flex gap-2 self-end'>
                  <Button onClick={handleAddNew}>
                      <Plus className="mr-2 h-4 w-4" /> Add User
                  </Button>
              </div>
          </div>

          <div className="border rounded-lg overflow-hidden bg-background">
              <Table>
              <TableHeader>
                  <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className='hidden md:table-cell'>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">Guru</TableHead>
                  <TableHead className="text-center">Schedule</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
              </TableHeader>
              <TableBody>
                  {isLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                              <TableCell className='hidden md:table-cell'><Skeleton className="h-4 w-32" /></TableCell>
                              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                              <TableCell><Skeleton className="h-6 w-6 mx-auto" /></TableCell>
                              <TableCell><Skeleton className="h-6 w-6 mx-auto" /></TableCell>
                              <TableCell className="text-right"><Skeleton className="h-8 w-[76px] ml-auto" /></TableCell>
                          </TableRow>
                      ))
                  ) : paginatedUsers.length > 0 ? (
                  paginatedUsers.map((user) => (
                      <TableRow key={user.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell className='hidden md:table-cell text-muted-foreground'>{user.email}</TableCell>
                      <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                              user.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                              user.role === 'coordinator' ? 'bg-green-100 text-green-700' :
                              user.role === 'backup' ? 'bg-orange-100 text-orange-700' :
                              'bg-gray-100 text-gray-700'
                          }`}>
                            {user.role}
                          </span>
                      </TableCell>
                      <TableCell>
                          <div className='flex justify-center'>
                              <Checkbox
                                  checked={!!user.isTeacher}
                                  disabled
                              />
                          </div>
                      </TableCell>
                      <TableCell>
                          <div className='flex justify-center'>
                              <Checkbox
                                  checked={user.role === 'backup' ? !!user.includeInSchedule : true}
                                  disabled
                              />
                          </div>
                      </TableCell>
                      <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(user)} className="h-8 w-8">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                          <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className='h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10'>
                                  <Trash className="h-3.5 w-3.5" />
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
                      <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                          {searchQuery || activeFilter !== 'all' 
                            ? "No users found for your current filters." 
                            : "No users found. Click 'Add User' to add initial data."}
                      </TableCell>
                  </TableRow>
                  )}
              </TableBody>
              </Table>
          </div>
        </CardContent>
          {totalPages > 1 && (
              <CardFooter className='justify-between border-t p-6'>
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
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/20">
                              <div className="space-y-0.5">
                                  <FormLabel>Include in Schedule</FormLabel>
                                  <FormDescription className="text-[10px] leading-tight">
                                      If checked, this backup user will be included in automated schedule generation.
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
                          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/20">
                              <div className="space-y-0.5">
                                  <FormLabel>Guru</FormLabel>
                                  <FormDescription className="text-[10px] leading-tight">
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

                  <DialogFooter className="pt-4">
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
    </div>
  );
}
