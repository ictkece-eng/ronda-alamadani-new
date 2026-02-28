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
import { ThumbsDown, ThumbsUp, Plus, Search, Loader2, Trash2, RotateCcw } from 'lucide-react';
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
  const [searchQuery, setSearchQuery] = useState('');

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: { userId: '', requestedDate: '', reason: '' },
  });

  const usersMap = useMemo(() => new Map(users?.map(user => [user.id, user.name])), [users]);
  
  const processedRequests = useMemo(() => {
    if (!requests) return [];
    return requests.map(req => ({ ...req, userName: usersMap.get(req.userId) || 'Unknown' }))
      .filter(req => req.userName.toLowerCase().includes(searchQuery.toLowerCase()))
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
    try {
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

        updateDocumentNonBlocking(newDocRef, dataToSave);
        
        setIsFormDialogOpen(false);
        form.reset();
        toast({ title: 'Berhasil', description: 'Permintaan jadwal berhasil ditambahkan.' });
    } catch (e) {
        toast({ title: 'Error', description: 'Gagal menambahkan permintaan.', variant: 'destructive' });
    }
  };

  return (
    <Card className="shadow-lg border-none">
      <CardHeader className="flex flex-row justify-between items-center">
        <div className="space-y-1">
            <CardTitle>Schedule Change Requests</CardTitle>
            <p className="text-sm text-muted-foreground">Kelola permintaan perubahan jadwal ronda dari warga.</p>
        </div>
        <Button onClick={() => setIsFormDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Request</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Cari berdasarkan nama warga..." 
                className="pl-8"
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
            />
        </div>

        <div className="border rounded-xl overflow-hidden bg-card">
            <Table>
            <TableHeader className="bg-muted/50">
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
                                    {/* Action: Approve */}
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

                                    {/* Action: Reject */}
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

                                    {/* Action: Reset to Pending */}
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

                                    {/* Action: Delete (Powerful) */}
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

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogContent className="max-w-md">
              <DialogHeader>
                  <DialogTitle>Buat Permintaan Baru</DialogTitle>
                  <DialogDescription>Input permintaan perubahan jadwal secara manual oleh admin.</DialogDescription>
              </DialogHeader>
              <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField control={form.control} name="userId" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Pilih Warga</FormLabel>
                              <FormControl>
                                  <select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                                      <option value="">-- Pilih Warga --</option>
                                      {users?.map(u => (
                                          <option key={u.id} value={u.id}>{u.name} ({u.address})</option>
                                      ))}
                                  </select>
                              </FormControl>
                              <FormMessage />
                          </FormItem>
                      )} />
                      <FormField control={form.control} name="requestedDate" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Tanggal Yang Diminta</FormLabel>
                              <FormControl><Input type="date" {...field} /></FormControl>
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
                          <Button type="submit" className="w-full">Kirim Permintaan</Button>
                      </DialogFooter>
                  </form>
              </Form>
          </DialogContent>
      </Dialog>
    </Card>
  );
}
