# SMART AMBAK AI — Shrimp Disease Detection & Field Validation System

Aplikasi web *mobile-friendly* modern berbasis **Next.js 14 (App Router)**, **Tailwind CSS**, **Lucide Icons**, dan **@supabase/supabase-js** yang di-deploy ke Vercel. Dirancang khusus untuk operasional tambak udang dalam membandingkan 3 model AI Ultralytics secara paralel dengan verifikasi manusia (*Human-in-the-Loop*).

- 🌐 **Live Production URL**: [https://website-ai-smartambak.vercel.app](https://website-ai-smartambak.vercel.app)
- 📊 **Halaman Laporan & Log**: [https://website-ai-smartambak.vercel.app/report](https://website-ai-smartambak.vercel.app/report)
- 📦 **Repository GitHub**: [git@github.com:AbiyaMakruf/SMARTAMBAK-WEB-AI.git](https://github.com/AbiyaMakruf/SMARTAMBAK-WEB-AI)

---

## 📸 Fitur Utama

### 1. Mobile-First & Kamera Lapangan (Safari iPhone Ready)
- **Akses Kamera Langsung**: Dukungan kamera depan dan belakang (`facingMode`) dengan tombol pembalik kamera sentuh.
- **Bebas Bug Safari iOS**: Dioptimalkan khusus untuk WebKit Safari iPhone (pencegahan layar hitam dengan pengikatan `onloadedmetadata` dan atribut DOM `playsinline`).
- **1:1 True WYSIWYG**: Preview video mengadopsi rasio sensor asli perangkat tanpa *crop zoom* (`object-contain`). Hasil foto yang terambil 100% sama persis dengan apa yang terlihat di layar.
- **Kompresi Client-Side Otomatis (HTML5 Canvas)**: Mereduksi ukuran foto resolusi tinggi kamera (8–15 MB) menjadi ~150–250 KB (hemat data >90%) sebelum diunggah ke server.

### 2. Inferensi Paralel 3 Model Ultralytics (Anti-CORS)
- **Next.js Route Handler Proxy** (`/api/predict`): Menjalankan inferensi ke 3 model Google Cloud Run secara simultan via `Promise.allSettled()`. Mengeliminasi kendala CORS browser dan melindungi API key di sisi server.
- **Model yang Terhubung**:
  1. **Model 1 (Multiclass)**: Deteksi penyakit spesifik (*WSSV, IMNV, WFD, Black Gill, Yellowhead, Healthy*).
  2. **Model 2 (Binaryclass)**: Klasifikasi cepat kondisi umum (*Sehat vs Sakit*).
  3. **Model 3 (Baseline / Old Model)**: Model acuan historis.
- **Mekanisme Multi-Key & Auto-Fallback**: Server otomatis melakukan *retry* dengan kunci alternatif jika terjadi error HTTP 401 Unauthorized.
- **Visualisasi Hasil**: Bounding box SVG dinamis berskala ternormalisasi, badge warna tematik per penyakit, dan indikator latensi inferensi (*speed* dalam ms).

### 3. Human Verification & Ground Truth Box
- **Alur Pasca-Deteksi**: Form evaluasi cerdas hanya muncul setelah model selesai menganalisis gambar.
- **Klasifikasi Objek**:
  - **Udang Asli (Positive Sample)** $\rightarrow$ Menilai True Positive (Akurat) vs False Negative (Luput).
  - **Bukan Udang (Null/Negative Sample)** $\rightarrow$ Menilai True Negative (Akurat / Bersih) vs False Positive (Salah Deteksi).
- **Simpan ke Server**: Mengunggah foto ke Supabase Storage (`smartambak`) dan menyimpan log ke tabel `shrimp_predictions`.

### 4. Laporan, Analitik & Ekspor Dataset YOLO (`/report`)
- **Metrik Komprehensif**: Total sampel, rasio Udang vs Null Images, jumlah kesalahan (*Error count*) per model, dan *False Positive count*.
- **Grafik Dinamis**:
  - 📊 Stacked bar chart komparasi akurasi vs tingkat kesalahan antar 3 model.
  - ⚡ Visualisasi waktu inferensi (Cloud Run latency dalam ms).
  - 🏷️ Distribusi diagnosis kelas penyakit.
- **1-Klik Ekspor Dataset YOLO Null Images**:
  - Mengunduh seluruh gambar non-udang / salah deteksi ke dalam arsip `.zip`.
  - Berisi folder `images/`, folder `labels/` dengan file `.txt` kosong (standar resmi Ultralytics YOLO untuk *background training*), `dataset.yaml`, dan panduan CLI untuk *fine-tuning* model.
- **Reset Data Terproteksi Password**:
  - Tombol reset dengan otentikasi password admin (`Abiyajr11`) untuk membersihkan data pengujian.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 14.2.15 (App Router, React 18, TypeScript)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Backend & Database**: Supabase (`@supabase/supabase-js`)
- **Arsip & Zip**: JSZip (`jszip`)
- **Hosting**: Vercel Serverless Edge

---

## 🚀 Setup & Instalasi Lokal

### 1. Clone Repository
```bash
git clone git@github.com:AbiyaMakruf/SMARTAMBAK-WEB-AI.git
cd SMARTAMBAK-WEB-AI
```

### 2. Ekstrak Environment Variables
File environment lokal tersimpan dalam arsip terenkripsi `env.zip`:
```bash
unzip -P "Yiis5413" env.zip
```
> 💡 **Password Hint**: `Yii***`

Atau buat file `.env.local` secara manual mengacu pada [`.env.example`](.env.example):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET=smartambak

NEXT_PUBLIC_MODEL_1_URL=https://predict-multiclass-model.a.run.app
NEXT_PUBLIC_MODEL_2_URL=https://predict-binaryclass-model.a.run.app
NEXT_PUBLIC_MODEL_3_URL=https://predict-oldmodel.a.run.app

ULTRALYTICS_API_KEY=ul_your_api_key_here
```

### 3. Install Dependensi & Jalankan
```bash
npm install
npm run dev
```
Buka browser di `http://localhost:3000` (disarankan menggunakan mode responsif/inspeksi tampilan ponsel).

---

## 🗄️ Setup Database Supabase

Jalankan skrip berikut pada menu **SQL Editor** di dashboard Supabase project Anda:

```sql
CREATE TABLE IF NOT EXISTS shrimp_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  image_url TEXT NOT NULL,
  model_1_output JSONB,
  model_2_output JSONB,
  model_3_output JSONB,
  human_is_shrimp BOOLEAN NOT NULL,
  selected_models TEXT[] DEFAULT '{}',
  notes TEXT
);

ALTER TABLE shrimp_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous select" ON shrimp_predictions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "Allow anonymous insert" ON shrimp_predictions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow anonymous delete" ON shrimp_predictions
  FOR DELETE TO anon, authenticated USING (true);
```

### Storage Bucket:
- Buat bucket bernama `smartambak` dan aktifkan opsi **Public Bucket**.

---

## ☁️ Deployment ke Vercel

Proyek ini telah dikonfigurasi untuk deployment instan ke Vercel.

```bash
# Build lokal untuk pengujian
npm run build

# Deploy ke production
npx vercel --prod
```

---

## 📄 Panduan AI Agent

Untuk instruksi rinci mengenai arsitektur internal, silakan baca dokumentasi [**`agent.md`**](agent.md).
