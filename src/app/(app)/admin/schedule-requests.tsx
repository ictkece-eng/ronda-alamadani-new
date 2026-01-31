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
import { collection, collectionGroup, doc, query, where, getDocs, limit } from 'firebase/firestore';
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
import { Loader2, ThumbsDown, ThumbsUp, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';


type ScheduleRequestWithUser = ScheduleRequest & { userName?: string };

const ITEMS_PER_PAGE = 10;

const newRequestSchema = z.object({
  userId: z.string({ required_error: 'Please select a user.' }),
  currentDate: z.string().min(1, 'Current schedule date is required.'),
  requestedDate: z.string().min(1, 'New requested date is required.'),
  reason: z.string().min(1, 'Reason is required.').max(200, 'Reason cannot exceed 200 characters.'),
});
type NewRequestFormValues = z.infer<typeof newRequestSchema>;

export function ScheduleRequests() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(collectionGroup(firestore, 'scheduleRequests')) : null),
    [firestore]
  );
  const { data: requests, isLoading: isRequestsLoading } = useCollection<ScheduleRequest>(requestsQuery);
  
  const usersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersQuery);

  const [currentPage, setCurrentPage] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const form = useForm<NewRequestFormValues>({
    resolver: zodResolver(newRequestSchema),
    defaultValues: {
        reason: '',
    },
  });

  const { formState, handleSubmit, reset } = form;

  const usersMap = useMemo(() => {
    if (!users) return new Map<string, string>();
    return new Map(users.map(user => [user.id, user.name]));
  }, [users]);
  
  const processedRequests = useMemo(() => {
    if (!requests) return [];
    return requests.map(req => ({
      ...req,
      userName: usersMap.get(req.userId) || 'Unknown User',
    })).sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }, [requests, usersMap]);

  const isLoading = isRequestsLoading || isUsersLoading;

  const totalPages = Math.ceil(processedRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedRequests, currentPage]);


  const handleUpdateStatus = (request: ScheduleRequest, status: 'approved' | 'rejected') => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'users', request.userId, 'scheduleRequests', request.id);
    
    // We keep all original data and just update the status
    const updatedData = { ...request, status };

    setDocumentNonBlocking(requestRef, updatedData, { merge: true });
    
    toast({ title: 'Success', description: `Request status updated to ${status}.` });
  };

  const onCreateSubmit = async (values: NewRequestFormValues) => {
    if (!firestore) return;

    const { userId, currentDate, requestedDate, reason } = values;

    try {
      // Find the schedule ID for the current date for the SELECTED user
      const startOfDay = new Date(currentDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(currentDate);
      endOfDay.setHours(23, 59, 59, 999);

      const schedulesRef = collection(firestore, 'users', userId, 'rondaSchedules');
      const q = query(
        schedulesRef,
        where('date', '>=', startOfDay.toISOString()),
        where('date', '<=', endOfDay.toISOString()),
        limit(1)
      );

      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: 'Error', description: `No schedule found for this user on ${currentDate}.`, variant: 'destructive' });
        return;
      }

      const rondaSchedule = querySnapshot.docs[0];
      const rondaScheduleId = rondaSchedule.id;

      const requestsCol = collection(firestore, 'users', userId, 'scheduleRequests');
      const newRequestRef = doc(requestsCol);
      const newRequestData = {
        id: newRequestRef.id,
        userId: userId,
        rondaScheduleId: rondaScheduleId,
        requestDate: new Date().toISOString(),
        currentScheduleDate: new Date(currentDate).toISOString(),
        requestedScheduleDate: new Date(requestedDate).toISOString(),
        reason: reason,
        status: 'pending' as 'pending' | 'approved' | 'rejected',
      };

      setDocumentNonBlocking(newRequestRef, newRequestData, {});

      toast({
        title: 'Request Created',
        description: 'The schedule change request has been created successfully.',
      });

      setIsCreateDialogOpen(false);
      reset();
    } catch (error) {
      console.error("Error creating request:", error);
      toast({ title: 'Creation Failed', description: 'Could not create the request. Please try again.', variant: 'destructive' });
    }
  };


  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle>Manage Schedule Requests</CardTitle>
                <CardDescription>Approve or reject ronda schedule change requests from warga.</CardDescription>
            </div>
            <Button className="self-end sm:self-center" onClick={() => { reset(); setIsCreateDialogOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Request Jadwal
            </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="border rounded-lg overflow-hidden">
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Warga</TableHead>
                    <TableHead>From</TableHead>
                    <TableHead>To</TableHead>
                    <TableHead className='hidden md:table-cell'>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={6}><Skeleton className="h-6 w-full" /></TableCell>
                        </TableRow>
                    ))
                ) : paginatedRequests.length > 0 ? (
                paginatedRequests.map((req) => (
                    <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.userName}</TableCell>
                        <TableCell>{format(new Date(req.currentScheduleDate), 'PPP')}</TableCell>
                        <TableCell>{format(new Date(req.requestedScheduleDate), 'PPP')}</TableCell>
                        <TableCell className='hidden md:table-cell'>{req.reason}</TableCell>
                        <TableCell>
                             <Badge variant={req.status === 'pending' ? 'secondary' : req.status === 'approved' ? 'default' : 'destructive'}
                                className={req.status === 'approved' ? 'bg-green-600' : ''}
                            >
                                {req.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                           {req.status === 'pending' && (
                                <div className="flex gap-2 justify-end">
                                    <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleUpdateStatus(req, 'approved')}
                                    >
                                    <ThumbsUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleUpdateStatus(req, 'rejected')}
                                    >
                                    <ThumbsDown className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </TableCell>
                    </TableRow>
                ))
                ) : (
                <TableRow>
                    <TableCell colSpan={6} className="text-center h-24">
                       No schedule requests found.
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
                    Showing <strong>{paginatedRequests.length}</strong> of <strong>{processedRequests.length}</strong> requests
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
    </Card>

    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
                <DialogTitle>Create New Schedule Request</DialogTitle>
                <DialogDescription>
                    Create a request on behalf of a user. This will appear in the list for approval.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4 py-4">
                    <FormField
                        control={form.control}
                        name="userId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>User / Warga</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a user" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        {users?.map(user => (
                                            <SelectItem key={user.id} value={user.id}>
                                                {user.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="currentDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Current Schedule Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="requestedDate"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Requested Change Date</FormLabel>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Reason for Change</FormLabel>
                                <FormControl>
                                    <Textarea placeholder='e.g., "Ada acara keluarga"' {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={formState.isSubmitting}>
                        {formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Request
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}
