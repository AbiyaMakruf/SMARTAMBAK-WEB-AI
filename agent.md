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
│   │   │   ├── predict/route.ts      # Proxy inferensi paralel 3 model & multi-key fallback
│   │   │   └── report/reset/route.ts # Endpoint reset data terproteksi password "Abiyajr11"
│   │   ├── globals.css               # Styling global & mobile safe-area
│   │   ├── layout.tsx                # Mobile root layout & meta viewport
│   │   ├── page.tsx                  # Halaman deteksi utama & alur verifikasi
│   │   └── report/page.tsx           # Dashboard analitik, chart dinamis, filter, 1-klik YOLO zip
│   ├── components/
│   │   ├── CameraCapture.tsx         # Kamera live Safari iOS (WYSIWYG 1:1) & galeri
│   │   ├── HumanDecisionBox.tsx      # Form ground-truth udang vs null & auto-suggestion
│   │   ├── ModelResultCard.tsx       # Kartu output model AI & bounding box overlay
│   │   └── Navbar.tsx                # Header & bottom navigation mobile
│   ├── lib/
│   │   ├── imageCompressor.ts        # Client-side canvas compression (max 1280px, 85% JPEG)
│   │   └── supabase.ts               # Inisialisasi Supabase client & admin
│   └── types/
│       └── prediction.ts             # Tipe TypeScript (Ultralytics response, DB schema, stats)
├── supabase/
│   └── schema.sql                    # Skema SQL tabel shrimp_predictions & RLS policies
├── env.zip                           # Backup terenkripsi .env.local (Password: "Yiis5413", Hint: "Yii***")
├── .env.example                      # Template variabel lingkungan
├── agent.md                          # Dokumen panduan AI Agent ini
└── README.md                         # Dokumentasi publik proyek
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

## 6. Logika Ground Truth & Evaluasi Pasca-Inferensi

Diimplementasikan di `src/components/HumanDecisionBox.tsx`:
- Box evaluasi **hanya muncul setelah seluruh model selesai inferensi**.
- Pertanyaan Ground Truth:
  - **Udang Asli**: Diharapkan ada bounding box ($\ge 1$). Jika ada $\rightarrow$ True Positive (Akurat). Jika 0 box $\rightarrow$ False Negative (Luput).
  - **Bukan Udang (Null Image)**: Diharapkan 0 bounding box. Jika 0 box $\rightarrow$ True Negative (Akurat). Jika muncul box $\rightarrow$ **False Positive (Salah Deteksi)**.
- Foto-foto yang tergolong *False Positive* atau *Null Image* otomatis ditandai untuk kebutuhan pelatihan *background dataset*.

---

## 7. Dashboard Analitik & Ekspor Dataset YOLO (`src/app/report/page.tsx`)

1. **Metrik & Grafik**:
   - Confusion matrix count (True Positive, True Negative, False Positive, False Negative).
   - Per-model Error Count & Accuracy %.
   - Per-model Average Latency Speed (ms).
   - Stacked dynamic bar chart & latency bar chart.
2. **1-Klik Ekspor Dataset YOLO Null Images**:
   - Mengemas seluruh gambar non-udang / salah deteksi ke file `.zip`.
   - Otomatis membuatkan file `.txt` kosong di folder `labels/` (format standar YOLO Ultralytics untuk background images).
   - Menyertakan file `dataset.yaml` dan panduan perintah CLI training.
3. **Fitur Reset Database Terproteksi Password**:
   - Endpoint: `POST /api/report/reset`
   - Password: `Abiyajr11`
   - Menghapus seluruh rekaman dari tabel Supabase `shrimp_predictions` menggunakan service role admin.

---

## 8. Supabase Database & Storage

- **Instance URL**: `https://pkzqlpbhvuiezesstlmz.supabase.co`
- **Storage Bucket**: `smartambak` (Public)
- **Tabel**: `shrimp_predictions`
  Skema SQL lengkap dan policy RLS tersedia di [`supabase/schema.sql`](file:///home/abiyamf/Documents/website-ai-smartambak/supabase/schema.sql).

---

## 9. Penanganan Kredensial & Environment Variables

- File `.env.local` disimpan dalam arsip zip terenkripsi:
  - **File**: `env.zip`
  - **Password**: `Yiis5413`
  - **Hint**: `Yii***`
- Untuk mengekstrak file env di komputer baru:
  ```bash
  unzip -P "Yiis5413" env.zip
  ```
- File `.gitignore` dikonfigurasi untuk secara ketat mengecualikan `.env`, `.env.local`, dan `.env*.local` agar kredensial mentah tidak pernah ter-push ke repository publik.
