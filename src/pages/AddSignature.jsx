import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import SignatureCanvas from 'react-signature-canvas'
import { degrees } from '@cantoo/pdf-lib'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { usePagePreview } from '../components/PdfPreview'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconSignature, IconArrowLeft, IconArrowRight, IconUpload } from '../components/Icons'
import { loadEditablePdf, savePdf } from '../utils/pdfConfig'
import { baseName } from '../utils/files'

const INKS = [
  { value: '#111827', label: 'Hitam' },
  { value: '#1D3FAF', label: 'Biru' },
]

const clamp = (v, min, max) => Math.min(max, Math.max(min, v))

function loadImage(src) {
  const img = new Image()
  img.src = src
  return img.decode().then(() => img)
}

// Uploaded scans usually have a paper-white background; make it transparent.
async function prepareUpload(file, dropWhite) {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, 0, 0)
    if (dropWhite) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const px = data.data
      for (let i = 0; i < px.length; i += 4) {
        const lightness = Math.min(px[i], px[i + 1], px[i + 2])
        if (lightness > 225) px[i + 3] = 0
        else if (lightness > 180) px[i + 3] = Math.round(px[i + 3] * ((225 - lightness) / 45))
      }
      ctx.putImageData(data, 0, 0)
    }
    return { url: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height }
  } finally {
    URL.revokeObjectURL(url)
  }
}

// Crops a canvas to its drawn pixels. (react-signature-canvas' own
// getTrimmedCanvas breaks under Vite because of its trim-canvas import.)
function trimCanvas(source) {
  const { width, height } = source
  const data = source.getContext('2d').getImageData(0, 0, width, height).data
  let top = height, left = width, right = -1, bottom = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3]) {
        if (x < left) left = x
        if (x > right) right = x
        if (y < top) top = y
        if (y > bottom) bottom = y
      }
    }
  }
  if (right < 0) return null
  const pad = 4
  left = Math.max(0, left - pad)
  top = Math.max(0, top - pad)
  const w = Math.min(width, right + pad + 1) - left
  const h = Math.min(height, bottom + pad + 1) - top
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d').drawImage(source, left, top, w, h, 0, 0, w, h)
  return out
}

// Maps a point from the displayed (rotated) page back to unrotated PDF space.
function toPdfSpace(rot, W, H, dx, dy) {
  switch (rot) {
    case 90:
      return { x: dy, y: dx }
    case 180:
      return { x: W - dx, y: dy }
    case 270:
      return { x: W - dy, y: H - dx }
    default:
      return { x: dx, y: H - dy }
  }
}

