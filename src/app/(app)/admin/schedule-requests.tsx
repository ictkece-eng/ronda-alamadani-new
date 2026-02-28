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
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';

type ScheduleRequestWithUser = ScheduleRequest & { userName?: string };

const ITEMS_PER_PAGE = 10;

const requestSchema = z.object({
  userId: z.string({ required_error: 'Please select a user.' }).min(1, 'Please select a user.'),
  requestedDate: z.string().min(1, 'New requested date is required.'),
  reason: z.string().min(1, 'Reason is required.').max(200, 'Reason cannot exceed 200 characters.'),
});
type RequestFormValues = z.infer<typeof requestSchema>;

interface ScheduleRequestsProps {
    readOnly?: boolean;
}

export function ScheduleRequests({ readOnly = false }: ScheduleRequestsProps) {
  const firestore = useFirestore();
  const { toast } = useToast();

  const requestsQuery = useMemoFirebase(
    () => (firestore ? query(collectionGroup(firestore, 'scheduleRequests')) : null),
    [firestore]
  );
  const { data: requests, isLoading: isRequestsLoading, error: requestsError } = useCollection<ScheduleRequest>(requestsQuery);
  
  const usersQuery = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading: isUsersLoading } = useCollection<Warga>(usersQuery);

  const [currentPage, setCurrentPage] = useState(1);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<ScheduleRequestWithUser | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
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
    if (!requests || !selectedMonth) return [];
    
    const [year, month] = selectedMonth.split('-').map(Number);
    
    const allMapped = requests.map(req => ({
      ...req,
      userName: usersMap.get(req.userId) || 'Unknown User',
    }));

    const filteredByMonth = allMapped.filter(req => {
        const reqDate = new Date(req.requestedScheduleDate);
        return reqDate.getUTCFullYear() === year && reqDate.getUTCMonth() + 1 === month;
    });

    const filteredByName = searchQuery
      ? filteredByMonth.filter(req => req.userName.toLowerCase().includes(searchQuery.toLowerCase()))
      : filteredByMonth;

    return filteredByName.sort((a, b) => new Date(b.requestDate).getTime() - new Date(a.requestDate).getTime());
  }, [requests, usersMap, searchQuery, selectedMonth]);

  const isLoading = isRequestsLoading || isUsersLoading;

  const totalPages = Math.ceil(processedRequests.length / ITEMS_PER_PAGE);
  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return processedRequests.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [processedRequests, currentPage]);

  const handleUpdateStatus = (request: ScheduleRequest, status: 'approved' | 'rejected') => {
    if (!firestore) return;
    const requestRef = doc(firestore, 'users', request.userId, 'scheduleRequests', request.id);
    setDocumentNonBlocking(requestRef, { status: status }, { merge: true });
    toast({ title: 'Success', description: `Request status updated to ${status}.` });
  };

  const handleCreateClick = () => {
    setEditingRequest(null);
    reset({ userId: '', requestedDate: '', reason: '' });
    setUserSearch('');
    setIsFormDialogOpen(true);
  };

  const handleEditClick = (req: ScheduleRequestWithUser) => {
    setEditingRequest(req);
    const user = users?.find(u => u.id === req.userId);
    setUserSearch(user?.name || '');
    reset({
        userId: req.userId,
        requestedDate: format(new Date(req.requestedScheduleDate), 'yyyy-MM-dd'),
        reason: req.reason,
    });
    setIsFormDialogOpen(true);
  };

  const onSubmit = async (values: RequestFormValues) => {
    if (!firestore) return;

    if (editingRequest) {
      const requestRef = doc(firestore, 'users', editingRequest.userId, 'scheduleRequests', editingRequest.id);
      const updatedData = {
          requestedScheduleDate: new Date(values.requestedDate).toISOString(),
          reason: values.reason,
      };
      setDocumentNonBlocking(requestRef, updatedData, { merge: true });
      toast({
        title: 'Request Updated',
        description: 'The schedule change request has been updated.',
      });
    } else {
      const { userId, requestedDate, reason } = values;
      const requestsCol = collection(firestore, 'users', userId, 'scheduleRequests');
      const newRequestRef = doc(requestsCol);
      const newRequestData: Omit<ScheduleRequest, 'rondaScheduleId' | 'currentScheduleDate'> = {
        id: newRequestRef.id,
        userId: userId,
        requestDate: new Date().toISOString(),
        requestedScheduleDate: new Date(requestedDate).toISOString(),
        reason: reason,
        status: 'pending' as 'pending',
      };

      setDocumentNonBlocking(newRequestRef, newRequestData, {});
      toast({
        title: 'Request Created',
        description: 'The schedule change request has been created successfully.',
      });
    }

    setIsFormDialogOpen(false);
    setEditingRequest(null);
  };

  const selectedUserId = watch('userId');
  const watchedDate = watch('requestedDate');
  
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
  
  const requestsForSelectedDate = useMemo(() => {
    if (!watchedDate || !requests) return [];
    const normalizedSelectedDate = new Date(watchedDate).toISOString().split('T')[0];
    return requests.filter(req => {
        if (editingRequest && req.id === editingRequest.id) return false;
        const normalizedReqDate = new Date(req.requestedScheduleDate).toISOString().split('T')[0];
        return normalizedReqDate === normalizedSelectedDate && (req.status === 'pending' || req.status === 'approved');
    }).map(req => ({
        ...req,
        userName: usersMap.get(req.userId) || 'Unknown User'
    }));
  }, [watchedDate, requests, usersMap, editingRequest]);

  return (
    <>
    <Card className="shadow-lg border-none">
      <CardHeader>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle>Manage Schedule Requests</CardTitle>
                <CardDescription>Approve or reject ronda schedule change requests from warga.</CardDescription>
            </div>
            {!readOnly && (
                <Button className="self-end sm:self-center" onClick={handleCreateClick}>
                    <Plus className="h-4 w-4 mr-2" />
                    Request Jadwal
                </Button>
            )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative w-full sm:max-w-xs">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Search by name..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setCurrentPage(1);
                    }}
                />
            </div>
            <div className="w-full sm:max-w-xs">
                <Label htmlFor="month-picker" className="sr-only">Filter by Month</Label>
                <Input
                    id="month-picker"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => {
                        setSelectedMonth(e.target.value);
                        setCurrentPage(1);
                    }}
                    disabled={isLoading}
                />
            </div>
        </div>
        {requestsError && (
          <Alert variant="destructive">
            <AlertTitle>Loading Error</AlertTitle>
            <AlertDescription>
              Could not load schedule requests due to a permission error. The security rules may need adjustment.
            </AlertDescription>
          </Alert>
        )}
        <div className="border rounded-lg overflow-hidden bg-background">
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
                        <TableCell>{format(new Date(req.requestedScheduleDate), 'PPP', { locale: idLocale })}</TableCell>
                        <TableCell className='hidden md:table-cell'>{req.reason}</TableCell>
                        <TableCell>
                             <Badge variant={req.status === 'pending' ? 'secondary' : req.status === 'approved' ? 'default' : 'destructive'}
                                className={req.status === 'approved' ? 'bg-green-600' : ''}
                            >
                                {req.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                           <div className="flex gap-2 justify-end">
                                {!readOnly && (
                                    <Button variant="ghost" size="icon" onClick={() => handleEditClick(req)} className="h-8 w-8">
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                )}
                                {req.status === 'pending' && (
                                    <>
                                        <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                                        onClick={() => handleUpdateStatus(req, 'approved')}
                                        >
                                            <ThumbsUp className="h-4 w-4" />
                                        </Button>
                                        <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 border-destructive text-destructive hover:bg-destructive hover:text-white"
                                        onClick={() => handleUpdateStatus(req, 'rejected')}
                                        >
                                            <ThumbsDown className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                ))
                ) : (
                <TableRow>
                    <TableCell colSpan={5} className="text-center h-24">
                       {searchQuery ? "No requests match your search." : "No schedule requests found for this month."}
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

    <Dialog open={isFormDialogOpen} onOpenChange={(isOpen) => {
        setIsFormDialogOpen(isOpen);
        if (!isOpen) {
            setEditingRequest(null);
            reset();
            setUserSearch('');
        }
    }}>
        <DialogContent className="sm:max-w-[480px]">
            <DialogHeader>
                <DialogTitle>{editingRequest ? 'Edit' : 'Create New'} Schedule Request</DialogTitle>
                <DialogDescription>
                    {editingRequest ? 'Update the details for this request.' : 'Create a request on behalf of a user for any date.'}
                </DialogDescription>
            </DialogHeader>
            <Form {...form}>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 py-4">
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
                                            disabled={!!editingRequest}
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
                     {requestsForSelectedDate.length >= 3 && (
                        <Alert variant="destructive">
                            <AlertTitle>Tanggal Penuh</AlertTitle>
                            <AlertDescription>
                                Tanggal ini sudah dipilih oleh 3 orang:
                                <ul className="list-disc pl-5 mt-2">
                                    {requestsForSelectedDate.map(req => (
                                        <li key={req.id}>{req.userName}</li>
                                    ))}
                                </ul>
                            </AlertDescription>
                        </Alert>
                    )}
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
                        <Button type="button" variant="ghost" onClick={() => setIsFormDialogOpen(false)}>Cancel</Button>
                        <Button type="submit" disabled={formState.isSubmitting || (requestsForSelectedDate.length >= 3 && !editingRequest) }>
                        {formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {editingRequest ? 'Save Changes' : 'Create Request'}
                        </Button>
                    </DialogFooter>
                </form>
            </Form>
        </DialogContent>
    </Dialog>
    </>
  );
}
