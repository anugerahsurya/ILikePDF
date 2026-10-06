import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { rgb, StandardFonts, degrees } from '@cantoo/pdf-lib'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { usePagePreview } from '../components/PdfPreview'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconWatermark, IconArrowLeft, IconArrowRight } from '../components/Icons'
import { loadEditablePdf, savePdf } from '../utils/pdfConfig'
import { baseName } from '../utils/files'

const POSITIONS = [
  { value: 'diagonal', label: 'Diagonal' },
  { value: 'center', label: 'Tengah' },
  { value: 'tile', label: 'Pola berulang' },
  { value: 'top', label: 'Atas' },
  { value: 'bottom', label: 'Bawah' },
]

const COLORS = ['#DC2626', '#6B7280', '#1D4ED8', '#111827']
const MARGIN = 36

let measureCtx = null
function measure(text, size) {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  measureCtx.font = `bold ${size}px Helvetica, Arial, sans-serif`
  return measureCtx.measureText(text).width
}

/*
 * Text centres in displayed-page coordinates (points, origin top-left) and
 * the on-screen angle, shared by the preview and the PDF writer.
 */
function layout(position, Dw, Dh, tw, th) {
  if (position === 'top') return { angle: 0, centers: [[Dw / 2, MARGIN + th / 2]] }
  if (position === 'bottom') return { angle: 0, centers: [[Dw / 2, Dh - MARGIN - th / 2]] }
  if (position === 'center') return { angle: 0, centers: [[Dw / 2, Dh / 2]] }
  if (position === 'diagonal') return { angle: 45, centers: [[Dw / 2, Dh / 2]] }
  const stepX = tw * 0.75 + th * 4
  const stepY = th * 6
  const centers = []
  for (let row = 0, y = stepY / 2; y < Dh + stepY; row++, y += stepY) {
    for (let x = (row % 2 ? stepX / 2 : 0); x < Dw + stepX; x += stepX) centers.push([x, y])
  }
  return { angle: 30, centers }
}

function toPdfSpace(rot, W, H, dx, dy) {
  if (rot === 90) return { x: dy, y: dx }
  if (rot === 180) return { x: W - dx, y: dy }
  if (rot === 270) return { x: W - dy, y: H - dx }
  return { x: dx, y: H - dy }
}

const hexToRgb = hex => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255)

