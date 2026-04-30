# Ronda Alamadani

> Aplikasi manajemen jadwal ronda warga yang membantu admin, koordinator, dan warga memantau jadwal, mengelola pergantian petugas, dan merapikan operasional ronda bulanan dalam satu tempat.

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![React](https://img.shields.io/badge/React-19-149eca?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-Integrated-ffca28?logo=firebase&logoColor=black)
![Status](https://img.shields.io/badge/Status-Active-success)

## Sekilas ✨

Ronda Alamadani dibuat untuk mengganti pengelolaan jadwal ronda yang biasanya masih manual menjadi lebih tertata, transparan, dan mudah dipantau. Aplikasi ini menyatukan proses penyusunan jadwal, pergantian petugas, koordinasi warga, hingga pemantauan jadwal aktif dalam satu dashboard yang nyaman dibaca.

## Kenapa aplikasi ini penting?

Dengan aplikasi ini, pengelola lingkungan bisa:

- memantau jadwal ronda bulanan dengan cepat,
- menghasilkan jadwal ronda secara lebih terstruktur,
- mengelola data warga, koordinator, dan petugas cadangan,
- memproses permintaan perubahan jadwal dengan lebih rapi,
- menyimpan riwayat pengelolaan jadwal,
- memanfaatkan bantuan AI sebagai pendamping keputusan koordinator.

## Fitur utama 🚀

### 1. Dashboard utama

- Ringkasan jadwal ronda per bulan.
- Statistik hari terjadwal, total baris jadwal, dan support person.
- Filter periode dan pencarian nama warga.

### 2. Manajemen jadwal ronda

- Menampilkan daftar ronda harian warga.
- Menandai petugas pengganti dengan jelas.
- Membantu admin mengelola jadwal bulanan dengan tampilan yang ringkas.

### 3. Permintaan perubahan jadwal

- Warga dapat mengajukan perubahan atau pergantian jadwal.
- Admin dan koordinator dapat meninjau serta memproses permintaan.

### 4. Panel admin

- Kelola data warga.
- Kelola backup atau pengganti ronda.
- Kelola koordinator ronda.
- Kelola riwayat dan ekspor jadwal.

### 5. Bantuan AI untuk koordinator

- Memberikan saran cerdas saat meninjau atau menyesuaikan jadwal.
- Bersifat membantu, bukan menggantikan keputusan akhir manusia.

### 6. Health check database

- Menyediakan endpoint untuk mengecek koneksi database MySQL.

## Tech stack 🧰

| Teknologi | Fungsi |
| --- | --- |
| `Next.js 15` | Framework utama aplikasi |
| `React 19` | Pengembangan antarmuka pengguna |
| `TypeScript` | Type safety dan maintainability |
| `Tailwind CSS` | Utility styling |
| `Bootstrap 5` | Dukungan tampilan dan komponen visual tertentu |
| `Firebase` | Layanan aplikasi dan data client-side |
| `MySQL / mysql2` | Koneksi database tambahan |
| `Genkit + Google AI` | Fitur AI assistant |
| `React Hook Form + Zod` | Form handling dan validasi |

## Struktur folder penting 🗂️

| Folder | Kegunaan |
| --- | --- |
| `src/app/` | Routing dan halaman berbasis Next.js App Router |
| `src/app/(app)/admin/` | Fitur dan halaman admin |
| `src/app/(app)/coordinator/` | Area kerja koordinator |
| `src/app/(app)/dashboard/` | Dashboard utama jadwal ronda |
| `src/app/(app)/schedule/request/` | Form permintaan perubahan jadwal |
| `src/components/` | Komponen UI reusable |
| `src/firebase/` | Konfigurasi dan helper Firebase |
| `src/lib/` | Helper, utilitas, tipe, dan koneksi MySQL |
| `src/ai/` | Konfigurasi Genkit dan flow AI |
| `docs/` | Blueprint dan dokumen pendukung |

## Quick start ⚡

### 1. Install dependency

Gunakan package manager yang sesuai dengan `package-lock.json` yang ada di project.

```bash
npm install
```

### 2. Siapkan environment

File `.env` sudah tersedia di root project. Pastikan nilai berikut sudah benar:

- `DATABASE_URL`
- API key atau kredensial yang dibutuhkan untuk fitur AI / Genkit

Jika environment belum valid, beberapa fitur seperti AI dan pengecekan database tidak akan berjalan dengan benar.

### 3. Jalankan aplikasi

```bash
npm run dev
```

Mode development berjalan di port **9002**.

## Scripts yang tersedia 🧪

| Script | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan aplikasi pada port `9002` |
| `npm run build` | Build aplikasi untuk production |
| `npm run start` | Menjalankan hasil build production |
| `npm run lint` | Menjalankan linting |
| `npm run typecheck` | Mengecek error TypeScript tanpa build |
| `npm run genkit:dev` | Menjalankan Genkit untuk AI development |
| `npm run genkit:watch` | Menjalankan Genkit dalam mode watch |

## Alur penggunaan singkat 🔄

1. Admin atau pengelola masuk ke aplikasi.
2. Data warga dan role dikelola dari panel admin.
3. Jadwal ronda bulanan dibuat atau diperbarui.
4. Warga melihat jadwal masing-masing.
5. Jika ada kebutuhan pergantian, warga mengirim permintaan perubahan jadwal.
6. Koordinator meninjau permintaan dan dapat menggunakan bantuan AI sebagai referensi.
7. Jadwal final dipantau melalui dashboard utama.

## Endpoint penting 🔍

| Endpoint | Fungsi |
| --- | --- |
| `GET /api/health/database` | Mengecek status koneksi database MySQL |

## Catatan pengembangan 🛠️

- Project menggunakan **Next.js App Router**.
- UI disusun dari komponen reusable agar konsisten di berbagai halaman.
- Blueprint awal project tersedia di folder `docs/`.
- Perubahan pada `README.md` ini hanya memodernisasi dokumentasi dan **tidak mengubah fungsi aplikasi**.

## Ringkasan

Ronda Alamadani adalah aplikasi manajemen ronda warga yang dirancang untuk membantu pengaturan jadwal, koordinasi petugas, pengelolaan pergantian jadwal, dan pemantauan kegiatan ronda secara lebih modern, efisien, dan mudah dipahami.
