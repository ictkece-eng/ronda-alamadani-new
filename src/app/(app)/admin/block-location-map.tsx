'use client';

import { useMemo, useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import type { Warga } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, MapPinned, House, Users, Phone, ShieldCheck, UserCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

type BlockGroup = {
  code: string;
  letter: string;
  number: number;
  residents: Warga[];
};

const normalizeBlockCode = (value: string) => value.trim().toUpperCase().replace(/\s+/g, '');

const parseBlockCode = (value: string) => {
  const normalized = normalizeBlockCode(value);
  const match = normalized.match(/^([A-Z]+)(\d+)$/);

  if (!match) {
    return {
      code: normalized || '-',
      letter: '#',
      number: Number.MAX_SAFE_INTEGER,
    };
  }

  return {
    code: normalized,
    letter: match[1],
    number: Number.parseInt(match[2], 10),
  };
};

export function BlockLocationMap() {
  const firestore = useFirestore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<string>('');

  const usersCollection = useMemoFirebase(
    () => (firestore ? collection(firestore, 'users') : null),
    [firestore]
  );
  const { data: users, isLoading } = useCollection<Warga>(usersCollection);

  const processed = useMemo(() => {
    const searchable = (users || []).filter((user) => Boolean(user.address?.trim()));
    const query = searchQuery.trim().toLowerCase();

    const filteredUsers = searchable.filter((user) => {
      const name = (user.name || '').toLowerCase();
      const email = (user.email || '').toLowerCase();
      const phone = (user.phone || '').toLowerCase();
      const address = (user.address || '').toLowerCase();

      return !query || name.includes(query) || email.includes(query) || phone.includes(query) || address.includes(query);
    });

    const groupedMap = new Map<string, BlockGroup>();

    filteredUsers.forEach((user) => {
      const parsed = parseBlockCode(user.address || '');
      if (!groupedMap.has(parsed.code)) {
        groupedMap.set(parsed.code, {
          code: parsed.code,
          letter: parsed.letter,
          number: parsed.number,
          residents: [],
        });
      }

      groupedMap.get(parsed.code)?.residents.push(user);
    });

    const blockGroups = Array.from(groupedMap.values())
      .map((group) => ({
        ...group,
        residents: [...group.residents].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
      }))
      .sort((a, b) => {
        const letterCompare = a.letter.localeCompare(b.letter);
        if (letterCompare !== 0) return letterCompare;
        if (a.number !== b.number) return a.number - b.number;
        return a.code.localeCompare(b.code);
      });

    const letters = Array.from(new Set(blockGroups.map((group) => group.letter))).sort((a, b) => a.localeCompare(b));
    const maxNumber = blockGroups.reduce((highest, group) => {
      return Number.isFinite(group.number) && group.number > highest ? group.number : highest;
    }, 0);

    return {
      filteredUsers,
      blockGroups,
      letters,
      maxNumber,
    };
  }, [users, searchQuery]);

  const { filteredUsers, blockGroups, letters, maxNumber } = processed;

  const selectedBlockData = useMemo(() => {
    if (!blockGroups.length) return null;
    return blockGroups.find((group) => group.code === selectedBlock) || blockGroups[0];
  }, [blockGroups, selectedBlock]);

  const totalActiveScheduleResidents = useMemo(() => {
    return (users || []).filter(
      (user) =>
        user.role === 'user' ||
        user.role === 'coordinator' ||
        (user.role === 'backup' && user.includeInSchedule === true)
    ).length;
  }, [users]);

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-sm app-surface overflow-hidden">
        <CardContent className="p-4 p-lg-5">
          <div className="row g-4 align-items-center">
            <div className="col-12 col-xl-8">
              <div className="d-flex align-items-start gap-3">
                <div className="rounded-4 bg-primary bg-opacity-10 border border-primary border-opacity-10 p-3 text-primary">
                  <MapPinned className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-uppercase small fw-semibold text-primary mb-1">Admin Panel</p>
                  <h2 className="h3 fw-bold mb-2 text-body-emphasis">Denah Lokasi Blok</h2>
                  <p className="text-muted mb-0">
                    Pantau sebaran warga per blok rumah dengan tampilan denah sederhana berbasis data alamat yang sudah tersimpan di sistem.
                  </p>
                </div>
              </div>
            </div>
            <div className="col-12 col-xl-4">
              <div className="rounded-4 border bg-white p-3 shadow-sm h-100">
                <div className="small text-uppercase fw-semibold text-muted mb-2">Ringkasan Denah</div>
                <div className="row g-3">
                  <div className="col-6 col-md-4">
                    <div className="rounded-4 bg-primary bg-opacity-10 p-3 h-100">
                      <div className="small text-muted">Blok Terdeteksi</div>
                      <div className="h4 fw-bold mb-0 mt-1">{blockGroups.length}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-4">
                    <div className="rounded-4 bg-info bg-opacity-10 p-3 h-100">
                      <div className="small text-muted">Warga Tampil</div>
                      <div className="h4 fw-bold mb-0 mt-1">{filteredUsers.length}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-4">
                    <div className="rounded-4 bg-success bg-opacity-10 p-3 h-100">
                      <div className="small text-muted">Peserta Ronda</div>
                      <div className="h4 fw-bold mb-0 mt-1">{totalActiveScheduleResidents}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="row g-4 align-items-start">
        <div className="col-12 col-xxl-8">
          <Card className="border-0 shadow-sm app-surface overflow-hidden">
            <CardHeader>
              <CardTitle className="d-flex align-items-center gap-2">
                <House className="h-5 w-5 text-primary" />
                Denah Blok Perumahan
              </CardTitle>
              <CardDescription>
                Klik salah satu blok untuk melihat daftar warga di blok tersebut. Denah ini otomatis mengikuti data alamat warga.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="position-relative">
                <Search className="position-absolute top-50 start-0 translate-middle-y ms-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cari nama warga, blok, email, atau nomor HP..."
                  className="ps-5 rounded-pill"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
              </div>

              <div className="rounded-4 border bg-white p-3 shadow-sm">
                {isLoading ? (
                  <div className="row g-3">
                    {Array.from({ length: 12 }).map((_, index) => (
                      <div className="col-6 col-md-4 col-xl-3" key={index}>
                        <Skeleton className="h-24 w-full rounded-4" />
                      </div>
                    ))}
                  </div>
                ) : blockGroups.length > 0 ? (
                  <div className="space-y-4">
                    {letters.map((letter) => (
                      <div key={letter} className="space-y-2">
                        <div className="small text-uppercase fw-semibold text-primary">Blok {letter}</div>
                        <div className="row g-3">
                          {Array.from({ length: maxNumber }, (_, index) => index + 1)
                            .filter((number) => blockGroups.some((group) => group.letter === letter && group.number === number))
                            .map((number) => {
                              const block = blockGroups.find((group) => group.letter === letter && group.number === number);

                              if (!block) return null;

                              const activeCount = block.residents.filter(
                                (resident) =>
                                  resident.role === 'user' ||
                                  resident.role === 'coordinator' ||
                                  (resident.role === 'backup' && resident.includeInSchedule === true)
                              ).length;

                              return (
                                <div className="col-6 col-md-4 col-xl-3" key={block.code}>
                                  <button
                                    type="button"
                                    onClick={() => setSelectedBlock(block.code)}
                                    className={cn(
                                      'w-100 text-start rounded-4 border p-3 shadow-sm transition-all bg-white',
                                      selectedBlockData?.code === block.code
                                        ? 'border-primary bg-primary bg-opacity-10 shadow'
                                        : 'border-light-subtle hover:border-primary-subtle hover:bg-body-tertiary'
                                    )}
                                  >
                                    <div className="d-flex align-items-center justify-content-between gap-3 mb-2">
                                      <div>
                                        <div className="small text-muted">Lokasi Blok</div>
                                        <div className="h5 fw-bold mb-0">{block.code}</div>
                                      </div>
                                      <Badge variant="outline" className="rounded-pill">
                                        {block.residents.length} warga
                                      </Badge>
                                    </div>
                                    <div className="small text-muted d-flex align-items-center gap-2">
                                      <UserCheck className="h-3.5 w-3.5" />
                                      {activeCount} aktif ronde
                                    </div>
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-5 text-muted-foreground">
                    Tidak ada data blok yang cocok dengan pencarian saat ini.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-12 col-xxl-4">
          <Card className="border-0 shadow-sm app-surface overflow-hidden sticky-top" style={{ top: '6rem' }}>
            <CardHeader>
              <CardTitle className="d-flex align-items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Detail Blok {selectedBlockData?.code || '-'}
              </CardTitle>
              <CardDescription>
                Menampilkan daftar warga berdasarkan blok yang dipilih dari denah di sebelah kiri.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton className="h-20 w-full rounded-4" key={index} />
                  ))}
                </div>
              ) : selectedBlockData ? (
                <div className="space-y-3">
                  <div className="rounded-4 border bg-white p-3 shadow-sm">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <div>
                        <div className="small text-muted">Total penghuni blok</div>
                        <div className="h4 fw-bold mb-0">{selectedBlockData.residents.length}</div>
                      </div>
                      <Badge className="bg-primary-subtle text-primary-emphasis border-0 rounded-pill px-3 py-2">
                        {selectedBlockData.code}
                      </Badge>
                    </div>
                  </div>

                  {selectedBlockData.residents.map((resident) => (
                    <div key={resident.id} className="rounded-4 border bg-white p-3 shadow-sm">
                      <div className="d-flex align-items-start justify-content-between gap-3 mb-2">
                        <div>
                          <div className="fw-semibold">{resident.name || 'Tanpa Nama'}</div>
                          <div className="small text-muted">{resident.email || 'Email belum diisi'}</div>
                        </div>
                        <Badge variant="outline" className="text-capitalize">
                          {resident.role}
                        </Badge>
                      </div>
                      <div className="small text-muted d-flex flex-column gap-1">
                        <span className="d-flex align-items-center gap-2">
                          <Phone className="h-3.5 w-3.5" />
                          {resident.phone || '-'}
                        </span>
                        <span className="d-flex align-items-center gap-2">
                          <MapPinned className="h-3.5 w-3.5" />
                          Blok {normalizeBlockCode(resident.address || '-')}
                        </span>
                      </div>
                      <div className="d-flex flex-wrap gap-2 mt-3">
                        {(resident.role === 'coordinator' || resident.role === 'admin') && (
                          <Badge className="bg-info-subtle text-info-emphasis border-0">
                            <ShieldCheck className="h-3 w-3 mr-1" />
                            Akses Pengelola
                          </Badge>
                        )}
                        {(resident.role === 'user' || resident.role === 'coordinator' || (resident.role === 'backup' && resident.includeInSchedule)) && (
                          <Badge className="bg-success-subtle text-success-emphasis border-0">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Aktif Ronda
                          </Badge>
                        )}
                        {resident.isTeacher && (
                          <Badge className="bg-warning-subtle text-warning-emphasis border-0">
                            Prioritas Guru
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-5 text-muted-foreground">
                  Pilih salah satu blok pada denah untuk melihat detail penghuninya.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}