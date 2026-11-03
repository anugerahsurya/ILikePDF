import { useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconCompress } from '../components/Icons'
import { baseName, formatSize } from '../utils/files'

const ACCEPT_IMAGES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp'],
}

const MODES = [
  { value: 'target', label: 'Batas Ukuran (KB)', hint: 'Misal ≤ 200 KB untuk unggahan' },
  { value: 'quality', label: 'Tingkat Kualitas (%)', hint: 'Atur rasio kualitas manual' },
]

const FORMAT_OPTS = [
  { value: 'auto', label: 'Otomatis (JPG/WebP)' },
  { value: 'image/jpeg', label: 'JPG' },
  { value: 'image/webp', label: 'WebP (Paling Kecil)' },
]

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Gagal memuat gambar "${file.name}"`))
    }
    img.src = url
  })
}

function encodeCanvas(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('Gagal mengenkode gambar'))),
      mime,
      quality,
    )
  })
}

async function compressSingleImage(file, { mode, targetKb, qualityPct, outMime }) {
  const img = await loadImage(file)
  const mime =
    outMime === 'auto'
      ? file.type === 'image/webp'
        ? 'image/webp'
        : 'image/jpeg'
      : outMime
  const ext = mime === 'image/webp' ? 'webp' : 'jpg'

  const renderAtScale = scale => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  }

  if (mode === 'quality') {
    const canvas = renderAtScale(1)
    const blob = await encodeCanvas(canvas, mime, Math.max(0.05, Math.min(0.98, qualityPct / 100)))
    return { blob, ext }
  }

  // Target KB mode: binary search quality first, then scale down if needed
  const targetBytes = Math.max(10 * 1024, targetKb * 1024)
  let bestBlob = null

  for (const scale of [1, 0.85, 0.7, 0.55, 0.4]) {
    const canvas = renderAtScale(scale)
    let lo = 0.12
    let hi = 0.92

    for (let step = 0; step < 6; step++) {
      const mid = (lo + hi) / 2
      const blob = await encodeCanvas(canvas, mime, mid)
      if (blob.size <= targetBytes) {
        bestBlob = blob
        lo = mid
      } else {
        hi = mid
      }
    }

    if (bestBlob && bestBlob.size <= targetBytes) {
      break
    }
    if (!bestBlob) {
      bestBlob = await encodeCanvas(canvas, mime, 0.12)
    }
  }

  return { blob: bestBlob, ext }
}

export default function CompressImage() {
  const [files, setFiles] = useState([])
  const [mode, setMode] = useState('target')
  const [targetKb, setTargetKb] = useState(200)
  const [qualityPct, setQualityPct] = useState(75)
  const [outMime, setOutMime] = useState('auto')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState(null)

  const addFiles = incoming => {
    setFiles(prev => [...prev, ...incoming])
  }

  const removeFile = idx => {
    setFiles(prev => prev.filter((_, i) => i !== idx))
  }

  const apply = async () => {
    if (!files.length) return
    setBusy(true)
    try {
      const out = []
      let totalBefore = 0
      let totalAfter = 0

      for (const f of files) {
        totalBefore += f.size
        const { blob, ext } = await compressSingleImage(f, {
          mode,
          targetKb,
          qualityPct,
          outMime,
        })
        totalAfter += blob.size
        const pct = Math.round((1 - blob.size / f.size) * 100)
        out.push({
          name: `${baseName(f.name)}_kompres.${ext}`,
          blob,
          meta: `sebelumnya ${formatSize(f.size)}`,
          status: pct > 0 ? `-${pct}%` : 'Optimal',
          ok: blob.size <= (mode === 'target' ? targetKb * 1024 * 1.05 : f.size),
        })
      }

      setResults({
        items: out,
        totalBefore,
        totalAfter,
      })
      toast.success(`${out.length} gambar berhasil dikompres!`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFiles([])
    setResults(null)
  }

  return (
    <ToolPage toolId="compress-image">
      {results ? (
        <ResultPanel
          title="Gambar Berhasil Dikompres"
          summary={`Total: ${formatSize(results.totalAfter)} (sebelumnya ${formatSize(results.totalBefore)})`}
          files={results.items}
          zipName="gambar_kompres.zip"
          onReset={reset}
        />
      ) : !files.length ? (
        <Dropzone
          accept={ACCEPT_IMAGES}
          multiple
          onFiles={addFiles}
          title="Pilih foto atau gambar untuk dikompres"
          hint="Mendukung JPG, PNG, dan WebP. Bisa memilih banyak gambar sekaligus."
        />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            {files.map((f, i) => (
              <FileRow
                key={`${f.name}-${i}`}
                index={i}
                file={f}
                tag="IMG"
                onRemove={() => removeFile(i)}
                disabled={busy}
              />
            ))}
          </ul>

          <Dropzone compact accept={ACCEPT_IMAGES} multiple onFiles={addFiles} busy={busy} />

          <div className="panel">
            <Field label="Metode Kompresi">
              <Segmented name="img-cmp-mode" value={mode} onChange={setMode} options={MODES} />
            </Field>

            {mode === 'target' ? (
              <Field label="Target Ukuran Maksimal per Gambar" htmlFor="img-kb">
                <div className="inline-controls">
                  <div className="chips">
                    {[100, 200, 300, 500, 1000].map(kb => (
                      <button
                        key={kb}
                        type="button"
                        className="chip"
                        data-active={targetKb === kb || undefined}
                        onClick={() => setTargetKb(kb)}
                      >
                        ≤ {kb >= 1000 ? `${kb / 1000} MB` : `${kb} KB`}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input
                      id="img-kb"
                      type="number"
                      min={20}
                      max={10000}
                      className="input input-narrow"
                      value={targetKb}
                      onChange={e => setTargetKb(Math.max(20, Number(e.target.value) || 200))}
                    />
                    <span className="mono">KB</span>
                  </div>
                </div>
              </Field>
            ) : (
              <Field label={`Kualitas Gambar · ${qualityPct}%`} htmlFor="img-q">
                <input
                  id="img-q"
                  type="range"
                  className="range"
                  min={15}
                  max={95}
                  value={qualityPct}
                  onChange={e => setQualityPct(Number(e.target.value))}
                />
              </Field>
            )}

            <Field label="Format Keluaran">
              <Segmented name="img-fmt" value={outMime} onChange={setOutMime} options={FORMAT_OPTS} />
            </Field>
          </div>

          <div className="action-bar">
            <p className="action-note">{files.length} gambar siap dikompres.</p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Hapus semua
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={apply} disabled={busy}>
              {busy ? <Spinner /> : <IconCompress size={17} />}
              {busy ? 'Mengompres…' : 'Kompres Gambar'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
