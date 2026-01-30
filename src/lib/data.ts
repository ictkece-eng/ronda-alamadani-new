import type { Schedule, Backup, Coordinator, UserRequest } from '@/lib/types';

export const schedules: Schedule[] = [
  {
    date: '2024-07-01',
    participants: ['Budi', 'Joko'],
    rounds: ['Round 1: Budi', 'Round 2: Joko'],
  },
  {
    date: '2024-07-02',
    participants: ['Agus', 'Siti'],
    rounds: ['Round 1: Agus', 'Round 2: Siti'],
  },
  {
    date: '2024-07-03',
    participants: ['Dewi', 'Eko'],
    rounds: ['Round 1: Dewi', 'Round 2: Eko'],
  },
  {
    date: '2024-07-04',
    participants: ['Budi', 'Agus'],
    rounds: ['Round 1: Budi', 'Round 2: Agus'],
  },
];

export const backups: Backup[] = [
  {
    originalParticipant: 'Budi',
    replacement: 'Herman',
    date: '2024-07-01',
    status: 'Approved',
  },
  {
    originalParticipant: 'Siti',
    replacement: 'Lina',
    date: '2024-07-02',
    status: 'Pending',
  },
];

export const coordinators: Coordinator[] = [
  {
    name: 'Pak RT',
    avatar: 'user-5',
    contact: '081234567890',
    area: 'Blok A',
  },
  {
    name: 'Pak RW',
    avatar: 'user-6',
    contact: '080987654321',
    area: 'Blok B & C',
  },
];

export const userRequests: UserRequest[] = [
  {
    id: 1,
    userName: 'Siti',
    currentDate: '2024-07-02',
    requestedDate: '2024-07-10',
    reason: 'Ada acara keluarga mendadak.',
    status: 'Pending',
  },
  {
    id: 2,
    userName: 'Eko',
    currentDate: '2024-07-03',
    requestedDate: '2024-07-15',
    reason: 'Sakit.',
    status: 'Pending',
  },
];
