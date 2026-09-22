# AGENT CONTEXT & SYSTEM DOCUMENTATION

Dokumen ini ditujukan sebagai panduan komprehensif bagi **AI Agent** yang melanjutkan pengembangan, pemeliharaan, atau debugging proyek **Smart Ambak AI** pada sesi baru.

---

## 1. Ringkasan Proyek & Tujuan

- **Nama Proyek**: Smart Ambak AI (Shrimp Disease Detection & Verification System)
- **Domain**: Akuakultur / Tambak Udang Modern
- **Tujuan Utama**:
  1. Melakukan deteksi penyakit udang secara simultan menggunakan 3 model AI Ultralytics di lapangan via perangkat *mobile*.
  2. Memberikan evaluasi komparasi real-time antara model AI vs keputusan pakar (*Human-in-the-Loop*).
  3. Menguji keandalan model terhadap foto udang asli (*positive samples*) maupun objek non-udang (*null / negative samples* seperti air kolam, lumut, pakan, tangan, pipa).
  4. Menyediakan fitur ekspor dataset 1-klik berformat resmi YOLO untuk pelatihan *background/null images* guna mengeliminasi *false positive*.

---

## 2. Arsitektur Teknis & Tech Stack

- **Framework**: Next.js 14.2.x (App Router, TypeScript)
- **Styling**: Tailwind CSS (Mobile-First, PWA-Ready layout)
- **Ikonografi**: Lucide React Icons
- **Database & Storage**: Supabase (`@supabase/supabase-js`)
- **Arsip & Ekspor**: JSZip (`jszip`)
- **Hosting / Deployment**: Vercel Production
  - **Live URL**: `https://website-ai-smartambak.vercel.app`
  - **Remote GitHub**: `git@github.com:AbiyaMakruf/SMARTAMBAK-WEB-AI.git` (Branch: `main`)

---

## 3. Komponen Kunci & File Structure

```
website-ai-smartambak/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── predict/route.ts          # Proxy inferensi paralel 3 model & multi-key fallback
│   │   │   ├── report/delete/route.ts    # Endpoint hapus sampel tertentu (Password "Abiyajr11")
│   │   │   ├── report/reset/route.ts     # Endpoint reset seluruh data (Password "Abiyajr11")
│   │   │   └── report/verify-admin/route.ts # Endpoint verifikasi password admin
│   │   ├── globals.css                   # Styling global & mobile safe-area
│   │   ├── layout.tsx                    # Mobile root layout & meta viewport
│   │   ├── page.tsx                      # Halaman deteksi utama & alur verifikasi
│   │   └── report/page.tsx               # Dashboard analitik, chart dinamis, admin mode, filter
│   ├── components/
│   │   ├── CameraCapture.tsx             # Kamera live Safari iOS (WYSIWYG 1:1) & galeri
│   │   ├── HumanDecisionBox.tsx          # Form ground-truth udang vs null, real count, & tags
│   │   ├── ImageEditorModal.tsx          # Simulasi kondisi ekstrem (kecerahan, kontras, keruh)
│   │   ├── ModelResultCard.tsx           # Kartu output model AI & bounding box overlay
│   │   ├── Navbar.tsx                    # Header & bottom navigation mobile
│   │   └── SampleDetailModal.tsx         # Visualizer 4-gambar (Asli, AI 1, 2, 3), canvas render
│   ├── lib/
│   │   ├── annotator.ts                  # Render bounding box ke Canvas & export JPEG blob
│   │   ├── imageCompressor.ts            # Client-side canvas compression (max 1280px, 85% JPEG)
│   │   └── supabase.ts                   # Inisialisasi Supabase client & admin
│   └── types/
│       └── prediction.ts                 # Tipe TypeScript (Ultralytics response, DB schema, stats)
├── supabase/
│   └── schema.sql                        # Skema SQL tabel shrimp_predictions & RLS policies
├── env.zip                               # Backup terenkripsi .env.local (Password: "Yiis5413", Hint: "Yii***")
├── .env.example                          # Template variabel lingkungan
├── agent.md                              # Dokumen panduan AI Agent ini
└── README.md                             # Dokumentasi publik proyek
```

