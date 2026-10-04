import os
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
    HRFlowable
)
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super(NumberedCanvas, self).__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super(NumberedCanvas, self).showPage()
        super(NumberedCanvas, self).save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        self.setFont("Helvetica-Bold", 8)
        self.setFillColor(colors.HexColor("#0284c7"))

        # Running Header (Pages 2+)
        if self._pageNumber > 1:
            self.drawString(18 * mm, 283 * mm, "SMARTAMBAK AI")
            self.setFont("Helvetica", 8)
            self.setFillColor(colors.HexColor("#64748b"))
            self.drawString(45 * mm, 283 * mm, "— Panduan Pengujian & Evaluasi 3 Model AI")
            self.setStrokeColor(colors.HexColor("#e2e8f0"))
            self.setLineWidth(0.6)
            self.line(18 * mm, 280 * mm, 192 * mm, 280 * mm)

        # Running Footer (All pages)
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.6)
        self.line(18 * mm, 14 * mm, 192 * mm, 14 * mm)
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#64748b"))
        self.drawString(18 * mm, 10 * mm, "Dokumen Panduan Tester • SMARTAMBAK Computer Vision Research • website-ai-smartambak.vercel.app")
        page_str = f"Halaman {self._pageNumber} dari {page_count}"
        self.setFont("Helvetica-Bold", 8)
        self.drawRightString(192 * mm, 10 * mm, page_str)
        self.restoreState()

