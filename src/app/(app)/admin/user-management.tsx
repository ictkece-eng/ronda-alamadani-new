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
} from '@/components/ui/dialog';
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
import { Pencil, Plus, Trash, Users, UserCheck, ShieldCheck, LifeBuoy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';


const wargaSchema = z.object({
  name: z.string().min(1, { message: 'Name is required' }),
  email: z.string().email({ message: 'Invalid email address' }),
  phone: z.string().min(1, { message: 'Phone is required' }),
  address: z.string().min(1, { message: 'Address is required' }),
  role: z.enum(['user', 'coordinator', 'admin', 'backup']),
  includeInSchedule: z.boolean().default(false),
  isTeacher: z.boolean().default(false),
});

type WargaFormValues = z.infer<typeof wargaSchema>;

const ITEMS_PER_PAGE = 10;

type FilterType = 'all' | 'active' | 'backup' | 'admin';

export function UserManagement() {
  const firestore = useFirestore();
  const { user: authUser, isUserLoading } = useUser();
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
    form.reset({
        name: user.name,
        email: user.email,
        phone: user.phone,
        address: user.address,
        role: user.role,
        includeInSchedule: user.includeInSchedule || false,
        isTeacher: user.isTeacher || false,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = async (values: WargaFormValues) => {
    if (!firestore) return;
    const dataToSave = { 
        ...values, 
        id: currentUser?.id || doc(collection(firestore, 'users')).id,
        email: values.email.toLowerCase().trim()
    };
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
          <Card className={cn("cursor-pointer transition-all hover:scale-105", activeFilter === 'all' && "ring-2 ring-primary")} onClick={() => setActiveFilter('all')}>
              <CardContent className="p-6 flex items-center justify-between">
                  <div><p className="text-xs font-bold text-muted-foreground">TOTAL</p><h3 className="text-3xl font-bold">{stats.total}</h3></div>
                  <Users className="h-6 w-6 text-primary" />
              </CardContent>
          </Card>
          <Card className={cn("cursor-pointer transition-all hover:scale-105", activeFilter === 'active' && "ring-2 ring-primary")} onClick={() => setActiveFilter('active')}>
              <CardContent className="p-6 flex items-center justify-between">
                  <div><p className="text-xs font-bold text-muted-foreground">RONDA</p><h3 className="text-3xl font-bold">{stats.active}</h3></div>
                  <UserCheck className="h-6 w-6 text-green-600" />
              </CardContent>
          </Card>
          <Card className={cn("cursor-pointer transition-all hover:scale-105", activeFilter === 'backup' && "ring-2 ring-primary")} onClick={() => setActiveFilter('backup')}>
              <CardContent className="p-6 flex items-center justify-between">
                  <div><p className="text-xs font-bold text-muted-foreground">BACKUP</p><h3 className="text-3xl font-bold">{stats.backups}</h3></div>
                  <LifeBuoy className="h-6 w-6 text-orange-600" />
              </CardContent>
          </Card>
          <Card className={cn("cursor-pointer transition-all hover:scale-105", activeFilter === 'admin' && "ring-2 ring-primary")} onClick={() => setActiveFilter('admin')}>
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
          <Input placeholder="Search users by name, email, or address..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <div className="border rounded-lg overflow-hidden">
              <Table>
              <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                  {isLoading ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-10"><Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" /></TableCell></TableRow>
                  ) : paginatedUsers.length > 0 ? (
                      paginatedUsers.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                            <div>
                                <p>{user.name}</p>
                                <p className="text-xs text-muted-foreground">{user.email}</p>
                            </div>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col gap-1">
                                <Badge variant="outline" className="w-fit">{user.role}</Badge>
                                {user.role === 'backup' && user.includeInSchedule && <Badge variant="secondary" className="w-fit text-[10px]">Terjadwal</Badge>}
                                {user.isTeacher && <Badge className="w-fit text-[10px] bg-blue-100 text-blue-800 hover:bg-blue-100 border-none">Guru</Badge>}
                            </div>
                        </TableCell>
                        <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)} className="text-destructive"><Trash className="h-4 w-4" /></Button>
                            </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={3} className="text-center py-10">No users found.</TableCell></TableRow>
                  )}
              </TableBody>
              </Table>
          </div>
        </CardContent>
      </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
                <DialogTitle>{currentUser ? 'Edit Warga' : 'Tambah Warga Baru'}</DialogTitle>
                <DialogDescription>Isi detail informasi warga di bawah ini.</DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField control={form.control} name="name" render={({ field }) => (
                        <FormItem><FormLabel>Nama Lengkap</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="email" render={({ field }) => (
                        <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                    )} />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField control={form.control} name="phone" render={({ field }) => (
                            <FormItem><FormLabel>No HP</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="address" render={({ field }) => (
                            <FormItem><FormLabel>Blok Rumah</FormLabel><FormControl><Input {...field} placeholder="Contoh: I2" /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                    <FormField control={form.control} name="role" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Peran (Role)</FormLabel>
                            <FormControl>
                                <select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                    <option value="user">Warga Biasa</option>
                                    <option value="coordinator">Koordinator</option>
                                    <option value="backup">Backup / Pengganti</option>
                                    <option value="admin">Admin Sistem</option>
                                </select>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />

                    <div className="space-y-3 bg-muted/30 p-3 rounded-lg border">
                        <FormField control={form.control} name="isTeacher" render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                <div className="space-y-1 leading-none">
                                    <FormLabel>Status Guru</FormLabel>
                                    <FormDescription>Jika aktif, sistem akan memprioritaskan jadwal di akhir pekan.</FormDescription>
                                </div>
                            </FormItem>
                        )} />

                        {watchedRole === 'backup' && (
                            <FormField control={form.control} name="includeInSchedule" render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>Masukkan ke Jadwal Ronda</FormLabel>
                                        <FormDescription>Jika aktif, warga backup ini akan ikut diundi dalam jadwal bulanan.</FormDescription>
                                    </div>
                                </FormItem>
                            )} />
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="submit" className="w-full">Simpan Perubahan</Button>
                    </DialogFooter>
                </form>
            </Form>
          </DialogContent>
        </Dialog>
    </div>
  );
}
