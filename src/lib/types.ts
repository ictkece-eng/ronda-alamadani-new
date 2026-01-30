
export type ScheduleEntry = {
  hariTanggal: string;
  nama: string;
  blok: string;
  noHp: string;
  pengganti?: string;
};

export type PersonInfo = {
  nama: string;
  blok: string;
  noHp: string;
};

export type InfoItem = {
  id: number;
  text: string;
};

// Keep other types for different pages
export type Warga = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  role: 'admin' | 'coordinator' | 'user';
};


export type Schedule = {
  date: string;
  participants: string[];
  rounds: string[];
};

export type Backup = {
  originalParticipant: string;
  replacement: string;
  date: string;
  status: 'Pending' | 'Approved' | 'Rejected';
};

export type Coordinator = {
  name: string;
  avatar: string;
  contact: string;
  area: string;
};

export type ScheduleRequest = {
  id: string;
  userId: string;
  rondaScheduleId: string;
  requestDate: string; // ISO String for when the request was made
  currentScheduleDate: string; // ISO String for the original schedule date
  requestedScheduleDate: string; // ISO String for the new requested date
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
};
