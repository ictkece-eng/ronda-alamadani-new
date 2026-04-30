'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useCollection,
  useFirestore,
  useMemoFirebase,
  updateDocumentNonBlocking,
  setDocumentNonBlocking,
  deleteDocumentNonBlocking,
  useUser,
} from '@/firebase';
import { collection, collectionGroup, doc, query } from 'firebase/firestore';
import type { ScheduleRequest, Warga } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { ThumbsDown, ThumbsUp, Plus, Search, Loader2, Trash2, RotateCcw, Pencil } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
} from "@/components/ui/alert-dialog";

const requestSchema = z.object({
  userId: z.string().min(1, 'Pilih warga'),
  requestedDate: z.string().min(1, 'Pilih tanggal'),
  reason: z.string().min(1, 'Alasan wajib diisi'),
});
type RequestFormValues = z.infer<typeof requestSchema>;

export function ScheduleRequests() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const requestsQuery = useMemoFirebase(
    () => (firestore && user ? query(collectionGroup(firestore, 'scheduleRequests')) : null),
    [firestore, user]
  );
  const { data: requests, isLoading: isRequestsLoading } = useCollection<ScheduleRequest>(requestsQuery);
  
  const usersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'users') : null), [firestore]);
  const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersQuery);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ScheduleRequest | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
    const [userPickerQuery, setUserPickerQuery] = useState('');

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { userId: '', requestedDate: '', reason: '' },
  });

        const selectedUserId = form.watch('userId');
        const selectedRequestedDate = form.watch('requestedDate');

  const usersMap = useMemo(() => {
      const map = new Map();
      if (users) {
          users.forEach(u => map.set(u.id, u.name || 'Tanpa Nama'));
      }
      return map;
  }, [users]);
  
  const sortedUsersForDropdown = useMemo(() => {
      if (!users) return [];
      return [...users].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [users]);

  const filteredUsersForPicker = useMemo(() => {
      const normalizedQuery = userPickerQuery.trim().toLowerCase();
      if (!normalizedQuery) return sortedUsersForDropdown.slice(0, 12);

      return sortedUsersForDropdown.filter((user) => {
          const haystack = `${user.name || ''} ${user.phone || ''} ${user.address || ''}`.toLowerCase();
          return haystack.includes(normalizedQuery);
      }).slice(0, 20);
  }, [sortedUsersForDropdown, userPickerQuery]);

  const selectedUser = useMemo(() => {
      if (!users || !selectedUserId) return null;
      return users.find((item) => item.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  const getRequestedDateKey = (dateValue?: string) => {
      if (!dateValue) return '';
      return dateValue.slice(0, 10);
  };

  const getRequestsForSameDate = (dateValue: string, excludedRequest?: ScheduleRequest | null) => {
      const requestedDateKey = getRequestedDateKey(dateValue);

      if (!requestedDateKey || !requests) {
          return [] as ScheduleRequest[];
      }

      return requests.filter((request) => {
          const isExcludedRequest = excludedRequest
              ? request.id === excludedRequest.id && request.userId === excludedRequest.userId
              : false;

          return !isExcludedRequest && getRequestedDateKey(request.requestedScheduleDate) === requestedDateKey;
      });
  };

  const selectedDateRequestInfo = useMemo(() => {
      const sameDateRequests = getRequestsForSameDate(selectedRequestedDate, editingRequest);
      const names = Array.from(
          new Set(
              sameDateRequests.map((request) => usersMap.get(request.userId) || 'Tanpa Nama')
          )
      );

      return {
          count: sameDateRequests.length,
          names,
          isFull: sameDateRequests.length >= 3,
      };
  }, [selectedRequestedDate, editingRequest, requests, usersMap]);

  const processedRequests = useMemo(() => {
    if (!requests) return [];
    return requests.map(req => ({ ...req, userName: usersMap.get(req.userId) || 'Unknown' }))
      .filter(req => (req.userName || '').toLowerCase().includes(searchQuery.toLowerCase()))
      .sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }, [requests, usersMap, searchQuery]);

  const handleUpdateStatus = (request: ScheduleRequest, status: 'approved' | 'rejected' | 'pending') => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'users', request.userId, 'scheduleRequests', request.id);
    updateDocumentNonBlocking(requestRef, { status });
    toast({ 
      title: 'Status Diperbarui', 
      description: `Permintaan dari ${usersMap.get(request.userId)} kini berstatus ${status}.` 
    });
  };

  const handleEditClick = (req: ScheduleRequest) => {
    setEditingRequest(req);
        setUserPickerQuery('');
    form.reset({
        userId: req.userId,
        requestedDate: format(new Date(req.requestedScheduleDate), 'yyyy-MM-dd'),
        reason: req.reason,
    });
    setIsFormDialogOpen(true);
  };

  const handleDeleteRequest = (request: ScheduleRequest) => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'users', request.userId, 'scheduleRequests', request.id);
    deleteDocumentNonBlocking(requestRef);
    toast({ 
      title: 'Dihapus', 
      description: `Permintaan dari ${usersMap.get(request.userId)} telah dihapus dari sistem.` 
    });
  };

  const onSubmit = async (values: RequestFormValues) => {
    if (!firestore) return;

    const sameDateRequests = getRequestsForSameDate(values.requestedDate, editingRequest);
    if (sameDateRequests.length >= 3) {
        const requesterNames = Array.from(
            new Set(sameDateRequests.map((request) => usersMap.get(request.userId) || 'Tanpa Nama'))
        );
        const formattedDate = format(new Date(values.requestedDate), 'PPP', { locale: idLocale });
        const conflictMessage = `Pada tanggal ${formattedDate} sudah ada ${sameDateRequests.length} permintaan dari ${requesterNames.join(', ')}.`;

        form.setError('requestedDate', {
            type: 'manual',
            message: `${conflictMessage} Silakan pilih tanggal lain.`,
        });
        toast({
            title: 'Tanggal Sudah Penuh',
            description: `${conflictMessage} Silakan pilih tanggal lain.`,
            variant: 'destructive',
        });
        return;
    }

    form.clearErrors('requestedDate');

    try {
        if (editingRequest) {
            const requestRef = doc(firestore, 'users', editingRequest.userId, 'scheduleRequests', editingRequest.id);
            updateDocumentNonBlocking(requestRef, {
                requestedScheduleDate: new Date(values.requestedDate).toISOString(),
                reason: values.reason,
            });
            toast({ title: 'Berhasil', description: 'Permintaan jadwal diperbarui.' });
        } else {
            const requestsCol = collection(firestore, 'users', values.userId, 'scheduleRequests');
            const newDocRef = doc(requestsCol);
            
            const dataToSave: ScheduleRequest = {
                id: newDocRef.id,
                userId: values.userId,
                requestDate: new Date().toISOString(),
                requestedScheduleDate: new Date(values.requestedDate).toISOString(),
                reason: values.reason,
                status: 'pending',
            };

            setDocumentNonBlocking(newDocRef, dataToSave, { merge: true });
            toast({ title: 'Berhasil', description: 'Permintaan jadwal berhasil ditambahkan.' });
        }
        
        setIsFormDialogOpen(false);
        setEditingRequest(null);
        form.reset();
    } catch (e) {
        toast({ title: 'Error', description: 'Gagal memproses permintaan.', variant: 'destructive' });
    }
  };

  return (
    <Card className="shadow-sm border-0 app-surface">
      <CardHeader className="flex flex-row justify-between items-center">
        <div className="space-y-1">
            <CardTitle>Schedule Change Requests</CardTitle>
            <p className="text-sm text-muted-foreground">Kelola permintaan perubahan jadwal ronda dari warga.</p>
        </div>
        <Button onClick={() => { setEditingRequest(null); setUserPickerQuery(''); form.reset({ userId: '', requestedDate: '', reason: '' }); setIsFormDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New Request
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="position-relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Cari berdasarkan nama warga..." 
                className="pl-8 rounded-pill"
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
            />
        </div>

        <div className="rounded-4 overflow-hidden bg-white border shadow-sm">
            <Table>
            <TableHeader className="bg-body-tertiary">
                <TableRow>
                    <TableHead>Warga</TableHead>
                    <TableHead>Tanggal Diminta</TableHead>
                    <TableHead>Alasan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi Admin</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isRequestsLoading || isUsersLoading ? (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center py-10">
                            <Loader2 className="animate-spin h-6 w-6 mx-auto text-primary" />
                            <p className="mt-2 text-sm text-muted-foreground">Memuat data...</p>
                        </TableCell>
                    </TableRow>
                ) : processedRequests.length > 0 ? (
                    processedRequests.map((req) => (
                        <TableRow key={req.id} className="hover:bg-muted/30">
                            <TableCell className="font-semibold">{req.userName}</TableCell>
                            <TableCell>{format(new Date(req.requestedScheduleDate), 'PPP', { locale: idLocale })}</TableCell>
                            <TableCell className="max-w-[200px] truncate">{req.reason}</TableCell>
                            <TableCell>
                                <Badge variant={req.status === 'pending' ? 'secondary' : req.status === 'approved' ? 'default' : 'destructive'}
                                    className={req.status === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}
                                >
                                    {req.status.toUpperCase()}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                    <Button 
                                        size="sm" 
                                        variant="ghost" 
                                        className="h-8 w-8 p-0"
                                        onClick={() => handleEditClick(req)}
                                        title="Edit Pengajuan"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>

                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        disabled={req.status === 'approved'}
                                        className="border-green-600 text-green-600 hover:bg-green-50 h-8 w-8 p-0"
                                        onClick={() => handleUpdateStatus(req, 'approved')}
                                        title="Approve"
                                    >
                                        <ThumbsUp className="h-4 w-4" />
                                    </Button>

                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        disabled={req.status === 'rejected'}
                                        className="border-destructive text-destructive hover:bg-destructive/5 h-8 w-8 p-0"
                                        onClick={() => handleUpdateStatus(req, 'rejected')}
                                        title="Reject"
                                    >
                                        <ThumbsDown className="h-4 w-4" />
                                    </Button>

                                    {req.status !== 'pending' && (
                                        <Button 
                                            size="sm" 
                                            variant="ghost" 
                                            className="h-8 w-8 p-0"
                                            onClick={() => handleUpdateStatus(req, 'pending')}
                                            title="Reset to Pending"
                                        >
                                            <RotateCcw className="h-4 w-4" />
                                        </Button>
                                    )}

                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="text-muted-foreground hover:text-destructive h-8 w-8 p-0"
                                                title="Hapus Pengajuan"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Hapus Pengajuan?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    Tindakan ini akan menghapus data pengajuan dari {req.userName} secara permanen.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Batal</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteRequest(req)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                                    Ya, Hapus
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                ) : (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center py-20 text-muted-foreground italic">
                            Belum ada permintaan jadwal.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
      </CardContent>

      <Dialog open={isFormDialogOpen} onOpenChange={(open) => { setIsFormDialogOpen(open); if(!open) { setEditingRequest(null); setUserPickerQuery(''); } }}>
          <DialogContent className="max-w-md">
              <DialogHeader>
                  <DialogTitle>{editingRequest ? 'Edit Permintaan' : 'Buat Permintaan Baru'}</DialogTitle>
                  <DialogDescription>
                      {editingRequest ? 'Perbarui detail permintaan jadwal warga.' : 'Input permintaan perubahan jadwal secara manual oleh admin.'}
                  </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField control={form.control} name="userId" render={({ field }) => (
                          <FormItem className="space-y-3">
                              <FormLabel>Pilih Warga</FormLabel>
                              {!editingRequest && (
                                <div className="position-relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        value={userPickerQuery}
                                        onChange={(event) => setUserPickerQuery(event.target.value)}
                                        placeholder="Ketik nama atau no HP warga..."
                                        className="ps-5 rounded-pill"
                                    />
                                </div>
                              )}

                              <FormControl>
                                  <input type="hidden" {...field} value={field.value} />
                              </FormControl>

                              <div className="rounded-4 border bg-body-tertiary-subtle p-2">
                                  {editingRequest ? (
                                      <div className="rounded-4 border bg-white p-3 shadow-sm">
                                          <div className="fw-semibold text-body">{selectedUser?.name || 'Tanpa Nama'}</div>
                                          <div className="small text-muted">No HP: {selectedUser?.phone || '-'}</div>
                                          <div className="small text-muted">Alamat: {selectedUser?.address || '-'}</div>
                                      </div>
                                  ) : filteredUsersForPicker.length > 0 ? (
                                      <div className="d-flex flex-column gap-2" style={{ maxHeight: '260px', overflowY: 'auto' }}>
                                          {filteredUsersForPicker.map((warga) => {
                                              const isActive = field.value === warga.id;
                                              return (
                                                  <button
                                                      key={warga.id}
                                                      type="button"
                                                      onClick={() => field.onChange(warga.id)}
                                                      className={cn(
                                                          "text-start rounded-4 border p-3 transition-all bg-white",
                                                          isActive
                                                              ? "border-primary bg-primary bg-opacity-10 shadow-sm"
                                                              : "border-light-subtle hover:border-primary-subtle hover:bg-white"
                                                      )}
                                                  >
                                                      <div className="d-flex align-items-center justify-content-between gap-3">
                                                          <div>
                                                              <div className="fw-semibold text-body">{warga.name || 'Tanpa Nama'}</div>
                                                              <div className="small text-muted">{warga.address || '-'}</div>
                                                          </div>
                                                          <div className="small fw-medium text-primary">{warga.phone || '-'}</div>
                                                      </div>
                                                  </button>
                                              );
                                          })}
                                      </div>
                                  ) : (
                                      <div className="text-center text-muted py-3 small">
                                          Tidak ada warga yang cocok dengan nama / no HP yang Anda ketik.
                                      </div>
                                  )}
                              </div>

                              {selectedUser && (
                                  <div className="rounded-4 border border-primary-subtle bg-primary bg-opacity-10 p-3">
                                      <div className="small text-muted mb-1">Warga terpilih</div>
                                      <div className="fw-semibold text-body">{selectedUser.name || 'Tanpa Nama'}</div>
                                      <div className="small text-muted">No HP: {selectedUser.phone || '-'} • Alamat: {selectedUser.address || '-'}</div>
                                  </div>
                              )}

                              {editingRequest && <p className="text-[10px] text-muted-foreground">Nama warga tidak dapat diubah saat edit.</p>}
                              <FormMessage />
                          </FormItem>
                      )} />
                      <FormField control={form.control} name="requestedDate" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Tanggal Yang Diminta</FormLabel>
                              <FormControl>
                                  <Input
                                      type="date"
                                      {...field}
                                      onChange={(event) => {
                                          field.onChange(event);
                                          form.clearErrors('requestedDate');
                                      }}
                                  />
                              </FormControl>
                              {selectedRequestedDate && selectedDateRequestInfo.count > 0 && (
                                  <div className={cn(
                                      'rounded-4 border p-3 text-sm',
                                      selectedDateRequestInfo.isFull
                                          ? 'border-destructive/30 bg-destructive/5 text-destructive'
                                          : 'border-border bg-muted/40 text-muted-foreground'
                                  )}>
                                      <div className="fw-semibold">
                                          {selectedDateRequestInfo.isFull
                                              ? 'Tanggal ini sudah penuh untuk pengajuan baru.'
                                              : `Tanggal ini sudah memiliki ${selectedDateRequestInfo.count} pengajuan.`}
                                      </div>
                                      <div>
                                          Nama yang sudah request: {selectedDateRequestInfo.names.join(', ')}
                                      </div>
                                  </div>
                              )}
                              <FormMessage />
                          </FormItem>
                      )} />
                      <FormField control={form.control} name="reason" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Alasan Perubahan</FormLabel>
                              <FormControl><Textarea placeholder="Contoh: Ada urusan keluarga" {...field} /></FormControl>
                              <FormMessage />
                          </FormItem>
                      )} />
                      <DialogFooter>
                          <Button type="submit" className="w-full">
                              {editingRequest ? 'Simpan Perubahan' : 'Kirim Permintaan'}
                          </Button>
                      </DialogFooter>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>
    </Card>
  );
}
