# ILikePDF (PDF Pro)

Web-based PDF tools for everyday office work. Every process runs in the user's browser, so files are never uploaded to a server.

## Tools

| Tool | What it does |
| --- | --- |
| Gabungkan PDF | Merge several PDFs in a custom order |
| Pisahkan PDF | Split one file per page, by range, in chunks of N pages, or extract selected pages |
| Hapus Halaman | Click the pages to delete from their thumbnails |
| Putar Halaman | Rotate all pages or individual pages, with a preview |
| Kompres PDF | Compress to a size limit (e.g. ≤ 200 KB), by compression level, or lossless; supports multiple files |
| PDF ke Gambar | Convert to JPG/PNG at 96/150/300 DPI, all pages or selected pages |
| Gambar ke PDF | JPG/PNG/WEBP/GIF/BMP → PDF, A4 or original image size |
| Tanda Tangan | Draw or upload a signature, then drag it into place on the page |
| Watermark | Diagonal/center/top/bottom text or a repeating pattern |
| Buka Kunci PDF | Remove the password and edit/print restrictions |

PDFs that only have edit restrictions (common in official documents) can be used directly with every tool. PDFs that need a password to open must be unlocked first.

## Running

```bash
npm install
npm run dev       # development at http://localhost:5173
npm run build     # production build in dist/
npm run preview   # try the production build
```

The output in `dist/` is a static site (it uses `HashRouter` and `base: './'`), so it can be hosted anywhere: GitHub Pages, Netlify, or a plain folder on the office server.

## Stack

React 19 + Vite, [`@cantoo/pdf-lib`](https://github.com/cantoo-scribe/pdf-lib) (pdf-lib fork with encryption/decryption support) for editing, `pdfjs-dist` for rendering pages, `fflate` for ZIP downloads, and `sonner` for notifications.