def build_pdf(filename="PANDUAN_PENGUJIAN_SMARTAMBAK_AI.pdf"):
    doc = SimpleDocTemplate(
        filename,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm
    )

    styles = getSampleStyleSheet()
    
    # Custom Palette
    c_primary = colors.HexColor("#0f172a")     # Slate 900
    c_cyan = colors.HexColor("#0284c7")        # Sky 600
    c_teal = colors.HexColor("#0f766e")        # Teal 700
    c_slate = colors.HexColor("#334155")       # Slate 700
    c_muted = colors.HexColor("#64748b")       # Slate 500
    c_bg_card = colors.HexColor("#f8fafc")     # Slate 50
    c_bg_warn = colors.HexColor("#fef3c7")     # Amber 100
    c_border_warn = colors.HexColor("#f59e0b") # Amber 500
    c_text_warn = colors.HexColor("#92400e")   # Amber 800

    # Typography styles
    styles.add(ParagraphStyle(
        name="DocHeaderBadge",
        fontName="Helvetica-Bold",
        fontSize=8.5,
        leading=11,
        textColor=c_cyan,
        spaceAfter=3
    ))
    styles.add(ParagraphStyle(
        name="DocTitle",
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=20,
        textColor=c_primary,
        spaceAfter=3
    ))
    styles.add(ParagraphStyle(
        name="DocLead",
        fontName="Helvetica",
        fontSize=8.5,
        leading=12,
        textColor=c_slate,
        spaceAfter=6
    ))
    styles.add(ParagraphStyle(
        name="SectionHeader",
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=c_primary,
        spaceBefore=8,
        spaceAfter=4,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        name="BodyTextCustom",
        fontName="Helvetica",
        fontSize=8,
        leading=11.5,
        textColor=c_slate,
        spaceAfter=4
    ))
    styles.add(ParagraphStyle(
        name="BodyTextBold",
        fontName="Helvetica-Bold",
        fontSize=8,
        leading=11.5,
        textColor=c_primary,
        spaceAfter=2
    ))
    styles.add(ParagraphStyle(
        name="AlertText",
        fontName="Helvetica",
        fontSize=7.8,
        leading=11,
        textColor=c_text_warn
    ))
    styles.add(ParagraphStyle(
        name="AlertTitle",
        fontName="Helvetica-Bold",
        fontSize=8.8,
        leading=12,
        textColor=c_text_warn,
        spaceAfter=2
    ))
    styles.add(ParagraphStyle(
        name="TableHeader",
        fontName="Helvetica-Bold",
        fontSize=7.8,
        leading=10,
        textColor=colors.white,
        alignment=1
    ))
    styles.add(ParagraphStyle(
        name="TableCell",
        fontName="Helvetica",
        fontSize=7.5,
        leading=10,
        textColor=c_slate
    ))
    styles.add(ParagraphStyle(
        name="TableCellBold",
        fontName="Helvetica-Bold",
        fontSize=7.5,
        leading=10,
        textColor=c_primary
    ))

    content_w = 174 * mm
    story = []

    # =========================================================================
    # HALAMAN 1: PENGANTAR, PERHATIAN SERVER & FOKUS 3 MODEL AI
    # =========================================================================
    story.append(Paragraph("SMARTAMBAK AI • PANDUAN PENGUJIAN & EVALUASI SISTEM", styles.DocHeaderBadge))
    story.append(Paragraph("Panduan Lengkap Pengujian Sistem Komparasi 3 Model AI", styles.DocTitle))
    story.append(Paragraph(
        "Dokumen panduan ini disiapkan khusus bagi tester dan mitra evaluator independen untuk menguji sistem kecerdasan buatan (Computer Vision) pendeteksi kesehatan udang tambak pada web portal: <b><u>https://website-ai-smartambak.vercel.app</u></b>",
        styles.DocLead
    ))
    story.append(HRFlowable(width="100%", thickness=0.8, color=colors.HexColor("#e2e8f0"), spaceAfter=6))

    # Alert Box: Scale to zero & ignore pages
    alert_content = [
        [
            Paragraph("<b>[!] PERHATIAN PENTING SEBELUM MEMULAI PENGUJIAN:</b>", styles.AlertTitle)
        ],
        [
            Paragraph(
                "<b>1. Server AI Menggunakan Fitur Scale-to-Zero (Pasti Gagal/Timeout di Percobaan Pertama):</b><br/>"
                "Server model AI (Google Cloud Run) beroperasi dengan sistem hemat daya yang otomatis dimatikan saat idle (scale-to-zero). "
                "Ketika Anda pertama kali membuka web dan mencoba mengirim foto, <b>permintaan pertama kemungkinan besar akan GAGAL atau TIMEOUT (~20–30 detik)</b> karena server sedang proses menyalakan kontainer (cold start).<br/>"
                "<b>&gt; Tindakan Anda:</b> Jangan panik dan jangan menganggap sistem rusak! Cukup tunggu 15–20 detik agar kontainer aktif, lalu tekan kembali tombol <b>\"Deteksi Sekarang\"</b> atau pilih ulang foto Anda. Permintaan kedua dan seterusnya akan berjalan lancar, normal, dan sangat cepat (~1–2 detik).",
                styles.AlertText
            )
        ],
        [
            Paragraph(
                "<b>2. Abaikan Halaman \"Laporan &amp; Log\" dan \"Uji Beban\":</b><br/>"
                "Menu navigasi <b>\"Laporan &amp; Log\"</b> dan <b>\"Uji Beban\"</b> adalah panel administrasi dan analitik internal pengembang. Harap <b>diabaikan</b> selama sesi pengujian. Seluruh fokus pengujian Anda dilakukan pada <b>Halaman Utama (Beranda / Deteksi)</b>.",
                styles.AlertText
            )
        ]
    ]
    t_alert = Table(alert_content, colWidths=[content_w])
    t_alert.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), c_bg_warn),
        ('BOX', (0, 0), (-1, -1), 1, c_border_warn),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 2),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    story.append(t_alert)
    story.append(Spacer(1, 6))

    # Section 1: Karakteristik 3 Model AI
    story.append(Paragraph("1. Tujuan Pengujian & Karakteristik 3 Model AI", styles.SectionHeader))
    story.append(Paragraph(
        "Website ini menjalankan 3 arsitektur model AI secara paralel pada foto yang sama untuk membandingkan presisi deteksi:",
        styles.BodyTextCustom
    ))

    models_data = [
        [
            Paragraph("Model AI", styles.TableHeader),
            Paragraph("Tipe & Karakteristik", styles.TableHeader),
            Paragraph("Detail Output & Kelas Deteksi", styles.TableHeader)
        ],
        [
            Paragraph("<b>Model 1<br/>Multiclass</b>", styles.TableCellBold),
            Paragraph("<b>Penyakit Spesifik</b><br/>Model deteksi komprehensif 7 kelas kondisi udang.", styles.TableCell),
            Paragraph("Mendeteksi udang sehat dan mengklasifikasikan jenis penyakit secara rinci:<br/>"
                      "• <b>healthy</b> (udang sehat)<br/>"
                      "• <b>IMNV</b> (Infectious Myonecrosis / penyakit myo)<br/>"
                      "• <b>WFD</b> (White Feces Disease / kotoran putih)<br/>"
                      "• <b>blackgill</b> (insang hitam)<br/>"
                      "• <b>wssv</b> (White Spot Syndrome Virus / bintik putih)<br/>"
                      "• <b>wssv_bg</b> (komplikasi WSSV &amp; Black Gill)<br/>"
                      "• <b>yellowhead</b> (penyakit kepala kuning)", styles.TableCell)
        ],
        [
            Paragraph("<b>Model 2<br/>Binaryclass</b>", styles.TableCellBold),
            Paragraph("<b>Sehat vs Sakit</b><br/>Klasifikasi biner cepat untuk triase kondisi umum.", styles.TableCell),
            Paragraph("Mengelompokkan kondisi udang secara biner:<br/>"
                      "• <b>healthy</b> (udang sehat)<br/>"
                      "• <b>unhealthy</b> (udang sakit / terindikasi gejala penyakit apapun)", styles.TableCell)
        ],
        [
            Paragraph("<b>Model 3<br/>Baseline (Old)</b>", styles.TableCellBold),
            Paragraph("<b>Model Generasi Lama</b><br/>Model acuan sebelum diterapkannya regularisasi OOD.", styles.TableCell),
            Paragraph("Digunakan sebagai <b>pembanding</b> untuk membuktikan kelemahan arsitektur terdahulu, terutama tingginya frekuensi <i>False Alarm</i> pada objek non-udang.", styles.TableCell)
        ],
    ]
    t_models = Table(models_data, colWidths=[30 * mm, 46 * mm, 98 * mm])
    t_models.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0, 0), (-1, -1), 4.5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg_card])
    ]))
    story.append(t_models)
    story.append(Spacer(1, 6))

    # Section 2: Fokus Inti Pengujian
    story.append(Paragraph("2. Fokus Inti Pengujian: Menguji Deteksi Udang vs Penolakan Gambar Bukan Udang", styles.SectionHeader))
    story.append(Paragraph(
        "Tantangan terbesar sistem visi komputer di tambak adalah <b>False Alarm</b> (salah mendeteksi jari petambak, air keruh, dedaunan, anco kosong, atau pematang tambak sebagai udang). "
        "Model 1 dan Model 2 telah diperkuat dengan regularisasi <i>Null Images</i>:",
        styles.BodyTextCustom
    ))

    hypo_data = [
        [
            Paragraph("Kategori Foto Input", styles.TableHeader),
            Paragraph("Ekspektasi Model 1 &amp; Model 2 (Model Baru)", styles.TableHeader),
            Paragraph("Kelemahan Model 3 (Model Lama)", styles.TableHeader)
        ],
        [
            Paragraph("<b>Gambar BUKAN Udang (Null)</b><br/>(Foto manusia, wajah, tangan, daun, pemandangan, alat tambak, anco kosong)", styles.TableCellBold),
            Paragraph("<b>TIDAK BOLEH MEMUNCULKAN KOTAK SAMA SEKALI (0 Box).</b><br/>Model harus bersih dan cerdas menolak objek selain udang (True Negative).", styles.TableCell),
            Paragraph("Sering memunculkan kotak palsu (False Positive), mendeteksi jari atau objek bulat sebagai udang.", styles.TableCell)
        ],
        [
            Paragraph("<b>Gambar Udang Asli</b><br/>(Foto udang di anco, wadah periksa, kondisi terang atau malam)", styles.TableCellBold),
            Paragraph("<b>Mendeteksi udang dengan jumlah kotak yang presisi</b> sesuai dengan jumlah udang yang terlihat pada foto.", styles.TableCell),
            Paragraph("Sering mengalami selisih jumlah kotak, luput mendeteksi udang bertumpuk, atau salah estimasi kelas.", styles.TableCell)
        ]
    ]
    t_hypo = Table(hypo_data, colWidths=[42 * mm, 66 * mm, 66 * mm])
    t_hypo.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_teal),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0, 0), (-1, -1), 4.5),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg_card])
    ]))
    story.append(t_hypo)

    # Page Break to Page 2
    story.append(PageBreak())

    # =========================================================================
    # HALAMAN 2: PANDUAN PENGGUNAAN & FORMULIR VERIFIKASI AKURASI
    # =========================================================================
    story.append(Paragraph("3. Panduan Alur Pengujian Langkah Demi Langkah", styles.SectionHeader))
    
    steps = [
        ("Langkah 1: Masukkan Foto Sampel Uji",
         "Buka website di smartphone atau komputer. Anda dapat:<br/>"
         "• Memilih tab <b>\"Kamera Langsung\"</b> untuk memotret anco atau kolam secara langsung.<br/>"
         "• Memilih tab <b>\"Unggah Berkas\"</b> untuk menguji foto dari galeri/komputer (sangat disarankan menguji variasi foto udang asli dan foto non-udang).<br/>"
         "• <i>(Fitur Tambahan)</i> Gunakan tombol <b>\"Simulasi\"</b> di pojok kanan atas untuk mensimulasikan kondisi ekstrem (pencahayaan malam, silau terik matahari, kontras rendah, atau air tambak keruh)."),

        ("Langkah 2: Tekan Tombol 'Deteksi Sekarang'",
         "Klik tombol deteksi. Ketiga model akan memproses gambar. "
         "Kotak deteksi (bounding box), nama kelas penyakit, dan confidence score (%) akan muncul pada kartu hasil Model 1, Model 2, dan Model 3."),

        ("Langkah 3: Mengisi Formulir 'Verifikasi Output Model' (Tahap Paling Kritis)",
         "Setelah deteksi ketiga model selesai, gulir ke bagian bawah halaman. Formulir validasi manusia (Human Validation) akan otomatis terbuka.")
    ]

    for title, desc in steps:
        step_table = Table([
            [Paragraph(f"<b>{title}</b>", styles.BodyTextBold)],
            [Paragraph(desc, styles.BodyTextCustom)]
        ], colWidths=[content_w])
        step_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f1f5f9")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ('PADDING', (0, 0), (-1, -1), 4.5),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 1),
        ]))
        story.append(step_table)
        story.append(Spacer(1, 3))

    story.append(Spacer(1, 4))
    story.append(Paragraph("4. Aturan Ketat Pengisian Formulir Verifikasi Model (Checklist Logic)", styles.SectionHeader))
    story.append(Paragraph(
        "Formulir verifikasi adalah instrumen pengumpulan data evaluasi riset kami. Harap ikuti aturan pengisian berikut secara cermat:",
        styles.BodyTextCustom
    ))

    form_rules = [
        ("1. Tentukan Objek Sebenarnya pada Foto (Ground Truth)",
         "Pilih salah satu tombol:<br/>"
         "• <b>[Udang Asli (Objek Target)]</b>: Jika foto yang Anda masukkan memang memuat satu atau lebih udang.<br/>"
         "• <b>[Bukan Udang (Null Image)]</b>: Jika foto memuat objek lain (manusia, wajah, tangan petambak, dedaunan, anco kosong, dinding, kendaraan, dll)."),

        ("2. Isi Jumlah Udang Sebenarnya (Wajib jika memilih 'Udang Asli')",
         "Ketik angka jumlah udang yang terlihat kasat mata di dalam foto pada kolom <b>Ground Truth Count</b> (misalnya: 5 ekor). "
         "Sistem akan langsung menampilkan indikator selisih kotak deteksi AI vs jumlah udang sebenarnya."),

        ("3. Evaluasi Akurasi Masing-Masing Model (Pemberian Centang / Checklist)",
         "<b>ATURAN MUTLAK PEMBERIAN CENTANG PADA KARTU MODEL:</b><br/><br/>"
         "<b>KASUS A: JIKA INPUT ADALAH FOTO UDANG ASLI</b><br/>"
         "• Berikan <b>centang (checklist)</b> HANYA pada model yang menghasilkan deteksi BENAR dan <b>JUMLAH KOTAK (BOX) SESUAI PERSIS</b> dengan jumlah udang riil di foto.<br/>"
         "• <i>Aturan Ketat:</i> Jika di foto ada <b>5 ekor udang</b>, tetapi model hanya memunculkan <b>4 kotak</b> (kurang) atau <b>6 kotak</b> (kelebihan), model tersebut <b>JANGAN DICENTANG</b>.<br/><br/>"
         "<b>KASUS B: JIKA INPUT ADALAH FOTO BUKAN UDANG (NULL IMAGE)</b><br/>"
         "• Berikan <b>centang (checklist)</b> HANYA pada model yang <b>BERSIH / TIDAK MENGELUARKAN KOTAK SAMA SEKALI (0 Box)</b>.<br/>"
         "• <i>Aturan Ketat:</i> Jika Anda memasukkan foto tangan/manusia dan Model 3 memunculkan kotak 'udang', model tersebut <b>SALAH (JANGAN DICENTANG)</b>. Model 1 &amp; 2 yang bersih 0 box adalah yang <b>BENAR (BERIKAN CENTANG)</b>."),

        ("4. Tambahkan Catatan Pengujian (Opsional tapi Sangat Membantu)",
         "Tuliskan catatan singkat mengenai observasi Anda. Contoh catatan bermanfaat:<br/>"
         "• <i>\"Air tambak sangat keruh, udang di sudut anco luput terdeteksi.\"</i><br/>"
         "• <i>\"Model lama salah mendeteksi jari petambak sebagai udang.\"</i><br/>"
         "• <i>\"Dua udang saling menumpuk sehingga hanya terhitung satu kotak.\"</i>"),

        ("5. Simpan &amp; Kirim Evaluasi",
         "Klik tombol <b>\"Simpan &amp; Kirim Evaluasi\"</b>. Data verifikasi beserta foto akan tersimpan ke database cloud. Sistem akan otomatis melakukan reset dan siap untuk pengujian sampel berikutnya.")
    ]

    for title, desc in form_rules:
        r_table = Table([
            [Paragraph(f"<b>{title}</b>", styles.BodyTextBold)],
            [Paragraph(desc, styles.BodyTextCustom)]
        ], colWidths=[content_w])
        r_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#0284c7")),
            ('PADDING', (0, 0), (-1, -1), 4.5),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 1),
        ]))
        story.append(r_table)
        story.append(Spacer(1, 3))

    # Page Break to Page 3
    story.append(PageBreak())

    # =========================================================================
    # HALAMAN 3: MATRIKS KEPUTUSAN CHECKLIST, PENYIMPANAN DATA & FAQ
    # =========================================================================
    story.append(Paragraph("5. Matriks Ringkas: Panduan Keputusan Checklist Model", styles.SectionHeader))
    story.append(Paragraph(
        "Gunakan tabel acuan cepat di bawah ini untuk menentukan apakah suatu model berhak diberi centang (checklist):",
        styles.BodyTextCustom
    ))

    matrix_data = [
        [
            Paragraph("Jenis Foto Input", styles.TableHeader),
            Paragraph("Jumlah Box Deteksi AI", styles.TableHeader),
            Paragraph("Status Akurasi", styles.TableHeader),
            Paragraph("Tindakan Checklist", styles.TableHeader)
        ],
        [
            Paragraph("<b>Foto Udang Asli</b><br/>(misal: ada 3 udang)", styles.TableCellBold),
            Paragraph("Tepat 3 Box", styles.TableCell),
            Paragraph("<font color='#166534'><b>Sangat Tepat (True Positive)</b></font>", styles.TableCell),
            Paragraph("<font color='#166534'><b>[v] CENTANG MODEL</b></font>", styles.TableCellBold)
        ],
        [
            Paragraph("<b>Foto Udang Asli</b><br/>(misal: ada 5 udang)", styles.TableCellBold),
            Paragraph("4 Box (Kurang) / 6 Box (Lebih)", styles.TableCell),
            Paragraph("<font color='#991b1b'><b>Tidak Pas (Discrepancy)</b></font>", styles.TableCell),
            Paragraph("<font color='#991b1b'><b>[X] JANGAN DICENTANG</b></font>", styles.TableCellBold)
        ],
        [
            Paragraph("<b>Foto Udang Asli</b><br/>(misal: ada 2 udang)", styles.TableCellBold),
            Paragraph("0 Box (Luput total)", styles.TableCell),
            Paragraph("<font color='#991b1b'><b>Gagal Deteksi (False Negative)</b></font>", styles.TableCell),
            Paragraph("<font color='#991b1b'><b>[X] JANGAN DICENTANG</b></font>", styles.TableCellBold)
        ],
        [
            Paragraph("<b>Bukan Udang (Null)</b><br/>(Manusia, Daun, Alat)", styles.TableCellBold),
            Paragraph("0 Box (Bersih tanpa kotak)", styles.TableCell),
            Paragraph("<font color='#166534'><b>Sangat Tepat (True Negative)</b></font>", styles.TableCell),
            Paragraph("<font color='#166534'><b>[v] CENTANG MODEL</b></font>", styles.TableCellBold)
        ],
        [
            Paragraph("<b>Bukan Udang (Null)</b><br/>(Manusia, Daun, Alat)", styles.TableCellBold),
            Paragraph("1 Box atau lebih (Kotak palsu)", styles.TableCell),
            Paragraph("<font color='#991b1b'><b>Salah Sasaran (False Positive)</b></font>", styles.TableCell),
            Paragraph("<font color='#991b1b'><b>[X] JANGAN DICENTANG</b></font>", styles.TableCellBold)
        ],
    ]
    t_matrix = Table(matrix_data, colWidths=[42 * mm, 40 * mm, 48 * mm, 44 * mm])
    t_matrix.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), c_primary),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('PADDING', (0, 0), (-1, -1), 4.5),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, c_bg_card])
    ]))
    story.append(t_matrix)
    story.append(Spacer(1, 8))

    # Section 6: Penyimpanan Data & Manfaat Riset
    story.append(Paragraph("6. Penyimpanan Data & Manfaat Riset", styles.SectionHeader))
    story.append(Paragraph(
        "Setiap kali Anda menekan tombol <b>\"Simpan &amp; Kirim Evaluasi\"</b>, sistem secara otomatis mengunggah dan mengarsipkan:<br/>"
        "• Berkas foto asli yang Anda uji.<br/>"
        "• Citra beranotasi bounding box dari masing-masing model.<br/>"
        "• Status ground truth (Udang vs Bukan Udang), jumlah udang sebenarnya, checklist akurasi model, dan catatan tambahan Anda.<br/><br/>"
        "Seluruh data disimpan secara terenkripsi dan aman pada database Supabase Storage. Data ini menjadi aset berharga tim peneliti untuk mengukur metrik kuantitatif (mAP, Precision, Recall, False Positive Rate) dan menyempurnakan bobot model pada tahap pelatihan berikutnya.",
        styles.BodyTextCustom
    ))
    story.append(Spacer(1, 6))

    # Section 7: FAQ & Tips Praktis Tester
    story.append(Paragraph("7. Pertanyaan Sering Diajukan (FAQ) & Tips Pengujian", styles.SectionHeader))
    
    faq_items = [
        ("T: Berapa banyak foto yang disarankan untuk diuji oleh satu orang tester?",
         "J: Kami menyarankan minimal <b>5–10 foto udang</b> (dengan variasi jumlah ekor berbeda) dan <b>5–10 foto bukan udang</b> (foto manusia, tangan petambak, dedaunan, anco kosong, lantai, dinding, dll). Semakin beragam variasi input yang Anda coba, semakin kuat evaluasi model."),

        ("T: Mengapa kamera iPhone Safari kadang menampilkan layar hitam?",
         "J: Safari iOS terkadang memerlukan konfirmasi izin kamera. Jika tampilan hitam, cukup sentuh tombol putar kamera (kamera depan lalu balik ke belakang) atau segarkan halaman browser Anda."),

        ("T: Apakah saya boleh mencoba foto dari Google Image atau foto lama?",
         "J: Sangat boleh! Anda dapat mengunduh foto udang berkualitas rendah/tinggi atau foto objek acak lainnya dari internet dan mengunggahnya melalui menu 'Unggah Berkas'.")
    ]

    for q, a in faq_items:
        faq_table = Table([
            [Paragraph(f"<b>{q}</b>", styles.BodyTextBold)],
            [Paragraph(a, styles.BodyTextCustom)]
        ], colWidths=[content_w])
        faq_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
            ('BOX', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('PADDING', (0, 0), (-1, -1), 4),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 1),
        ]))
        story.append(faq_table)
        story.append(Spacer(1, 3))

    story.append(Spacer(1, 6))

    # Footer thank you box
    footer_box = Table([
        [Paragraph(
            "<font color='#0284c7'><b>TERIMA KASIH ATAS KONTRIBUSI ANDA!</b></font><br/>"
            "Waktu, ketelitian, dan umpan balik riil Anda sangat berarti bagi pengembangan teknologi kecerdasan buatan akuakultur presisi di Indonesia.<br/>"
            "<i>Tim Riset SMARTAMBAK • 2026</i>",
            styles.TableCellBold
        )]
    ], colWidths=[content_w])
    footer_box.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#e0f2fe")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#0284c7")),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
    ]))
    story.append(footer_box)

    doc.build(story, canvasmaker=NumberedCanvas)
    print(f"✅ PDF berhasil dibuat: {filename}")

if __name__ == "__main__":
    out_pdf = "PANDUAN_PENGUJIAN_SMARTAMBAK_AI.pdf"
    if len(sys.argv) > 1:
        out_pdf = sys.argv[1]
    build_pdf(out_pdf)
