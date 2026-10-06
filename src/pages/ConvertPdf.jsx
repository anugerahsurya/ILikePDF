import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconFileText } from '../components/Icons'
import { PDFDocument, savePdf, canvasToBlob } from '../utils/pdfConfig'
import { moveItem, withIds } from '../utils/files'

const IMAGES = { 'image/jpeg': ['.jpg', '.jpeg'], 'image/png': ['.png'], 'image/webp': ['.webp'], 'image/gif': ['.gif'], 'image/bmp': ['.bmp'] }
const A4 = [595.28, 841.89]

const SIZES = [
  { value: 'a4', label: 'A4', hint: 'Gambar dimuat ke kertas A4' },
  { value: 'fit', label: 'Ikuti gambar', hint: 'Ukuran halaman = ukuran gambar' },
]
const MARGINS = [
  { value: 0, label: 'Tanpa margin' },
  { value: 28, label: 'Kecil' },
  { value: 56, label: 'Besar' },
]

async function loadBitmap(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return img
  } finally {
    URL.revokeObjectURL(url)
  }
}

// PNG and JPG embed as-is; other formats are redrawn as JPG first.
async function embedImage(doc, file) {
  const type = file.type || ''
  const bytes = await file.arrayBuffer()
  if (type === 'image/png') return doc.embedPng(bytes)
  if (type === 'image/jpeg') return doc.embedJpg(bytes)
  const img = await loadBitmap(file)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img, 0, 0)
  return doc.embedJpg(await (await canvasToBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer())
}

export default function ImageToPdf() {
  const [items, setItems] = useState([])
  const [size, setSize] = useState('a4')
  const [margin, setMargin] = useState(28)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const itemsRef = useRef(items)
  itemsRef.current = items
  useEffect(() => () => itemsRef.current.forEach(i => URL.revokeObjectURL(i.thumb)), [])

  const addFiles = files =>
    setItems(prev => [...prev, ...withIds(files).map(i => ({ ...i, thumb: URL.createObjectURL(i.file) }))])

  const convert = async () => {
    setBusy(true)
    try {
      const doc = await PDFDocument.create()
      for (const { file } of items) {
        const img = await embedImage(doc, file)
        // 1 px = 0.75 pt (96 DPI), so "fit" pages match the image's on-screen size.
        const w = img.width * 0.75
        const h = img.height * 0.75
        if (size === 'fit') {
          doc.addPage([w + margin * 2, h + margin * 2]).drawImage(img, { x: margin, y: margin, width: w, height: h })
        } else {
          const [pw, ph] = w > h ? [A4[1], A4[0]] : A4
          const scale = Math.min((pw - margin * 2) / w, (ph - margin * 2) / h)
          const dw = w * scale
          const dh = h * scale
          doc.addPage([pw, ph]).drawImage(img, { x: (pw - dw) / 2, y: (ph - dh) / 2, width: dw, height: dh })
        }
      }
      setResult({ name: 'gambar.pdf', blob: await savePdf(doc) })
    } catch (err) {
      toast.error(`Gagal membuat PDF: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    items.forEach(i => URL.revokeObjectURL(i.thumb))
    setItems([])
    setResult(null)
  }

  return (
    <ToolPage toolId="image-to-pdf">
      {result ? (
        <ResultPanel title="PDF berhasil dibuat" summary={`${items.length} gambar · ${items.length} halaman`} files={[result]} onReset={reset} />
      ) : items.length === 0 ? (
        <Dropzone onFiles={addFiles} accept={IMAGES} multiple hint="JPG, PNG, WEBP, GIF, atau BMP" />
      ) : (
        <div className="workspace">
          <div className="panel panel-grid-2">
            <Field label="Ukuran halaman">
              <Segmented name="size" value={size} onChange={setSize} options={SIZES} disabled={busy} />
            </Field>
            <Field label="Margin">
              <Segmented name="margin" value={margin} onChange={setMargin} options={MARGINS} disabled={busy} />
            </Field>
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{items.length} gambar</h2>
              <span className="panel-note">Satu gambar menjadi satu halaman, sesuai urutan</span>
            </div>
            <ol className="file-list">
              {items.map((item, i) => (
                <FileRow
                  key={item.id}
                  index={i}
                  file={item.file}
                  thumb={item.thumb}
                  onUp={() => setItems(list => moveItem(list, i, i - 1))}
                  onDown={() => setItems(list => moveItem(list, i, i + 1))}
                  onRemove={() => {
                    URL.revokeObjectURL(item.thumb)
                    setItems(list => list.filter(x => x.id !== item.id))
                  }}
                  disabled={busy || (i === 0 ? 'up' : i === items.length - 1 ? 'down' : false)}
                />
              ))}
            </ol>
            <Dropzone onFiles={addFiles} accept={IMAGES} multiple compact />
          </div>

          <div className="action-bar">
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Mulai ulang
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={convert} disabled={busy}>
              {busy ? <Spinner /> : <IconFileText size={17} />}
              {busy ? 'Membuat PDF…' : 'Buat PDF'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
