# Ronda Alamadani

Ronda Alamadani adalah aplikasi web untuk membantu pengelolaan jadwal ronda warga secara lebih rapi, cepat, dan mudah dipantau. Aplikasi ini mendukung kebutuhan admin, koordinator, dan warga dalam melihat jadwal, mengelola pergantian petugas, memproses permintaan perubahan jadwal, serta memantau pelaksanaan ronda bulanan dalam satu dashboard.

## Gambaran singkat

Fokus utama aplikasi ini adalah menyederhanakan proses operasional ronda yang biasanya dilakukan secara manual. Dengan aplikasi ini, pengelola lingkungan dapat:

- melihat jadwal ronda bulanan dalam tampilan yang mudah dibaca,
- membuat atau menghasilkan jadwal ronda bulanan,
- mengelola data warga, koordinator, dan petugas cadangan,
- memproses permintaan pergantian jadwal dari warga,
- menyimpan riwayat dan memantau perubahan jadwal,
- memanfaatkan bantuan AI untuk memberi saran kepada koordinator.

## Fitur utama

### Dashboard utama

- Menampilkan ringkasan jadwal ronda per bulan.
- Menyediakan metrik seperti jumlah hari terjadwal, total baris jadwal, dan support person.
- Mendukung pencarian nama warga dan filter periode jadwal.

### Manajemen jadwal ronda

- Menampilkan daftar ronda harian warga.
- Mendukung penandaan petugas pengganti.
- Membantu admin mengelola jadwal bulanan dengan tampilan yang lebih terstruktur.

### Manajemen permintaan perubahan jadwal

- Warga dapat mengajukan permintaan perubahan atau pergantian jadwal ronda.
- Koordinator atau admin dapat meninjau dan memproses permintaan tersebut.

### Manajemen admin

- Kelola data pengguna atau warga.
- Kelola backup atau pengganti ronda.
- Kelola koordinator ronda.
- Kelola riwayat jadwal dan ekspor data jadwal.

### Bantuan AI untuk koordinator

- Menyediakan saran cerdas untuk membantu pengambilan keputusan terkait jadwal.
- Digunakan sebagai alat bantu, bukan pengganti keputusan akhir koordinator.

### Integrasi database dan health check

- Menggunakan Firebase untuk data utama dan autentikasi yang dibutuhkan aplikasi.
- Menyediakan pengecekan koneksi database MySQL melalui endpoint health check.

## Teknologi yang digunakan

Project ini dibangun menggunakan stack berikut:

- **Next.js 15** untuk framework aplikasi web
- **React 19** untuk UI
- **TypeScript** untuk type safety
- **Tailwind CSS** untuk utility styling
- **Bootstrap 5** untuk dukungan styling dan komponen visual tertentu
- **Firebase** untuk layanan aplikasi dan data client-side
- **MySQL / mysql2** untuk koneksi database tambahan
- **Genkit + Google AI** untuk fitur asisten AI
- **React Hook Form + Zod** untuk form handling dan validasi

## Struktur folder penting

Berikut beberapa folder utama yang paling penting untuk dipahami:

- `src/app/` — routing dan halaman utama aplikasi berbasis Next.js App Router
- `src/app/(app)/admin/` — halaman dan fitur untuk admin
- `src/app/(app)/coordinator/` — halaman untuk koordinator
- `src/app/(app)/dashboard/` — dashboard utama jadwal ronda
- `src/app/(app)/schedule/request/` — form permintaan perubahan jadwal
- `src/components/` — komponen UI yang dipakai ulang
- `src/firebase/` — konfigurasi dan helper integrasi Firebase
- `src/lib/` — utilitas, helper data, tipe, dan koneksi MySQL
- `src/ai/` — konfigurasi Genkit dan flow AI
- `docs/` — dokumen pendukung seperti blueprint aplikasi

## Menjalankan project secara lokal

### 1. Install dependency

Jalankan install package terlebih dahulu menggunakan package manager yang sesuai dengan lockfile project ini.

### 2. Siapkan environment

File `.env` sudah tersedia di root project. Pastikan nilai environment yang dibutuhkan sudah terisi dengan benar, terutama untuk:

- koneksi database melalui `DATABASE_URL`,
- kredensial atau API key yang dibutuhkan untuk fitur AI / Genkit.

Jika nilai environment belum valid, beberapa fitur seperti koneksi database atau AI tidak akan berjalan semestinya.

### 3. Jalankan mode development

Mode development akan menjalankan aplikasi Next.js di port **9002**.

## Scripts yang tersedia

Script utama di project ini:

- `npm run dev` — menjalankan aplikasi dalam mode development pada port `9002`
- `npm run build` — build aplikasi untuk production
- `npm run start` — menjalankan hasil build production
- `npm run lint` — menjalankan linting
- `npm run typecheck` — mengecek error TypeScript tanpa build
- `npm run genkit:dev` — menjalankan environment AI Genkit
- `npm run genkit:watch` — menjalankan Genkit dengan mode watch

## Alur penggunaan singkat

Secara umum alur penggunaan aplikasi adalah sebagai berikut:

1. Admin atau pengelola masuk ke aplikasi.
2. Data warga dan peran pengguna dikelola dari panel admin.
3. Jadwal ronda bulanan dibuat atau diperbarui.
4. Warga melihat jadwal masing-masing.
5. Jika ada kendala, warga dapat mengajukan permintaan perubahan jadwal.
6. Koordinator meninjau permintaan dan dapat menggunakan saran AI sebagai pertimbangan.
7. Jadwal final dipantau dari dashboard utama.

## Endpoint penting

- `GET /api/health/database` — mengecek status koneksi database MySQL

## Catatan pengembangan

- Project ini menggunakan **App Router** milik Next.js.
- Komponen UI disusun agar bisa dipakai ulang di berbagai halaman.
- Dokumentasi dan blueprint awal tersedia di folder `docs/`.
- Perubahan pada README ini tidak mengubah fungsi aplikasi, hanya memperjelas dokumentasi project.

## Ringkasan

Ronda Alamadani adalah aplikasi manajemen ronda warga yang dirancang untuk membantu pengaturan jadwal, koordinasi petugas, pengelolaan pergantian jadwal, dan pemantauan kegiatan ronda secara lebih modern dan efisien.
