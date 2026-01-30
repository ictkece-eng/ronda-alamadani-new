
import type { Schedule, Backup, Coordinator, UserRequest, RondaDay, BackupRondaPerson, CoordinatorRonda, InfoItem } from '@/lib/types';

export const rondaDays: RondaDay[] = [
  {
    day: 'Senin',
    date: '01 Desember 2025',
    assignments: [
      { name: 'Dedi Novel', block: 'I2', phone: '0823-8709-3522' },
      { name: 'Rio Antoni', block: 'H12', phone: '0813-7447-3005' },
      { name: 'Mulya Trisno', block: 'I5', phone: '0823-8941-2902' },
    ],
  },
  {
    day: 'Selasa',
    date: '02 Desember 2025',
    assignments: [
      { name: 'Bagus', block: 'H11', phone: '0813-6505-6370', substitute: 'Andre Revalino' },
    ],
  },
  {
    day: 'Rabu',
    date: '03 Desember 2025',
    assignments: [
        { name: 'Roni Saputra', block: 'B8', phone: '0852-7885-6368' },
        { name: 'Randy Anugrah', block: 'F3', phone: '0852-7212-4318' },
    ],
  },
   {
    day: 'Kamis',
    date: '04 Desember 2025',
    assignments: [
        { name: 'Jumaidi', block: 'I1', phone: '0852-6546-0038', substitute: 'Andre Revalino' },
        { name: 'Eka Kurnia Putra', block: 'H5', phone: '0812-6819-9968' },
        { name: 'Fajri', block: 'H1', phone: '0853-6308-9407' },
    ],
  },
  {
    day: 'Jumat',
    date: '05 Desember 2025',
    assignments: [
        { name: 'Randy Maris', block: 'I4', phone: '0822-8414-6699', substitute: 'Andre Revalino' },
    ],
  },
  {
    day: 'Sabtu',
    date: '06 Desember 2025',
    assignments: [
        { name: 'Adha', block: 'I8', phone: '0852-7827-1691' },
        { name: 'Ali Harahap', block: 'B4', phone: '0821-6319-9560' },
    ]
  },
  {
    day: 'Minggu',
    date: '07 Desember 2025',
    assignments: [
        { name: 'Bastian', block: 'D2', phone: '0812-6168-9816' },
        { name: 'Gusrianto Hendra', block: 'F7', phone: '0812-3305-6255' },
        { name: 'Roli', block: 'H10', phone: '0823-8775-8224', substitute: 'Andre Revalino' },
    ]
  }
];

export const backupRondaPeople: BackupRondaPerson[] = [
  { name: 'Sudirman', block: 'F8', phone: '0813-7822-1660' },
  { name: 'Andre Revalino', block: 'H9', phone: '0821-6973-6347' },
  { name: 'Zulkifli', block: 'E2', phone: '0821-6271-4554' },
];

export const coordinatorRondaPeople: CoordinatorRonda[] = [
  { name: 'Agung Suja febri', block: 'F6', phone: '0852-7422-0174' },
  { name: 'Rahmat Hidayat', block: 'A4', phone: '0823-9099-2314' },
  { name: 'Deni Muzki', block: 'F1', phone: '0812-7005-8389' },
];

export const infoItems: InfoItem[] = [
  { id: 1, text: 'Mohon Maaf Bila Ada kesalahan Penulisan Nama, Alamat & No Hp (Mohon diinfokan ke Coord. Ronda)' },
  { id: 2, text: 'Mohon Maaf Jika Request Schedule Ronda tidak ter-akomodir, dan Hari Libur akan di Rotasi.' },
  { id: 3, text: 'Kegiatan Ronda Malam dilakukan Pada Jam 00:00 - 04:00 wib' },
  { id: 4, text: 'Toleransi Kehadiran Ronda Paling Lambat 1 Jam, jika terlewat 1 jam sesuai kesepakatan dianggap tidak hadir' },
  { id: 5, text: 'Jika Peserta Ronda tidak bisa hadir, Wajib mencari pengganti / Change Schedule atau Berkoordinasi dengan Coord. Ronda.' },
  { id: 6, text: 'Untuk Penggantian Uang Ronda sebesar Rp. 50.000/orang/malam (Sesuai kesepakatan Musyawarah)' },
];

// Original data
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
