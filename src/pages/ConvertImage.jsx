import { useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconConvert } from '../components/Icons'
import { baseName, formatSize } from '../utils/files'

const ACCEPT_IMAGES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp', '.svg'],
}

const TARGET_FORMATS = [
  { value: 'image/jpeg', ext: 'jpg', label: 'JPG (.jpg)' },
  { value: 'image/png', ext: 'png', label: 'PNG (.png)' },
  { value: 'image/webp', ext: 'webp', label: 'WebP (.webp)' },
]

const COLOR_FILTERS = [
  { value: 'none', label: 'Warna Asli' },
  { value: 'grayscale', label: 'Hitam-Putih (Grayscale)' },
  { value: 'scan', label: 'Dokumen Scan (Kontras Tinggi)' },
]

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
      reject(new Error(`Gagal membaca gambar "${file.name}"`))
    }
    img.src = url
  })
}

export default function ConvertImage() {
  const [files, setFiles] = useState([])
  const [targetMime, setTargetMime] = useState('image/jpeg')
  const [quality, setQuality] = useState(90)
  const [bgColor, setBgColor] = useState('#FFFFFF')
  const [colorFilter, setColorFilter] = useState('none')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState(null)

  const addFiles = incoming => setFiles(prev => [...prev, ...incoming])
  const removeFile = idx => setFiles(prev => prev.filter((_, i) => i !== idx))

  const fmtSpec = TARGET_FORMATS.find(f => f.value === targetMime) || TARGET_FORMATS[0]

  const apply = async () => {
    if (!files.length) return
    setBusy(true)
    try {
      const out = []

      for (const f of files) {
        const img = await loadImg(f)
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || 800
        canvas.height = img.naturalHeight || 600
        const ctx = canvas.getContext('2d')

        // Fill background for JPEG (which doesn't support alpha transparency)
        if (targetMime === 'image/jpeg') {
          ctx.fillStyle = bgColor
          ctx.fillRect(0, 0, canvas.width, canvas.height)
        }

        if (colorFilter === 'grayscale') {
          ctx.filter = 'grayscale(100%)'
        } else if (colorFilter === 'scan') {
          ctx.filter = 'grayscale(100%) contrast(155%) brightness(108%)'
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

        const blob = await new Promise((resolve, reject) =>
          canvas.toBlob(
            b => (b ? resolve(b) : reject(new Error('Gagal mengenkode gambar'))),
            targetMime,
            targetMime === 'image/png' ? undefined : quality / 100,
          ),
        )

        out.push({
          name: `${baseName(f.name)}.${fmtSpec.ext}`,
          blob,
          meta: `${canvas.width}×${canvas.height} px · ${formatSize(blob.size)}`,
          status: fmtSpec.ext.toUpperCase(),
          ok: true,
        })
      }

      setResults(out)
      toast.success(`${out.length} gambar berhasil dikonversi ke ${fmtSpec.ext.toUpperCase()}!`)
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
    <ToolPage toolId="convert-image">
      {results ? (
        <ResultPanel
          title={`Gambar Dikonversi ke ${fmtSpec.ext.toUpperCase()}`}
          summary={`${results.length} file siap diunduh`}
          files={results}
          zipName={`gambar_${fmtSpec.ext}.zip`}
          onReset={reset}
        />
      ) : !files.length ? (
        <Dropzone
          accept={ACCEPT_IMAGES}
          multiple
          onFiles={addFiles}
          title="Pilih gambar yang ingin dikonversi formatnya"
          hint="Ubah PNG, JPG, WebP, GIF, BMP, atau SVG ke JPG, PNG, atau WebP sekaligus"
        />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            {files.map((f, i) => (
              <FileRow
                key={`${f.name}-${i}`}
                index={i}
                file={f}
                tag={f.name.split('.').pop()?.toUpperCase()?.slice(0, 4) || 'IMG'}
                onRemove={() => removeFile(i)}
                disabled={busy}
              />
            ))}
          </ul>

          <Dropzone compact accept={ACCEPT_IMAGES} multiple onFiles={addFiles} busy={busy} />

          <div className="panel">
            <Field label="Ubah ke Format">
              <Segmented
                name="conv-fmt"
                value={targetMime}
                onChange={setTargetMime}
                options={TARGET_FORMATS}
              />
            </Field>

            {targetMime !== 'image/png' && (
              <Field label={`Kualitas · ${quality}%`} htmlFor="conv-q">
                <input
                  id="conv-q"
                  type="range"
                  className="range"
                  min={20}
                  max={100}
                  value={quality}
                  onChange={e => setQuality(Number(e.target.value))}
                />
              </Field>
            )}

            <Field label="Mode Warna / Filter">
              <Segmented
                name="conv-filter"
                value={colorFilter}
                onChange={setColorFilter}
                options={COLOR_FILTERS}
              />
            </Field>

            {targetMime === 'image/jpeg' && (
              <Field
                label="Warna Latar Transparansi"
                hint="Digunakan jika gambar asli (PNG/SVG) memiliki latar transparan"
              >
                <div className="chips">
                  {['#FFFFFF', '#F3F4F6', '#000000'].map(c => (
                    <button
                      key={c}
                      type="button"
                      className="chip chip-swatch"
                      data-active={bgColor === c || undefined}
                      onClick={() => setBgColor(c)}
                    >
                      <span className="swatch" style={{ background: c }} />
                    </button>
                  ))}
                </div>
              </Field>
            )}
          </div>

          <div className="action-bar">
            <p className="action-note">
              Mengonversi {files.length} file ke .{fmtSpec.ext}.
            </p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Hapus semua
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={apply} disabled={busy}>
              {busy ? <Spinner /> : <IconConvert size={17} />}
              {busy ? 'Mengonversi…' : `Konversi ke ${fmtSpec.ext.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
