import { useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { Field, FileRow, Progress, Segmented, Spinner } from '../components/ui'
import { IconCompress } from '../components/Icons'
import { PDFDocument, loadEditablePdf, openPdfjs, renderPage, canvasToBlob, savePdf, closePdf } from '../utils/pdfConfig'
import { baseName, downloadBlob, formatSize, withIds } from '../utils/files'

const MODES = [
  { value: 'target', label: 'Batas ukuran', hint: 'Contoh: maks. 200 KB' },
  { value: 'level', label: 'Tingkat kompresi', hint: 'Ringan, sedang, kuat' },
  { value: 'lossless', label: 'Tanpa turun kualitas', hint: 'Hanya rapikan struktur' },
]

const LEVELS = [
  { value: 'light', label: 'Ringan', hint: 'Teks tetap tajam', scale: 1.7, quality: 0.78 },
  { value: 'medium', label: 'Sedang', hint: 'Seimbang', scale: 1.3, quality: 0.62 },
  { value: 'strong', label: 'Kuat', hint: 'Paling kecil', scale: 1.0, quality: 0.45 },
]

const PRESETS_KB = [100, 200, 300, 500, 1024, 2048]
const presetLabel = kb => (kb >= 1024 ? `${+(kb / 1024).toFixed(2)} MB` : `${Math.round(kb)} KB`)

// Pick a starting render scale and JPEG quality from the byte budget per page.
function startParams(targetBytes, numPages) {
  const perPage = Math.max(8_000, (targetBytes - 4_000) / numPages)
  if (perPage >= 400_000) return { scale: 1.6, quality: 0.78 }
  if (perPage >= 200_000) return { scale: 1.35, quality: 0.7 }
  if (perPage >= 100_000) return { scale: 1.15, quality: 0.6 }
  if (perPage >= 50_000) return { scale: 0.95, quality: 0.5 }
  return { scale: 0.8, quality: 0.38 }
}

async function rasterize(pdf, { scale, quality }, onPage) {
  const doc = await PDFDocument.create()
  for (let n = 1; n <= pdf.numPages; n++) {
    onPage(n)
    const page = await pdf.getPage(n)
    const { width, height } = page.getViewport({ scale: 1 })
    const canvas = await renderPage(page, scale)
    const jpg = await doc.embedJpg(await (await canvasToBlob(canvas, 'image/jpeg', quality)).arrayBuffer())
    doc.addPage([width, height]).drawImage(jpg, { x: 0, y: 0, width, height })
    canvas.width = canvas.height = 0
  }
  return savePdf(doc)
}

async function compressOne(file, opts, onProgress) {
  // Structural re-save first: cheap and lossless, often enough on its own.
  const lossless = await savePdf(await loadEditablePdf(file))
  let best = lossless.size < file.size ? lossless : file
  const targetBytes = opts.mode === 'target' ? opts.targetKb * 1024 : null

  if (opts.mode === 'lossless' || (targetBytes && best.size <= targetBytes)) {
    return { blob: best, targetBytes, achieved: targetBytes ? best.size <= targetBytes : true }
  }

  const pdf = await openPdfjs(file)
  try {
    let params = targetBytes ? startParams(targetBytes, pdf.numPages) : LEVELS.find(l => l.value === opts.level)
    const passes = targetBytes ? 4 : 1
    for (let pass = 0; pass < passes; pass++) {
      const out = await rasterize(pdf, params, n => onProgress(pass, passes, n, pdf.numPages))
      if (out.size < best.size) best = out
      if (!targetBytes || out.size <= targetBytes) break
      const ratio = targetBytes / out.size
      params = {
        scale: Math.max(0.45, params.scale * Math.min(0.88, Math.sqrt(ratio) * 0.95)),
        quality: Math.max(0.22, params.quality * Math.min(0.85, Math.pow(ratio, 0.4))),
      }
    }
  } finally {
    closePdf(pdf)
  }
  return { blob: best, targetBytes, achieved: targetBytes ? best.size <= targetBytes : true }
}

export default function CompressPdf() {
  const [items, setItems] = useState([])
  const [mode, setMode] = useState('target')
  const [targetKb, setTargetKb] = useState(500)
  const [unit, setUnit] = useState('KB')
  const [level, setLevel] = useState('medium')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(null)
  const [results, setResults] = useState(null)

  const addFiles = files => setItems(prev => [...prev, ...withIds(files).map(i => ({ ...i, targetKb: null }))])

  const inputValue = unit === 'MB' ? +(targetKb / 1024).toFixed(2) : targetKb
  const setTargetFromInput = v => {
    const n = Math.max(0, Number(v) || 0)
    setTargetKb(unit === 'MB' ? Math.round(n * 1024) : Math.round(n))
  }

  const run = async () => {
    if (mode === 'target' && items.some(i => (i.targetKb ?? targetKb) < 10)) {
      toast.error('Batas ukuran minimal 10 KB.')
      return
    }
    setBusy(true)
    const out = []
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const label = items.length > 1 ? `File ${i + 1} dari ${items.length}: ${item.file.name}` : item.file.name
      setProgress({ label, value: (i / items.length) * 100 })
      try {
        const res = await compressOne(item.file, { mode, level, targetKb: item.targetKb ?? targetKb }, (pass, passes, n, total) => {
          const within = (pass + n / total) / passes
          setProgress({ label: `${label} · halaman ${n}/${total}${pass ? ` · percobaan ${pass + 1}` : ''}`, value: ((i + within) / items.length) * 100 })
        })
        out.push({ ...res, name: `${baseName(item.file.name)}_kompres.pdf`, origSize: item.file.size })
      } catch (err) {
        toast.error(err.message)
      }
    }
    setBusy(false)
    setProgress(null)
    if (out.length) setResults(out)
  }

  const reset = () => {
    setItems([])
    setResults(null)
  }

  if (results) {
    const before = results.reduce((s, r) => s + r.origSize, 0)
    const after = results.reduce((s, r) => s + r.blob.size, 0)
    const saved = Math.max(0, Math.round((1 - after / before) * 100))
    return (
      <ToolPage toolId="compress">
        <ResultPanel
          title={saved > 0 ? `Ukuran berkurang ${saved}%` : 'File sudah optimal'}
          summary={`${formatSize(before)} → ${formatSize(after)}`}
          files={results}
          zipName="pdf_kompres.zip"
          onReset={reset}
        >
          <ul className="result-list">
            {results.map(r => {
              const pct = Math.max(0, Math.round((1 - r.blob.size / r.origSize) * 100))
              return (
                <li key={r.name} className="result-item">
                  <div className="file-row-main">
                    <span className="file-name" title={r.name}>
                      {r.name}
                    </span>
                    <span className="file-meta">
                      {formatSize(r.origSize)} → <strong>{formatSize(r.blob.size)}</strong>
                      {pct > 0 && ` · −${pct}%`}
                    </span>
                  </div>
                  {r.targetBytes && (
                    <span className={`status ${r.achieved ? 'status-ok' : 'status-warn'}`}>
                      {r.achieved ? `≤ ${presetLabel(r.targetBytes / 1024)}` : `Belum ≤ ${presetLabel(r.targetBytes / 1024)}`}
                    </span>
                  )}
                  {results.length > 1 && <DownloadOne r={r} />}
                </li>
              )
            })}
          </ul>
          {results.some(r => r.targetBytes && !r.achieved) && (
            <p className="note note-warn">
              Sebagian file tidak bisa mencapai batas tanpa membuat isinya tidak terbaca. Coba batas yang lebih longgar atau pisahkan PDF menjadi beberapa bagian.
            </p>
          )}
        </ResultPanel>
      </ToolPage>
    )
  }

  return (
    <ToolPage toolId="compress">
      {items.length === 0 ? (
        <Dropzone onFiles={addFiles} multiple hint="Bisa beberapa file sekaligus" />
      ) : (
        <div className="workspace">
          <div className="panel">
            <Field label="Metode">
              <Segmented name="compress-mode" value={mode} onChange={setMode} options={MODES} disabled={busy} />
            </Field>

            {mode === 'target' && (
              <Field label="Ukuran maksimal setiap file" hint="Berlaku untuk semua file. Ubah per file di daftar bawah bila perlu.">
                <div className="inline-controls">
                  <div className="input-group">
                    <input
                      className="input input-narrow"
                      type="number"
                      min={0}
                      step={unit === 'MB' ? 0.1 : 10}
                      value={inputValue}
                      onChange={e => setTargetFromInput(e.target.value)}
                      disabled={busy}
                      aria-label="Ukuran maksimal"
                    />
                    <select className="input input-unit" value={unit} onChange={e => setUnit(e.target.value)} disabled={busy} aria-label="Satuan">
                      <option>KB</option>
                      <option>MB</option>
                    </select>
                  </div>
                  <div className="chips">
                    {PRESETS_KB.map(kb => (
                      <button
                        key={kb}
                        type="button"
                        className="chip"
                        data-active={targetKb === kb || undefined}
                        onClick={() => {
                          setTargetKb(kb)
                          setUnit(kb >= 1024 ? 'MB' : 'KB')
                        }}
                        disabled={busy}
                      >
                        {presetLabel(kb)}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
            )}

            {mode === 'level' && (
              <Field label="Tingkat kompresi">
                <Segmented name="compress-level" value={level} onChange={setLevel} options={LEVELS} disabled={busy} />
              </Field>
            )}

            {mode !== 'lossless' && (
              <p className="note">Untuk mencapai ukuran kecil, halaman diubah menjadi gambar. Teks di hasil tidak lagi bisa diseleksi atau dicari.</p>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{items.length} file</h2>
            </div>
            <ul className="file-list">
              {items.map(item => (
                <FileRow
                  key={item.id}
                  file={item.file}
                  onRemove={() => setItems(list => list.filter(x => x.id !== item.id))}
                  disabled={busy}
                >
                  {mode === 'target' && (
                    <label className="row-target">
                      <span>maks.</span>
                      <input
                        className="input input-xs"
                        type="number"
                        min={10}
                        value={item.targetKb ?? targetKb}
                        onChange={e => {
                          const v = Math.max(0, Math.round(Number(e.target.value) || 0))
                          setItems(list => list.map(x => (x.id === item.id ? { ...x, targetKb: v } : x)))
                        }}
                        disabled={busy}
                        aria-label={`Batas ukuran ${item.file.name} dalam KB`}
                      />
                      <span>KB</span>
                    </label>
                  )}
                </FileRow>
              ))}
            </ul>
            <Dropzone onFiles={addFiles} multiple compact busy={busy} />
          </div>

          {progress && <Progress value={progress.value} label={progress.label} />}

          <div className="action-bar">
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Mulai ulang
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={run} disabled={busy}>
              {busy ? <Spinner /> : <IconCompress size={17} />}
              {busy ? 'Mengompres…' : `Kompres ${items.length > 1 ? `${items.length} file` : 'PDF'}`}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}

function DownloadOne({ r }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={() => downloadBlob(r.blob, r.name)}
    >
      Unduh
    </button>
  )
}
