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
import { Loader2, ThumbsDown, ThumbsUp, Plus, Pencil, Search, X } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type ScheduleRequestWithUser = ScheduleRequest & { userName?: string };

const requestSchema = z.object({
  userId: z.string().min(1),
  requestedDate: z.string().min(1),
  reason: z.string().min(1),
});
type RequestFormValues = z.infer<typeof requestSchema>;

export function ScheduleRequests() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const requestsQuery = useMemoFirebase(() => (firestore ? query(collectionGroup(firestore, 'scheduleRequests')) : null), [firestore]);
  const { data: requests, isLoading: isRequestsLoading } = useCollection<ScheduleRequest>(requestsQuery);
  
  const usersQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'users') : null), [firestore]);
  const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersQuery);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ScheduleRequestWithUser | null>(null);
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

  const handleUpdateStatus = (request: ScheduleRequest, status: 'approved' | 'rejected') => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'users', request.userId, 'scheduleRequests', request.id);
    setDocumentNonBlocking(requestRef, { status }, { merge: true });
    toast({ title: 'Success', description: `Status updated to ${status}.` });
  };

  const onSubmit = async (values: RequestFormValues) => {
    if (!firestore) return;
    const requestRef = editingRequest 
      ? doc(firestore, 'users', editingRequest.userId, 'scheduleRequests', editingRequest.id)
      : doc(collection(firestore, 'users', values.userId, 'scheduleRequests'));
    
    setDocumentNonBlocking(requestRef, {
        id: requestRef.id,
        userId: values.userId,
        requestDate: new Date().toISOString(),
        requestedScheduleDate: new Date(values.requestedDate).toISOString(),
        reason: values.reason,
        status: editingRequest?.status || 'pending',
    }, { merge: true });
    
    setIsFormDialogOpen(false);
    toast({ title: 'Success', description: 'Request saved.' });
  };

  return (
    <Card className="shadow-lg border-none">
      <CardHeader className="flex flex-row justify-between items-center">
        <CardTitle>Manage Schedule Requests</CardTitle>
        <Button onClick={() => setIsFormDialogOpen(true)}><Plus className="h-4 w-4 mr-2" /> New Request</Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input placeholder="Search by name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        <div className="border rounded-lg overflow-hidden">
            <Table>
            <TableHeader><TableRow><TableHead>Warga</TableHead><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
                {isRequestsLoading ? <TableRow><TableCell colSpan={4} className="text-center">Loading...</TableCell></TableRow> : processedRequests.map((req) => (
                    <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.userName}</TableCell>
                        <TableCell>{format(new Date(req.requestedScheduleDate), 'PPP', { locale: idLocale })}</TableCell>
                        <TableCell><Badge variant={req.status === 'pending' ? 'secondary' : 'default'}>{req.status}</Badge></TableCell>
                        <TableCell className="text-right flex justify-end gap-2">
                            {req.status === 'pending' && (
                                <>
                                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(req, 'approved')}><ThumbsUp className="h-4 w-4" /></Button>
                                    <Button size="sm" variant="outline" onClick={() => handleUpdateStatus(req, 'rejected')}><ThumbsDown className="h-4 w-4" /></Button>
                                </>
                            )}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            </Table>
        </div>
      </CardContent>

      <Dialog open={isFormDialogOpen} onOpenChange={setIsFormDialogOpen}>
          <DialogContent>
              <DialogHeader><DialogTitle>Schedule Request</DialogTitle></DialogHeader>
              <Form {...form}><form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="userId" render={({ field }) => (
                      <FormItem><FormLabel>User ID</FormLabel><Input {...field} /></FormItem>
                  )} />
                  <FormField control={form.control} name="requestedDate" render={({ field }) => (
                      <FormItem><FormLabel>Date</FormLabel><Input type="date" {...field} /></FormItem>
                  )} />
                  <FormField control={form.control} name="reason" render={({ field }) => (
                      <FormItem><FormLabel>Reason</FormLabel><Textarea {...field} /></FormItem>
                  )} />
                  <Button type="submit" className="w-full">Submit</Button>
              </form></Form>
          </DialogContent>
      </Dialog>
    </Card>
  );
}
