# ILikePDF (PDF Pro)

Web-based PDF, Word (`.docx`/`.doc`), and Image tools for everyday office work. Every process runs 100% locally in the user's browser, so files are never uploaded to a server.

## Tools (22 Alat)

### 1. Atur & Susun Halaman PDF
| Tool | What it does |
| --- | --- |
| **Gabungkan PDF** (`/merge`) | Merge several PDFs in a custom order |
| **Pisahkan PDF** (`/split`) | Split one file per page, by range, in chunks of N pages, or extract selected pages |
| **Atur & Urutkan PDF** (`/organize-pdf`) | Reorder pages via drag-and-drop, duplicate pages, insert blank pages, rotate, or delete pages |
| **Hapus Halaman** (`/remove-page`) | Click the pages to delete from their thumbnails |
| **Putar Halaman** (`/rotate`) | Rotate all pages or individual pages, with a preview |
| **Potong Margin PDF** (`/crop-pdf`) | Trim top, bottom, left, and right page margins with a visual crop box |

### 2. Kompres & Konversi Dokumen
| Tool | What it does |
| --- | --- |
| **Kompres PDF** (`/compress`) | Compress to a size limit (e.g. ≤ 200 KB), by compression level, or lossless |
| **PDF ke Word & Teks** (`/pdf-to-word`) | Extract and convert PDF content into editable Word (`.docx`), `.txt`, or `.md` |
| **Word ke PDF** (`/word-to-pdf`) | Convert Microsoft Word (`.docx` / `.doc`) documents into printable PDF |
| **PDF ke Gambar** (`/pdf-to-image`) | Convert to JPG/PNG at 96/150/300 DPI, all pages or selected pages |
| **Gambar ke PDF** (`/image-to-pdf`) | JPG/PNG/WEBP/GIF/BMP → PDF, A4 or original image size |

### 3. Edit, Nomor & Keamanan Dokumen
| Tool | What it does |
| --- | --- |
| **Nomor Halaman** (`/page-numbers`) | Add customizable page numbers at 6 positions with start page & format options |
| **Tanda Tangan** (`/signature`) | Draw or upload a signature, then drag it into place on the page |
| **Watermark PDF** (`/watermark`) | Diagonal/center/top/bottom text or a repeating pattern |
| **Hapus Watermark (PDF & Word)** (`/remove-watermark`) | Strip watermarks, background shapes, metadata, C2PA, and invisible Unicode from **PDF**, **Word (`.docx`/`.doc`)**, text, and images |
| **Sensor / Redaksi PDF** (`/redact-pdf`) | Permanently black-out or white-out sensitive areas (NIK, NIP, account numbers) with optional page flattening |
| **Kunci / Proteksi PDF** (`/protect-pdf`) | Encrypt PDF with AES-256 user/owner passwords and print/copy/edit restrictions |
| **Buka Kunci PDF** (`/unlock`) | Remove the password and edit/print restrictions |

### 4. Alat Gambar & Foto
| Tool | What it does |
| --- | --- |
| **Kompres Gambar** (`/compress-image`) | Batch compress JPG/PNG/WebP to a target KB limit (e.g. ≤ 200 KB) or quality percentage |
| **Ubah Ukuran & Pasfoto** (`/resize-image`) | Resize by pixels, percentage, or Pasfoto 2×3, 3×4, 4×6 cm (300 DPI) presets with rotation & flip |
| **Konversi Format Gambar** (`/convert-image`) | Batch convert between JPG, PNG, and WebP with optional grayscale / document scan contrast filter |
| **Watermark Gambar** (`/watermark-image`) | Add verification or copyright text watermarks (repeating tile, diagonal, center, corner) to images |

## Running

```bash
npm install
npm run dev       # development at http://localhost:5173
npm run build     # production build in dist/
npm run preview   # try the production build
```
