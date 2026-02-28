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
import { Badge } from '@/components/ui/badge';
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
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const usersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersCollection);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<Warga | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const isLoading = isUserLoading || isUsersLoading;

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
      const matchesSearch = 
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.address.toLowerCase().includes(searchQuery.toLowerCase());

      let matchesCategory = true;
      if (activeFilter === 'active') matchesCategory = user.role === 'user' || user.role === 'coordinator';
      else if (activeFilter === 'backup') matchesCategory = user.role === 'backup';
      else if (activeFilter === 'admin') matchesCategory = user.role === 'admin';

      return matchesSearch && matchesCategory;
    });
  }, [users, searchQuery, activeFilter]);

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
    if (!firestore) return;
    const dataToSave = { ...values, id: currentUser?.id || doc(collection(firestore, 'users')).id };
    const userRef = doc(firestore, 'users', dataToSave.id);
    setDocumentNonBlocking(userRef, dataToSave, { merge: true });
    setIsDialogOpen(false);
    toast({ title: 'Success', description: 'User data saved.' });
  };

  const handleDelete = (userId: string) => {
    if (!firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'users', userId));
    toast({ title: 'Success', description: 'User deleted.' });
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <Card className={cn("cursor-pointer", activeFilter === 'all' && "ring-2 ring-primary")} onClick={() => setActiveFilter('all')}>
              <CardContent className="p-6 flex items-center justify-between">
                  <div><p className="text-xs font-bold text-muted-foreground">TOTAL</p><h3 className="text-3xl font-bold">{stats.total}</h3></div>
                  <Users className="h-6 w-6 text-primary" />
              </CardContent>
          </Card>
          <Card className={cn("cursor-pointer", activeFilter === 'active' && "ring-2 ring-primary")} onClick={() => setActiveFilter('active')}>
              <CardContent className="p-6 flex items-center justify-between">
                  <div><p className="text-xs font-bold text-muted-foreground">RONDA</p><h3 className="text-3xl font-bold">{stats.active}</h3></div>
                  <UserCheck className="h-6 w-6 text-green-600" />
              </CardContent>
          </Card>
          <Card className={cn("cursor-pointer", activeFilter === 'backup' && "ring-2 ring-primary")} onClick={() => setActiveFilter('backup')}>
              <CardContent className="p-6 flex items-center justify-between">
                  <div><p className="text-xs font-bold text-muted-foreground">BACKUP</p><h3 className="text-3xl font-bold">{stats.backups}</h3></div>
                  <LifeBuoy className="h-6 w-6 text-orange-600" />
              </CardContent>
          </Card>
          <Card className={cn("cursor-pointer", activeFilter === 'admin' && "ring-2 ring-primary")} onClick={() => setActiveFilter('admin')}>
              <CardContent className="p-6 flex items-center justify-between">
                  <div><p className="text-xs font-bold text-muted-foreground">ADMIN</p><h3 className="text-3xl font-bold">{stats.admins}</h3></div>
                  <ShieldCheck className="h-6 w-6 text-blue-600" />
              </CardContent>
          </Card>
      </div>

      <Card className="shadow-lg border-none">
        <CardHeader>
          <div className='flex justify-between items-center'>
            <CardTitle>Manage Users / Warga</CardTitle>
            <Button onClick={handleAddNew}><Plus className="mr-2 h-4 w-4" /> Add User</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input placeholder="Search users..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <div className="border rounded-lg overflow-hidden">
              <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                  {isLoading ? <TableRow><TableCell colSpan={3} className="text-center">Loading...</TableCell></TableRow> : paginatedUsers.map((user) => (
                      <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell><Badge variant="outline">{user.role}</Badge></TableCell>
                      <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)} className="text-destructive"><Trash className="h-4 w-4" /></Button>
                      </TableCell>
                      </TableRow>
                  ))}
              </TableBody>
              </Table>
          </div>
        </CardContent>
      </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>{currentUser ? 'Edit User' : 'Add User'}</DialogTitle></DialogHeader>
            <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (<FormItem><FormLabel>Name</FormLabel><Input {...field} /></FormItem>)} />
                <FormField control={form.control} name="email" render={({ field }) => (<FormItem><FormLabel>Email</FormLabel><Input {...field} /></FormItem>)} />
                <FormField control={form.control} name="role" render={({ field }) => (
                    <FormItem><FormLabel>Role</FormLabel><select {...field} className="w-full border p-2 rounded"><option value="user">User</option><option value="coordinator">Coordinator</option><option value="admin">Admin</option><option value="backup">Backup</option></select></FormItem>
                )} />
                <Button type="submit" className="w-full">Save</Button>
            </form></Form>
          </DialogContent>
        </Dialog>
    </div>
  );
}
