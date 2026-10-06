import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import PageGrid, { usePdfPages } from '../components/PageGrid'
import { Field, FileRow, Progress, Segmented, Spinner } from '../components/ui'
import { IconImage, IconDownload } from '../components/Icons'
import { openPdfjs, renderPage, canvasToBlob, closePdf } from '../utils/pdfConfig'
import { baseName, downloadBlob, formatSize } from '../utils/files'

const FORMATS = [
  { value: 'jpg', label: 'JPG', hint: 'File lebih kecil' },
  { value: 'png', label: 'PNG', hint: 'Paling tajam' },
]

const DPIS = [
  { value: 96, label: '96 DPI', hint: 'Layar' },
  { value: 150, label: '150 DPI', hint: 'Disarankan' },
  { value: 300, label: '300 DPI', hint: 'Cetak' },
]

export default function PdfToImage() {
  const [file, setFile] = useState(null)
  const { numPages, pages } = usePdfPages(file)
  const [format, setFormat] = useState('jpg')
  const [dpi, setDpi] = useState(150)
  const [scope, setScope] = useState('all')
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState(null)

  // Preview URLs for the result grid.
  useEffect(() => {
    if (!results) return
    return () => results.forEach(r => URL.revokeObjectURL(r.preview))
  }, [results])

  const toggle = n => setPicked(p => (p.includes(n) ? p.filter(x => x !== n) : [...p, n]))

  const convert = async () => {
    const list = scope === 'all' ? Array.from({ length: numPages }, (_, i) => i + 1) : [...picked].sort((a, b) => a - b)
    setBusy(true)
    setProgress(0)
    let pdf
    try {
      pdf = await openPdfjs(file)
      const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
      const name = baseName(file.name)
      const out = []
      for (let i = 0; i < list.length; i++) {
        const n = list[i]
        const page = await pdf.getPage(n)
        const canvas = await renderPage(page, dpi / 72)
        const blob = await canvasToBlob(canvas, mime, 0.92)
        out.push({
          name: `${name}_hal-${String(n).padStart(String(numPages).length, '0')}.${format}`,
          blob,
          meta: `${canvas.width} × ${canvas.height} px`,
          preview: URL.createObjectURL(blob),
        })
        canvas.width = canvas.height = 0
        setProgress(((i + 1) / list.length) * 100)
      }
      setResults(out)
    } catch (err) {
      toast.error(err.message)
    } finally {
      closePdf(pdf)
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPicked([])
    setResults(null)
  }

  return (
    <ToolPage toolId="pdf-to-image">
      {results ? (
        <ResultPanel
          title="Gambar siap diunduh"
          summary={`${results.length} gambar ${format.toUpperCase()} · ${formatSize(results.reduce((s, r) => s + r.blob.size, 0))}`}
          files={results}
          zipName={`${baseName(file.name)}_${format}.zip`}
          onReset={reset}
        >
          <ul className="image-grid">
            {results.map(r => (
              <li key={r.name} className="image-card">
                <img src={r.preview} alt={r.name} loading="lazy" />
                <div className="image-card-body">
                  <span className="file-name" title={r.name}>
                    {r.name}
                  </span>
                  <span className="file-meta">
                    {r.meta} · {formatSize(r.blob.size)}
                  </span>
                </div>
                <button type="button" className="btn-icon" onClick={() => downloadBlob(r.blob, r.name)} aria-label={`Unduh ${r.name}`}>
                  <IconDownload size={15} />
                </button>
              </li>
            ))}
          </ul>
        </ResultPanel>
      ) : !file ? (
        <Dropzone onFiles={f => setFile(f[0])} />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            <FileRow file={file} meta={numPages ? `${numPages} halaman` : 'membaca…'} onRemove={reset} disabled={busy} />
          </ul>

          <div className="panel panel-grid-2">
            <Field label="Format">
              <Segmented name="format" value={format} onChange={setFormat} options={FORMATS} disabled={busy} />
            </Field>
            <Field label="Resolusi">
              <Segmented name="dpi" value={dpi} onChange={setDpi} options={DPIS} disabled={busy} />
            </Field>
          </div>

          <div className="panel">
            <div className="panel-head">
              <Segmented
                name="scope"
                value={scope}
                onChange={setScope}
                disabled={busy}
                options={[
                  { value: 'all', label: `Semua halaman${numPages ? ` (${numPages})` : ''}` },
                  { value: 'pick', label: `Pilih halaman${picked.length ? ` (${picked.length})` : ''}` },
                ]}
              />
              {scope === 'pick' && (
                <span className="panel-note">
                  <button type="button" className="link-btn" onClick={() => setPicked(Array.from({ length: numPages }, (_, i) => i + 1))}>
                    Pilih semua
                  </button>
                  {picked.length > 0 && (
                    <button type="button" className="link-btn" onClick={() => setPicked([])}>
                      Batalkan
                    </button>
                  )}
                </span>
              )}
            </div>
            <PageGrid
              numPages={numPages}
              pages={pages}
              isActive={scope === 'pick' ? n => picked.includes(n) : undefined}
              onToggle={scope === 'pick' ? toggle : undefined}
            />
          </div>

          {busy && <Progress value={progress} label="Mengubah halaman menjadi gambar" />}

          <div className="action-bar">
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={convert}
              disabled={busy || !numPages || (scope === 'pick' && !picked.length)}
            >
              {busy ? <Spinner /> : <IconImage size={17} />}
              {busy ? 'Mengonversi…' : `Ubah ke ${format.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
