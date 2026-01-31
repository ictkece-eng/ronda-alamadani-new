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
  updateDocumentNonBlocking,
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
import { Loader2, ThumbsDown, ThumbsUp, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';


type ScheduleRequestWithUser = ScheduleRequest & { userName?: string };

const ITEMS_PER_PAGE = 10;

const newRequestSchema = z.object({
  userId: z.string({ required_error: 'Please select a user.' }).min(1, 'Please select a user.'),
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
  const [userSearch, setUserSearch] = useState('');

  const form = useForm<NewRequestFormValues>({
    resolver: zodResolver(newRequestSchema),
    defaultValues: {
        userId: '',
        requestedDate: '',
        reason: '',
    },
  });

  const { formState, handleSubmit, reset, watch } = form;

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
    
    updateDocumentNonBlocking(requestRef, { status: status });
    
    toast({ title: 'Success', description: `Request status updated to ${status}.` });
  };

  const onCreateSubmit = async (values: NewRequestFormValues) => {
    if (!firestore) return;

    const { userId, requestedDate, reason } = values;

    try {
      const requestsCol = collection(firestore, 'users', userId, 'scheduleRequests');
      const newRequestRef = doc(requestsCol);
      const newRequestData = {
        id: newRequestRef.id,
        userId: userId,
        requestDate: new Date().toISOString(),
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

  // Derived state for user search
  const selectedUserId = watch('userId');
  const selectedUser = useMemo(() => {
    return users?.find(u => u.id === selectedUserId);
  }, [users, selectedUserId]);

  const filteredUsers = useMemo(() => {
    if (!userSearch || (selectedUser && selectedUser.name === userSearch)) {
      return [];
    }
    return users?.filter(
        user =>
          user.name.toLowerCase().includes(userSearch.toLowerCase()) ||
          user.phone.toLowerCase().includes(userSearch.toLowerCase())
      ) ?? [];
  }, [userSearch, users, selectedUser]);

  return (
    <>
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
                <CardTitle>Manage Schedule Requests</CardTitle>
                <CardDescription>Approve or reject ronda schedule change requests from warga.</CardDescription>
            </div>
            <Button className="self-end sm:self-center" onClick={() => { reset(); setUserSearch(''); setIsCreateDialogOpen(true); }}>
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
                    <TableHead>Requested Date</TableHead>
                    <TableHead className='hidden md:table-cell'>Reason</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                            <TableCell colSpan={5}><Skeleton className="h-6 w-full" /></TableCell>
                        </TableRow>
                    ))
                ) : paginatedRequests.length > 0 ? (
                paginatedRequests.map((req) => (
                    <TableRow key={req.id}>
                        <TableCell className="font-medium">{req.userName}</TableCell>
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
                    <TableCell colSpan={5} className="text-center h-24">
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

    <Dialog open={isCreateDialogOpen} onOpenChange={(isOpen) => {
        setIsCreateDialogOpen(isOpen);
        if (!isOpen) {
            reset();
            setUserSearch('');
        }
    }}>
        <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
                <DialogTitle>Create New Schedule Request</DialogTitle>
                <DialogDescription>
                    Create a request on behalf of a user. This will appear in the list for approval.
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-6 py-4">
                    <FormField
                        control={form.control}
                        name="userId"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>User / Warga</FormLabel>
                                <div className="relative">
                                    <FormControl>
                                        <Input
                                            placeholder="Search user by name or phone..."
                                            value={userSearch || selectedUser?.name || ''}
                                            onChange={e => {
                                                setUserSearch(e.target.value);
                                                if (field.value) {
                                                    form.setValue('userId', '');
                                                }
                                            }}
                                        />
                                    </FormControl>
                                    {filteredUsers.length > 0 && (
                                        <div className="absolute top-full mt-1 z-10 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-48 overflow-y-auto">
                                            {filteredUsers.map(user => (
                                                <div
                                                    key={user.id}
                                                    className="cursor-pointer p-2 hover:bg-accent"
                                                    onClick={() => {
                                                        form.setValue('userId', user.id, { shouldValidate: true });
                                                        setUserSearch(user.name);
                                                    }}
                                                >
                                                    <p className="font-medium">{user.name}</p>
                                                    <p className="text-xs text-muted-foreground">{user.phone}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
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