---

## 4. Konfigurasi 3 Model Ultralytics & Strategi Multi-Key

Endpoint model berjalan di Google Cloud Run:
1. **Model 1 (Multiclass - Penyakit Spesifik)**:
   - Endpoint: `https://predict-6aaf79e0866ab0ecc4f0c857-dproatj77a-et.a.run.app`
   - Kelas deteksi: `['IMNV', 'WFD', 'blackgill', 'healthy', 'wssv', 'wssv_bg', 'yellowhead']`
2. **Model 2 (Binaryclass - Sehat vs Sakit)**:
   - Endpoint: `https://predict-6aaf79c7d652d8bbb378ed0c-dproatj77a-et.a.run.app`
3. **Model 3 (Baseline / Old Model)**:
   - Endpoint: `https://predict-6a0e0767af1f97748662-dproatj77a-et.a.run.app`

### Strategi Multi-Key Auto-Fallback (`src/app/api/predict/route.ts`):
- Model 1 & 2 terdaftar di akun dengan key utama (lihat `env.zip` / `ULTRALYTICS_API_KEY`).
- Model 3 terdaftar di akun lama dengan key fallback (lihat `env.zip` / `ULTRALYTICS_FALLBACK_KEY`).
- Sistem proxy `/api/predict` menggunakan `preferredKey` untuk masing-masing model. Jika endpoint mengembalikan status **HTTP 401 Unauthorized**, server secara otomatis melakukan *retry* dengan *alternate key*. Hal ini menjamin ketiga model dapat diinferensi secara paralel tanpa error 401.

---

## 5. Arsitektur Kamera Mobile & Solusi Bug Safari iOS

Diimplementasikan di `src/components/CameraCapture.tsx`:
1. **Pencegahan Layar Hitam di Safari iOS**:
   - Safari iOS mewajibkan atribut DOM `playsinline="true"` dan `webkit-playsinline="true"`.
   - `video.play()` dipanggil di dalam event listener `video.onloadedmetadata` (bukan langsung seketika stream didapat).
   - Menghindari constraint resolusi kaku (seperti `1920x1080` landscape) yang sering macet di orientasi portrait ponsel; menggunakan `width: { ideal: 1280 }` dengan fallback bertahap.
2. **True 1:1 WYSIWYG (Preview Tanpa Crop Zoom)**:
   - Wadah video mengadopsi rasio aspek sensor video asli secara dinamis (`videoWidth / videoHeight`).
   - Menggunakan `object-contain` dan meniadakan `object-cover` agar bagian atas, bawah, kiri, dan kanan tidak terpotong.
   - Hasil jepretan kanvas berukuran persis 100% sama dengan tampilan di layar.
3. **Kompresi Canvas Otomatis**:
   - Mereduksi foto 8–15 MB menjadi 150–250 KB sebelum dikirim ke server/storage, sangat hemat bandwidth lapangan.

---

## 6. Logika Ground Truth, Real Count, & Catatan Lapangan

Diimplementasikan di `src/components/HumanDecisionBox.tsx`:
- Box evaluasi **hanya muncul setelah seluruh model selesai inferensi**.
- **Ground Truth Target**:
  - **Udang Asli**: Diharapkan ada bounding box ($\ge 1$). Jika ada $\rightarrow$ True Positive (Akurat). Jika 0 box $\rightarrow$ False Negative (Luput).
  - **Bukan Udang (Null Image)**: Diharapkan 0 bounding box. Jika 0 box $\rightarrow$ True Negative (Akurat). Jika muncul box $\rightarrow$ **False Positive (Salah Deteksi)**.
- **Jumlah Udang Sebenarnya (Real Count)**:
  - Teknisi lapangan dapat mengisi jumlah udang riil (misal: 5 ekor).
  - Sistem menampilkan diagnosis selisih bounding box secara real-time: apakah model kekurangan box atau kelebihan box.