export default function AddSignature() {
  const [file, setFile] = useState(null)
  const [pageNo, setPageNo] = useState(1)
  const { numPages, preview } = usePagePreview(file, pageNo)
  const [source, setSource] = useState('draw')
  const [ink, setInk] = useState(INKS[0].value)
  const [dropWhite, setDropWhite] = useState(true)
  const [sig, setSig] = useState(null)
  const [pos, setPos] = useState({ x: 0.6, y: 0.78, w: 0.28 })
  const [scope, setScope] = useState('this')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const padRef = useRef(null)
  const stageRef = useRef(null)
  const drag = useRef(null)

  useEffect(() => {
    if (source !== 'draw') return
    const onResize = () => {
      const pad = padRef.current
      if (!pad) return
      const data = pad.toData()
      const canvas = pad.getCanvas()
      const ratio = Math.max(window.devicePixelRatio || 1, 1)
      canvas.width = canvas.offsetWidth * ratio
      canvas.height = canvas.offsetHeight * ratio
      canvas.getContext('2d').scale(ratio, ratio)
      pad.clear()
      pad.fromData(data)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [source])

  const pageAspect = preview ? preview.size.width / preview.size.height : 0.707
  const sigH = sig ? pos.w * (sig.h / sig.w) * pageAspect : 0

  const captureDrawing = () => {
    const pad = padRef.current
    if (!pad || pad.isEmpty()) return
    const canvas = trimCanvas(pad.getCanvas())
    if (!canvas) return
    setSig({ url: canvas.toDataURL('image/png'), w: canvas.width, h: canvas.height })
  }

  const clearDrawing = () => {
    padRef.current?.clear()
    setSig(null)
  }

  const onUpload = async files => {
    try {
      setSig(await prepareUpload(files[0], dropWhite))
    } catch {
      toast.error('Gambar tanda tangan tidak bisa dibaca.')
    }
  }

  const switchSource = value => {
    setSource(value)
    setSig(null)
  }

  const onPointerDown = e => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = stageRef.current.getBoundingClientRect()
    drag.current = { startX: e.clientX, startY: e.clientY, from: pos, rect }
  }

  const onPointerMove = e => {
    const d = drag.current
    if (!d) return
    const x = d.from.x + (e.clientX - d.startX) / d.rect.width
    const y = d.from.y + (e.clientY - d.startY) / d.rect.height
    setPos(p => ({ ...p, x: clamp(x, 0, 1 - p.w), y: clamp(y, 0, 1 - sigH) }))
  }

  const onPointerUp = () => {
    drag.current = null
  }

  const onKeyDown = e => {
    const step = e.shiftKey ? 0.05 : 0.01
    const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
    const m = moves[e.key]
    if (!m) return
    e.preventDefault()
    setPos(p => ({ ...p, x: clamp(p.x + m[0], 0, 1 - p.w), y: clamp(p.y + m[1], 0, 1 - sigH) }))
  }

  const setWidth = w => setPos(p => ({ ...p, w, x: clamp(p.x, 0, 1 - w), y: clamp(p.y, 0, 1 - w * (sig.h / sig.w) * pageAspect) }))

  const apply = async () => {
    setBusy(true)
    try {
      const doc = await loadEditablePdf(file)
      const image = await doc.embedPng(sig.url)
      const targets = scope === 'all' ? doc.getPageIndices() : [pageNo - 1]
      for (const i of targets) {
        const page = doc.getPage(i)
        const rot = ((page.getRotation().angle % 360) + 360) % 360
        const crop = page.getCropBox()
        const turned = rot === 90 || rot === 270
        const Dw = turned ? crop.height : crop.width
        const Dh = turned ? crop.width : crop.height
        const width = pos.w * Dw
        const height = width * (sig.h / sig.w)
        // Anchor is the signature's bottom-left corner as seen on screen.
        const anchor = toPdfSpace(rot, crop.width, crop.height, pos.x * Dw, pos.y * Dh + height)
        page.drawImage(image, { x: crop.x + anchor.x, y: crop.y + anchor.y, width, height, rotate: degrees(rot) })
      }
      setResult({ name: `${baseName(file.name)}_ttd.pdf`, blob: await savePdf(doc), count: targets.length })
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
    <ToolPage toolId="signature">
      {result ? (
        <ResultPanel
          title="Tanda tangan ditambahkan"
          summary={result.count > 1 ? `Dibubuhkan di ${result.count} halaman` : `Dibubuhkan di halaman ${pageNo}`}
          files={[result]}
          onReset={reset}
        />
      ) : !file ? (
        <Dropzone onFiles={f => setFile(f[0])} />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            <FileRow file={file} meta={numPages ? `${numPages} halaman` : 'membaca…'} onRemove={reset} disabled={busy} />
          </ul>

          <div className="split-layout">
            <div className="panel">
              <Field label="Tanda tangan">
                <Segmented
                  name="sig-source"
                  value={source}
                  onChange={switchSource}
                  options={[
                    { value: 'draw', label: 'Gambar' },
                    { value: 'upload', label: 'Unggah gambar' },
                  ]}
                />
              </Field>

              {source === 'draw' ? (
                <>
                  <div className="sig-pad">
                    <SignatureCanvas ref={padRef} clearOnResize={false} penColor={ink} minWidth={0.8} maxWidth={2.4} onEnd={captureDrawing} canvasProps={{ 'aria-label': 'Area tanda tangan' }} />
                    {!sig && <span className="sig-pad-hint">Tanda tangan di sini</span>}
                  </div>
                  <div className="inline-controls">
                    <div className="chips">
                      {INKS.map(i => (
                        <button
                          key={i.value}
                          type="button"
                          className="chip"
                          data-active={ink === i.value || undefined}
                          onClick={() => {
                            setInk(i.value)
                            clearDrawing()
                          }}
                        >
                          <span className="swatch" style={{ background: i.value }} />
                          {i.label}
                        </button>
                      ))}
                    </div>
                    <button type="button" className="link-btn" onClick={clearDrawing} disabled={!sig}>
                      Hapus coretan
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Dropzone
                    onFiles={onUpload}
                    accept={{ 'image/png': ['.png'], 'image/jpeg': ['.jpg', '.jpeg'], 'image/webp': ['.webp'] }}
                    title={sig ? 'Ganti gambar tanda tangan' : 'Pilih foto atau scan tanda tangan'}
                    hint="PNG transparan paling rapi"
                    compact={Boolean(sig)}
                  />
                  {sig && (
                    <div className="sig-upload-preview">
                      <img src={sig.url} alt="Tanda tangan" />
                    </div>
                  )}
                  <label className="checkbox">
                    <input type="checkbox" checked={dropWhite} onChange={e => setDropWhite(e.target.checked)} />
                    <span>Hapus latar putih dari gambar</span>
                  </label>
                </>
              )}

              {sig && (
                <>
                  <Field label={`Ukuran · ${Math.round(pos.w * 100)}% lebar halaman`} htmlFor="sig-size">
                    <input id="sig-size" className="range" type="range" min={0.08} max={0.6} step={0.01} value={pos.w} onChange={e => setWidth(Number(e.target.value))} />
                  </Field>
                  <Field label="Bubuhkan di">
                    <Segmented
                      name="sig-scope"
                      value={scope}
                      onChange={setScope}
                      options={[
                        { value: 'this', label: `Halaman ${pageNo} saja` },
                        { value: 'all', label: 'Semua halaman' },
                      ]}
                    />
                  </Field>
                </>
              )}
            </div>

            <div className="panel preview-panel">
              <div className="panel-head">
                <h2>{sig ? 'Geser tanda tangan ke posisinya' : 'Pratinjau halaman'}</h2>
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
              <div className="stage" ref={stageRef} style={{ aspectRatio: pageAspect }}>
                {preview ? <img className="stage-page" src={preview.url} alt={`Halaman ${preview.n}`} draggable={false} /> : <span className="page-skeleton" />}
                {sig && (
                  <div
                    className="sig-overlay"
                    style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%`, width: `${pos.w * 100}%` }}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={onPointerUp}
                    onPointerCancel={onPointerUp}
                    onKeyDown={onKeyDown}
                    tabIndex={0}
                    role="slider"
                    aria-label="Posisi tanda tangan. Gunakan tombol panah untuk menggeser."
                    aria-valuetext={`${Math.round(pos.x * 100)}% dari kiri, ${Math.round(pos.y * 100)}% dari atas`}
                  >
                    <img src={sig.url} alt="" draggable={false} />
                  </div>
                )}
              </div>
              {!sig && (
                <p className="panel-note stage-note">
                  {source === 'draw' ? <IconSignature size={14} /> : <IconUpload size={14} />}
                  {source === 'draw' ? 'Buat tanda tangan di kiri, lalu atur posisinya di sini.' : 'Unggah gambar tanda tangan, lalu atur posisinya di sini.'}
                </p>
              )}
            </div>
          </div>

          <div className="action-bar">
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={apply} disabled={busy || !sig || !numPages}>
              {busy ? <Spinner /> : <IconSignature size={17} />}
              {busy ? 'Menyimpan…' : 'Bubuhkan tanda tangan'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
