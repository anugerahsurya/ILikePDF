import './pdfPolyfills'
import { PDFDocument, EncryptedPDFError } from '@cantoo/pdf-lib'

/*
 * PDF.js is heavy, so it is loaded only when a tool actually needs to
 * render pages. Every call gets its own copy of the bytes because PDF.js
 * transfers (detaches) the buffer it is given to its worker.
 */
let pdfjsPromise = null

export function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = worker.default
      return pdfjs
    })
  }
  return pdfjsPromise
}

export class PdfError extends Error {
  constructor(message, code = 'generic') {
    super(message)
    this.code = code
  }
}

export async function openPdfjs(file, password) {
  const pdfjs = await getPdfjs()
  const data = new Uint8Array(await file.arrayBuffer())
  try {
    return await pdfjs.getDocument({ data, password }).promise
  } catch (err) {
    if (err?.name === 'PasswordException') {
      throw new PdfError('PDF ini dilindungi kata sandi. Buka dulu lewat alat Unlock PDF.', 'locked')
    }
    throw new PdfError(`File tidak bisa dibaca sebagai PDF (${err?.message || 'format rusak'}).`)
  }
}

// PDF.js v6 tears documents down through the loading task.
export function closePdf(pdf) {
  pdf?.loadingTask?.destroy()
}

export async function renderPage(page, scale, { background = '#ffffff' } = {}) {
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.floor(viewport.width))
  canvas.height = Math.max(1, Math.floor(viewport.height))
  const ctx = canvas.getContext('2d', { alpha: !background })
  if (background) {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas
}

export function canvasToBlob(canvas, type = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Gagal membuat gambar'))), type, quality)
  })
}

/*
 * Loads a PDF for editing. PDFs that only carry an owner password
 * (edit/print restrictions, common for official documents) open with an
 * empty user password; PDFs that need a real password are rejected with a
 * pointer to the Unlock tool.
 */
export async function loadEditablePdf(file) {
  const bytes = await file.arrayBuffer()
  try {
    return await PDFDocument.load(bytes)
  } catch (err) {
    if (!(err instanceof EncryptedPDFError)) {
      throw new PdfError(`"${file.name}" tidak bisa dibaca sebagai PDF. File mungkin rusak.`)
    }
  }
  try {
    return await PDFDocument.load(bytes, { password: '' })
  } catch {
    throw new PdfError(`"${file.name}" dilindungi kata sandi. Buka dulu lewat alat Unlock PDF.`, 'locked')
  }
}

export async function savePdf(doc) {
  const bytes = await doc.save({ useObjectStreams: true })
  return new Blob([bytes], { type: 'application/pdf' })
}

export { PDFDocument }