- **Preset Catatan Cepat**:
  - Tombol tag cepat (`+ Jumlah box tidak sesuai`, `+ Udang bertumpuk`, `+ False positive pada lumut/gelembung`, `+ Air keruh`, `+ Silau terik`).
  - Disimpan dengan format `[Riil: X Udang] <catatan>` di kolom `notes` serta di dalam metadata `model_1_output.real_shrimp_count`.

---

## 7. Fitur Simulasi Kondisi Ekstrem / Edit Gambar (`src/components/ImageEditorModal.tsx`)

- Memungkinkan pengguna menguji ketahanan model pada skenario lapangan ekstrem sebelum diinferensi:
  - **Brightness (Kecerahan)**: -80% s/d +80% (menguji minim cahaya malam vs silau matahari).
  - **Contrast (Kontras)**: -60% s/d +80% (menguji bayangan keras & kontras tinggi).
  - **Saturation (Saturasi)**: -80% s/d +80%.
  - **Pond Turbidity (Kekeruhan Air Kolam)**: Simulasi air tambak berwarna kecokelatan/keruh dan berkabut.
  - **Preset Cepat**: Normal, Malam / Gelap, Silau Terik, Air Keruh, dan Kontras Tinggi.
- Menggunakan HTML5 Canvas filter dan menghasilkan file baru yang langsung diinferensi ulang ke 3 model AI.

---

## 8. Dashboard Laporan, Mode Admin, & Visualizer 4-Gambar (`src/app/report/page.tsx`)

1. **Akses Mode Admin & Hapus Sampel Tertentu**:
   - Password Admin: `Abiyajr11` (sama dengan password reset seluruh data).
   - Verifikasi melalui endpoint `POST /api/report/verify-admin`. Status login disimpan di `sessionStorage`.
   - Menampilkan badge "Admin Aktif" dan tombol hapus individual (`🗑️ Hapus`) per sampel di kartu daftar dan modal detail.
   - Endpoint penghapusan single record: `POST /api/report/delete` (menghapus baris DB dan file di Supabase Storage).
2. **Visualisasi Ulang 4 Gambar (Asli + Model AI 1, 2, 3)**:
   - Diimplementasikan di `src/components/SampleDetailModal.tsx`.
   - Menggunakan helper `src/lib/annotator.ts` untuk merender canvas beranotasi bounding box dinamis (bekerja untuk semua sampel baru maupun riwayat lama).
   - Tab interaktif: `[Foto Asli]`, `[Model 1: Multiclass]`, `[Model 2: Binary]`, `[Model 3: Baseline]`.
   - Tombol download dinamis: mengunduh foto asli atau foto hasil anotasi AI model yang sedang aktif dalam format JPEG.
3. **1-Klik Ekspor Dataset YOLO Null Images**:
   - Mengemas seluruh gambar non-udang / salah deteksi ke file `.zip`.
   - Otomatis membuatkan file `.txt` kosong di folder `labels/` (format standar YOLO Ultralytics untuk background images).
   - Menyertakan file `dataset.yaml` dan panduan perintah CLI training.
4. **Fitur Reset Seluruh Database Terproteksi Password**:
   - Endpoint: `POST /api/report/reset` (Password: `Abiyajr11`).

---

## 9. Supabase Database & Storage

- **Instance URL**: `https://pkzqlpbhvuiezesstlmz.supabase.co`
- **Storage Bucket**: `smartambak` (Public)
- **Tabel**: `shrimp_predictions`
  Skema SQL lengkap dan policy RLS tersedia di [`supabase/schema.sql`](file:///home/abiyamf/Documents/website-ai-smartambak/supabase/schema.sql).

---

## 10. Penanganan Kredensial & Environment Variables

- File `.env.local` disimpan dalam arsip zip terenkripsi:
  - **File**: `env.zip`
  - **Password**: `Yiis5413`
  - **Hint**: `Yii***`
- Untuk mengekstrak file env di komputer baru:
  ```bash
  unzip -P "Yiis5413" env.zip
  ```
- File `.gitignore` dikonfigurasi untuk secara ketat mengecualikan `.env`, `.env.local`, dan `.env*.local` agar kredensial mentah tidak pernah ter-push ke repository publik.