export default function WatermarkPdf() {
  const [file, setFile] = useState(null)
  const [pageNo, setPageNo] = useState(1)
  const { numPages, preview } = usePagePreview(file, pageNo)
  const [text, setText] = useState('DRAFT')
  const [size, setSize] = useState(56)
  const [opacity, setOpacity] = useState(0.2)
  const [color, setColor] = useState(COLORS[0])
  const [position, setPosition] = useState('diagonal')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const label = text.trim() || 'DRAFT'
  const page = preview?.size || { width: 595, height: 842 }
  const previewLayout = useMemo(
    () => layout(position, page.width, page.height, measure(label, size), size * 0.72),
    [position, page.width, page.height, label, size],
  )

  const apply = async () => {
    setBusy(true)
    try {
      const doc = await loadEditablePdf(file)
      const font = await doc.embedFont(StandardFonts.HelveticaBold)
      let tw
      try {
        tw = font.widthOfTextAtSize(label, size)
      } catch {
        throw new Error('Teks mengandung karakter yang tidak didukung. Gunakan huruf, angka, dan tanda baca biasa.')
      }
      const th = font.heightAtSize(size, { descender: false })
      for (const pdfPage of doc.getPages()) {
        const rot = ((pdfPage.getRotation().angle % 360) + 360) % 360
        const crop = pdfPage.getCropBox()
        const turned = rot === 90 || rot === 270
        const Dw = turned ? crop.height : crop.width
        const Dh = turned ? crop.width : crop.height
        const { angle, centers } = layout(position, Dw, Dh, tw, th)
        const phi = ((angle + rot) * Math.PI) / 180
        for (const [cx, cy] of centers) {
          const c = toPdfSpace(rot, crop.width, crop.height, cx, cy)
          pdfPage.drawText(label, {
            x: crop.x + c.x - (tw / 2) * Math.cos(phi) + (th / 2) * Math.sin(phi),
            y: crop.y + c.y - (tw / 2) * Math.sin(phi) - (th / 2) * Math.cos(phi),
            size,
            font,
            color: hexToRgb(color),
            opacity,
            rotate: degrees(angle + rot),
          })
        }
      }
      setResult({ name: `${baseName(file.name)}_watermark.pdf`, blob: await savePdf(doc) })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPageNo(1)
    setResult(null)
  }

  return (
    <ToolPage toolId="watermark">
      {result ? (
        <ResultPanel title="Watermark ditambahkan" summary={`“${label}” di ${numPages} halaman`} files={[result]} onReset={reset} />
      ) : !file ? (
        <Dropzone onFiles={f => setFile(f[0])} />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            <FileRow file={file} meta={numPages ? `${numPages} halaman` : 'membaca…'} onRemove={reset} disabled={busy} />
          </ul>

          <div className="split-layout">
            <div className="panel">
              <Field label="Teks" htmlFor="wm-text">
                <input id="wm-text" className="input" value={text} maxLength={60} onChange={e => setText(e.target.value)} placeholder="DRAFT" />
              </Field>
              <Field label="Posisi">
                <Segmented name="wm-pos" value={position} onChange={setPosition} options={POSITIONS} />
              </Field>
              <Field label={`Ukuran · ${size} pt`} htmlFor="wm-size">
                <input id="wm-size" className="range" type="range" min={12} max={120} value={size} onChange={e => setSize(Number(e.target.value))} />
              </Field>
              <Field label={`Transparansi · ${Math.round(opacity * 100)}%`} htmlFor="wm-opacity">
                <input id="wm-opacity" className="range" type="range" min={5} max={90} value={Math.round(opacity * 100)} onChange={e => setOpacity(Number(e.target.value) / 100)} />
              </Field>
              <Field label="Warna">
                <div className="chips">
                  {COLORS.map(c => (
                    <button key={c} type="button" className="chip chip-swatch" data-active={color === c || undefined} onClick={() => setColor(c)} aria-label={`Warna ${c}`}>
                      <span className="swatch" style={{ background: c }} />
                    </button>
                  ))}
                  <label className="chip chip-swatch" data-active={!COLORS.includes(color) || undefined} title="Warna lain">
                    <input type="color" value={color} onChange={e => setColor(e.target.value.toUpperCase())} aria-label="Pilih warna lain" />
                  </label>
                </div>
              </Field>
            </div>

            <div className="panel preview-panel">
              <div className="panel-head">
                <h2>Pratinjau</h2>
                <div className="pager">
                  <button type="button" className="btn-icon" onClick={() => setPageNo(n => n - 1)} disabled={pageNo <= 1} aria-label="Halaman sebelumnya">
                    <IconArrowLeft size={15} />
                  </button>
                  <span className="mono">
                    {pageNo} / {numPages || '–'}
                  </span>
                  <button type="button" className="btn-icon" onClick={() => setPageNo(n => n + 1)} disabled={pageNo >= numPages} aria-label="Halaman berikutnya">
                    <IconArrowRight size={15} />
                  </button>
                </div>
              </div>
              <div className="stage" style={{ aspectRatio: page.width / page.height }}>
                {preview ? <img className="stage-page" src={preview.url} alt={`Halaman ${preview.n}`} /> : <span className="page-skeleton" />}
                <div className="wm-layer" aria-hidden="true">
                  {previewLayout.centers.map(([cx, cy], i) => (
                    <span
                      key={i}
                      className="wm-text"
                      style={{
                        left: `${(cx / page.width) * 100}%`,
                        top: `${(cy / page.height) * 100}%`,
                        fontSize: `${(size / page.width) * 100}cqw`,
                        color,
                        opacity,
                        transform: `translate(-50%, -50%) rotate(${-previewLayout.angle}deg)`,
                      }}
                    >
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="action-bar">
            <p className="action-note">Diterapkan ke semua {numPages || ''} halaman.</p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={apply} disabled={busy || !numPages}>
              {busy ? <Spinner /> : <IconWatermark size={17} />}
              {busy ? 'Menyimpan…' : 'Tambahkan watermark'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
