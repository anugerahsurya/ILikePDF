import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconWatermark } from '../components/Icons'
import { baseName } from '../utils/files'

const ACCEPT_IMAGES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.webp'],
}

const POSITIONS = [
  { value: 'tile', label: 'Pola Berulang (Penuh)' },
  { value: 'diagonal', label: 'Diagonal Tengah' },
  { value: 'center', label: 'Tengah' },
  { value: 'bottom-right', label: 'Pojok Kanan Bawah' },
]

const COLORS = ['#DC2626', '#FFFFFF', '#111827', '#1D4ED8']

function loadImg(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Gagal memuat "${file.name}"`))
    }
    img.src = url
  })
}

function drawWatermarkOnCanvas(ctx, W, H, { text, position, sizePct, opacity, color }) {
  const fontSize = Math.max(14, Math.round((Math.min(W, H) * sizePct) / 100))
  ctx.save()
  ctx.font = `bold ${fontSize}px Helvetica, Arial, sans-serif`
  ctx.fillStyle = color
  ctx.globalAlpha = opacity
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  if (position === 'diagonal') {
    ctx.translate(W / 2, H / 2)
    ctx.rotate((-35 * Math.PI) / 180)
    ctx.fillText(text, 0, 0)
  } else if (position === 'center') {
    ctx.fillText(text, W / 2, H / 2)
  } else if (position === 'bottom-right') {
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    const pad = Math.max(16, Math.round(W * 0.03))
    ctx.fillText(text, W - pad, H - pad)
  } else {
    // 'tile' repeating pattern
    const tw = ctx.measureText(text).width
    const stepX = Math.max(tw * 1.35, W * 0.35)
    const stepY = Math.max(fontSize * 3.8, H * 0.22)
    for (let y = -H * 0.2; y < H * 1.2; y += stepY) {
      for (let x = -W * 0.2; x < W * 1.2; x += stepX) {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate((-30 * Math.PI) / 180)
        ctx.fillText(text, 0, 0)
        ctx.restore()
      }
    }
  }

  ctx.restore()
}

export default function WatermarkImage() {
  const [files, setFiles] = useState([])
  const [previewUrl, setPreviewUrl] = useState('')
  const [text, setText] = useState('HANYA UNTUK VERIFIKASI')
  const [position, setPosition] = useState('tile')
  const [sizePct, setSizePct] = useState(6)
  const [opacity, setOpacity] = useState(0.28)
  const [color, setColor] = useState(COLORS[0])
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState(null)

  const firstFile = files[0] || null

  useEffect(() => {
    if (!firstFile) {
      setPreviewUrl('')
      return
    }
    let cancelled = false
    let currentUrl = ''

    ;(async () => {
      try {
        const img = await loadImg(firstFile)
        if (cancelled) return
        const maxSide = 720
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, {
          text: text.trim() || 'WATERMARK',
          position,
          sizePct,
          opacity,
          color,
        })
        canvas.toBlob(blob => {
          if (!blob || cancelled) return
          currentUrl = URL.createObjectURL(blob)
          setPreviewUrl(prev => {
            if (prev) URL.revokeObjectURL(prev)
            return currentUrl
          })
        }, 'image/jpeg', 0.88)
      } catch {}
    })()

    return () => {
      cancelled = true
      if (currentUrl) URL.revokeObjectURL(currentUrl)
    }
  }, [firstFile, text, position, sizePct, opacity, color])

  const addFiles = incoming => setFiles(prev => [...prev, ...incoming])
  const removeFile = idx => setFiles(prev => prev.filter((_, i) => i !== idx))

  const apply = async () => {
    if (!files.length) return
    setBusy(true)
    try {
      const out = []
      const label = text.trim() || 'WATERMARK'

      for (const f of files) {
        const img = await loadImg(f)
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)
        drawWatermarkOnCanvas(ctx, canvas.width, canvas.height, {
          text: label,
          position,
          sizePct,
          opacity,
          color,
        })

        const outType = f.type === 'image/png' ? 'image/png' : f.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
        const ext = outType === 'image/png' ? 'png' : outType === 'image/webp' ? 'webp' : 'jpg'
        const blob = await new Promise((resolve, reject) =>
          canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Gagal menyimpan gambar'))), outType, 0.92),
        )

        out.push({
          name: `${baseName(f.name)}_watermark.${ext}`,
          blob,
        })
      }

      setResults(out)
      toast.success(`Watermark berhasil ditambahkan ke ${out.length} gambar!`)
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
    <ToolPage toolId="watermark-image">
      {results ? (
        <ResultPanel
          title="Watermark Gambar Ditambahkan"
          summary={`Diterapkan pada ${results.length} gambar`}
          files={results}
          zipName="gambar_watermark.zip"
          onReset={reset}
        />
      ) : !files.length ? (
        <Dropzone
          accept={ACCEPT_IMAGES}
          multiple
          onFiles={addFiles}
          title="Pilih foto atau scan dokumen untuk diberi watermark"
          hint="Cocok untuk melindungi scan KTP, ijazah, atau foto dokumentasi kantor"
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

          <div className="split-layout">
            <div className="panel">
              <Field label="Teks Watermark" htmlFor="wmi-text">
                <input
                  id="wmi-text"
                  className="input"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  placeholder="Contoh: HANYA UNTUK VERIFIKASI"
                />
                <div className="chips" style={{ marginTop: '8px' }}>
                  {['HANYA UNTUK VERIFIKASI', 'DOKUMEN RAHASIA', 'DRAFT', 'ARSIP KANTOR'].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      className="chip"
                      onClick={() => setText(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Posisi & Pola">
                <Segmented name="wmi-pos" value={position} onChange={setPosition} options={POSITIONS} />
              </Field>

              <Field label={`Ukuran Huruf · ${sizePct}%`} htmlFor="wmi-size">
                <input
                  id="wmi-size"
                  type="range"
                  className="range"
                  min={2}
                  max={18}
                  value={sizePct}
                  onChange={e => setSizePct(Number(e.target.value))}
                />
              </Field>

              <Field label={`Transparansi · ${Math.round(opacity * 100)}%`} htmlFor="wmi-op">
                <input
                  id="wmi-op"
                  type="range"
                  className="range"
                  min={5}
                  max={90}
                  value={Math.round(opacity * 100)}
                  onChange={e => setOpacity(Number(e.target.value) / 100)}
                />
              </Field>

              <Field label="Warna Teks">
                <div className="chips">
                  {COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className="chip chip-swatch"
                      data-active={color === c || undefined}
                      onClick={() => setColor(c)}
                    >
                      <span className="swatch" style={{ background: c }} />
                    </button>
                  ))}
                  <label className="chip chip-swatch" data-active={!COLORS.includes(color) || undefined}>
                    <input type="color" value={color} onChange={e => setColor(e.target.value.toUpperCase())} />
                  </label>
                </div>
              </Field>
            </div>

            <div className="panel preview-panel">
              <div className="panel-head">
                <h2>Pratinjau Hasil</h2>
              </div>
              <div className="stage" style={{ minHeight: '280px', display: 'grid', placeItems: 'center' }}>
                {previewUrl ? (
                  <img src={previewUrl} alt="Pratinjau Watermark" style={{ maxHeight: '420px', width: 'auto' }} />
                ) : (
                  <span className="page-skeleton" />
                )}
              </div>
            </div>
          </div>

          <div className="action-bar">
            <p className="action-note">Diterapkan ke {files.length} gambar.</p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti gambar
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={apply} disabled={busy}>
              {busy ? <Spinner /> : <IconWatermark size={17} />}
              {busy ? 'Menyimpan…' : 'Tambahkan Watermark'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
