'use client';

import { useEffect, useMemo, useState } from 'react';
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
  FormField,
  FormItem,
  FormLabel,
  FormDescription as FormDesc,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import {
  Pencil,
  Plus,
  Trash,
  Users,
  UserCheck,
  ShieldCheck,
  LifeBuoy,
  Loader2,
  Search,
  Mail,
  MapPin,
  Phone,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
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

const filterConfig: Record<
  FilterType,
  { label: string; helper: string; icon: React.ElementType; color: string }
> = {
  all: {
    label: 'Total Warga',
    helper: 'Semua data warga yang tersimpan',
    icon: Users,
    color: 'text-primary',
  },
  active: {
    label: 'Peserta Ronda',
    helper: 'Warga aktif di jadwal ronda',
    icon: UserCheck,
    color: 'text-success',
  },
  backup: {
    label: 'Backup',
    helper: 'Pengganti yang siap ditugaskan',
    icon: LifeBuoy,
    color: 'text-warning',
  },
  admin: {
    label: 'Admin',
    helper: 'Pengelola aplikasi ronda',
    icon: ShieldCheck,
    color: 'text-info',
  },
};

const roleBadgeClass: Record<Warga['role'], string> = {
  user: 'bg-primary-subtle text-primary-emphasis border-0',
  coordinator: 'bg-success-subtle text-success-emphasis border-0',
  admin: 'bg-info-subtle text-info-emphasis border-0',
  backup: 'bg-warning-subtle text-warning-emphasis border-0',
};

export function UserManagement() {
  const firestore = useFirestore();
  const { isUserLoading } = useUser();
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
      active: users.filter(
        (u) =>
          u.role === 'user' ||
          u.role === 'coordinator' ||
          (u.role === 'backup' && u.includeInSchedule === true)
      ).length,
      backups: users.filter((u) => u.role === 'backup').length,
      admins: users.filter((u) => u.role === 'admin').length,
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
    const query = searchQuery.toLowerCase();
    return users.filter((user) => {
      const name = (user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const address = (user.address || '').toLowerCase();
      const phone = (user.phone || '').toLowerCase();

      const matchesSearch =
        name.includes(query) ||
        email.includes(query) ||
        address.includes(query) ||
        phone.includes(query);

      let matchesCategory = true;
      if (activeFilter === 'active') {
        matchesCategory =
          user.role === 'user' ||
          user.role === 'coordinator' ||
          (user.role === 'backup' && user.includeInSchedule === true);
      } else if (activeFilter === 'backup') {
        matchesCategory = user.role === 'backup';
      } else if (activeFilter === 'admin') {
        matchesCategory = user.role === 'admin';
      }

      return matchesSearch && matchesCategory;
    });
  }, [users, searchQuery, activeFilter]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredUsers, currentPage]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE)),
    [filteredUsers.length]
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeFilter]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleAddNew = () => {
    setCurrentUser(null);
    form.reset({
      name: '',
      email: '',
      phone: '',
      address: '',
      role: 'user',
      includeInSchedule: false,
      isTeacher: false,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (user: Warga) => {
    setCurrentUser(user);
    form.reset({
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      address: user.address || '',
      role: user.role || 'user',
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
      email: values.email.toLowerCase().trim(),
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

  const activeFilterMeta = filterConfig[activeFilter];

  return (
    <div className="space-y-6">
      <Card className="border-0 overflow-hidden app-surface shadow-sm">
        <CardContent className="p-4 p-lg-5">
          <div className="row g-4 align-items-center">
            <div className="col-12 col-xl-8">
              <div className="d-flex align-items-start gap-3">
                <div className="rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-10 p-3 text-primary">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-uppercase small fw-semibold text-primary mb-1">Admin Panel</p>
                  <h2 className="h3 fw-bold mb-2 text-body-emphasis">Kelola User / Warga</h2>
                  <p className="text-muted mb-0">
                    Tampilan dibuat lebih elegan dengan nuansa Bootstrap modern, sementara semua fungsi tambah, edit, hapus, filter, dan penyimpanan warga tetap sama.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-12 col-xl-4">
              <div className="rounded-4 border bg-white p-3 shadow-sm">
                <div className="small text-muted mb-1">Filter aktif</div>
                <div className="d-flex align-items-center gap-2 mb-1">
                  <activeFilterMeta.icon className={cn('h-4 w-4', activeFilterMeta.color)} />
                  <span className="fw-semibold">{activeFilterMeta.label}</span>
                </div>
                <div className="small text-muted">{activeFilterMeta.helper}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="row g-4">
        <div className="col-12 col-md-6 col-xl-3">
          <Card
            className={cn(
              'h-100 cursor-pointer border-0 shadow-sm app-surface transition-all',
              activeFilter === 'all' && 'ring-2 ring-primary'
            )}
            onClick={() => setActiveFilter('all')}
          >
            <CardContent className="p-4 d-flex align-items-center justify-content-between gap-3">
              <div>
                <div className="small text-uppercase fw-semibold text-muted mb-1">Total</div>
                <div className="display-6 fw-bold mb-1">{stats.total}</div>
                <div className="small text-muted">Seluruh warga terdaftar</div>
              </div>
              <div className="rounded-circle bg-primary bg-opacity-10 p-3 text-primary">
                <Users className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <Card
            className={cn(
              'h-100 cursor-pointer border-0 shadow-sm app-surface transition-all',
              activeFilter === 'active' && 'ring-2 ring-primary'
            )}
            onClick={() => setActiveFilter('active')}
          >
            <CardContent className="p-4 d-flex align-items-center justify-content-between gap-3">
              <div>
                <div className="small text-uppercase fw-semibold text-muted mb-1">Ronda</div>
                <div className="display-6 fw-bold mb-1">{stats.active}</div>
                <div className="small text-muted">Aktif masuk jadwal</div>
              </div>
              <div className="rounded-circle bg-success bg-opacity-10 p-3 text-success">
                <UserCheck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <Card
            className={cn(
              'h-100 cursor-pointer border-0 shadow-sm app-surface transition-all',
              activeFilter === 'backup' && 'ring-2 ring-primary'
            )}
            onClick={() => setActiveFilter('backup')}
          >
            <CardContent className="p-4 d-flex align-items-center justify-content-between gap-3">
              <div>
                <div className="small text-uppercase fw-semibold text-muted mb-1">Backup</div>
                <div className="display-6 fw-bold mb-1">{stats.backups}</div>
                <div className="small text-muted">Pengganti ronda</div>
              </div>
              <div className="rounded-circle bg-warning bg-opacity-10 p-3 text-warning">
                <LifeBuoy className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <Card
            className={cn(
              'h-100 cursor-pointer border-0 shadow-sm app-surface transition-all',
              activeFilter === 'admin' && 'ring-2 ring-primary'
            )}
            onClick={() => setActiveFilter('admin')}
          >
            <CardContent className="p-4 d-flex align-items-center justify-content-between gap-3">
              <div>
                <div className="small text-uppercase fw-semibold text-muted mb-1">Admin</div>
                <div className="display-6 fw-bold mb-1">{stats.admins}</div>
                <div className="small text-muted">Akses pengelola</div>
              </div>
              <div className="rounded-circle bg-info bg-opacity-10 p-3 text-info">
                <ShieldCheck className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="shadow-sm border-0 app-surface overflow-hidden">
        <CardHeader className="border-0 pb-3">
          <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3">
            <div>
              <CardTitle className="mb-1">Manage Users / Warga</CardTitle>
              <p className="text-muted mb-0 small">
                Pantau, cari, dan atur data warga dengan tampilan yang lebih rapi, modern, dan enak dipindai.
              </p>
            </div>
            <Button onClick={handleAddNew}>
              <Plus className="mr-2 h-4 w-4" /> Add User
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="row g-3 align-items-center">
            <div className="col-12 col-lg-7">
              <div className="position-relative">
                <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users by name, email, phone, or address..."
                  className="ps-5 rounded-pill"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="col-12 col-lg-5">
              <div className="d-flex flex-wrap gap-2 justify-content-lg-end">
                {(Object.keys(filterConfig) as FilterType[]).map((filterKey) => (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setActiveFilter(filterKey)}
                    className={cn(
                      'btn rounded-pill px-3 py-2 fw-semibold',
                      activeFilter === filterKey ? 'btn-primary' : 'btn-outline-secondary'
                    )}
                  >
                    {filterConfig[filterKey].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-4 border overflow-hidden bg-white shadow-sm">
            <Table>
              <TableHeader className="bg-body-tertiary">
                <TableRow>
                  <TableHead>Warga</TableHead>
                  <TableHead>Kontak</TableHead>
                  <TableHead>Blok / Lokasi</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                    </TableCell>
                  </TableRow>
                ) : paginatedUsers.length > 0 ? (
                  paginatedUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="d-flex align-items-center gap-3">
                          <div
                            className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center fw-bold"
                            style={{ width: '2.75rem', height: '2.75rem' }}
                          >
                            {(user.name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="fw-semibold mb-0">{user.name || 'No Name'}</p>
                            <p className="text-xs text-muted-foreground mb-0 d-flex align-items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {user.email || 'No Email'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="d-flex flex-column gap-1">
                          <span className="small d-flex align-items-center gap-1 text-body">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {user.phone || '-'}
                          </span>
                          <span className="small text-muted">ID: {user.id}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="small d-flex align-items-center gap-1 text-body">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          {user.address || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="d-flex flex-column gap-1 align-items-start">
                          <Badge variant="outline" className={cn('w-fit text-capitalize', roleBadgeClass[user.role])}>
                            {user.role}
                          </Badge>
                          {user.role === 'backup' && user.includeInSchedule && (
                            <Badge variant="secondary" className="w-fit text-[10px]">
                              Terjadwal
                            </Badge>
                          )}
                          {user.isTeacher && (
                            <Badge className="w-fit text-[10px] bg-info-subtle text-info-emphasis hover:bg-info-subtle border-0">
                              Guru
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="d-flex justify-content-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(user)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)} className="text-destructive">
                            <Trash className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10">
                      No users found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 pt-2">
            <div className="small text-muted">
              Menampilkan <span className="fw-semibold text-body">{paginatedUsers.length}</span> dari <span className="fw-semibold text-body">{filteredUsers.length}</span> warga
            </div>
            <div className="d-flex align-items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <span className="small fw-semibold text-muted px-2">Page {currentPage} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage >= totalPages}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl border-0 shadow-lg app-surface">
          <DialogHeader>
            <DialogTitle>{currentUser ? 'Edit Warga' : 'Tambah Warga Baru'}</DialogTitle>
            <DialogDescription>Isi detail informasi warga di bawah ini.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="row g-4">
                <div className="col-12 col-lg-7">
                  <div className="rounded-4 border bg-white p-4 shadow-sm h-100">
                    <div className="small text-uppercase fw-semibold text-muted mb-3">Data Utama</div>
                    <div className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nama Lengkap</FormLabel>
                            <FormControl>
                              <Input {...field} />
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
                              <Input type="email" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="row g-3">
                        <div className="col-12 col-md-6">
                          <FormField
                            control={form.control}
                            name="phone"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>No HP</FormLabel>
                                <FormControl>
                                  <Input {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        <div className="col-12 col-md-6">
                          <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Blok Rumah</FormLabel>
                                <FormControl>
                                  <Input {...field} placeholder="Contoh: I2" />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="col-12 col-lg-5">
                  <div className="rounded-4 border bg-white p-4 shadow-sm h-100 space-y-4">
                    <div className="small text-uppercase fw-semibold text-muted">Akses & Pengaturan</div>

                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Peran (Role)</FormLabel>
                          <FormControl>
                            <select {...field} className="form-select h-10 rounded-3">
                              <option value="user">Warga Biasa</option>
                              <option value="coordinator">Koordinator</option>
                              <option value="backup">Backup / Pengganti</option>
                              <option value="admin">Admin Sistem</option>
                            </select>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-3 bg-body-tertiary p-3 rounded-4 border">
                      <FormField
                        control={form.control}
                        name="isTeacher"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Status Guru</FormLabel>
                              <FormDesc>Jika aktif, sistem akan memprioritaskan jadwal di akhir pekan.</FormDesc>
                            </div>
                          </FormItem>
                        )}
                      />

                      {watchedRole === 'backup' && (
                        <FormField
                          control={form.control}
                          name="includeInSchedule"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>Masukkan ke Jadwal Ronda</FormLabel>
                                <FormDesc>Jika aktif, warga backup ini akan ikut diundi dalam jadwal bulanan.</FormDesc>
                              </div>
                            </FormItem>
                          )}
                        />
                      )}
                    </div>
                  </div>
                </div>
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
