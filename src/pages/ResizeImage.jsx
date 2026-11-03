import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconResize, IconRotate } from '../components/Icons'
import { baseName } from '../utils/files'

const ACCEPT_IMAGES = {
  'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.bmp'],
}

const MODES = [
  { value: 'pixels', label: 'Piksel (px)' },
  { value: 'percent', label: 'Persentase (%)' },
  { value: 'preset', label: 'Preset Pasfoto & Standar' },
]

const PRESETS = [
  { id: '2x3', label: 'Pasfoto 2×3 cm (300 DPI)', w: 236, h: 354 },
  { id: '3x4', label: 'Pasfoto 3×4 cm (300 DPI)', w: 354, h: 472 },
  { id: '4x6', label: 'Pasfoto 4×6 cm (300 DPI)', w: 472, h: 709 },
  { id: 'square', label: 'Persegi 1:1 (1080×1080)', w: 1080, h: 1080 },
  { id: 'hd', label: 'HD (1280×720)', w: 1280, h: 720 },
  { id: 'fhd', label: 'Full HD (1920×1080)', w: 1920, h: 1080 },
]

const FIT_MODES = [
  { value: 'cover', label: 'Potong Tengah (Proporsional)' },
  { value: 'contain', label: 'Muat Utuh (Beri Latar)' },
  { value: 'stretch', label: 'Rentangkan Penuh' },
]

export default function ResizeImage() {
  const [file, setFile] = useState(null)
  const [imgObj, setImgObj] = useState(null)
  const [imgUrl, setImgUrl] = useState('')
  const [mode, setMode] = useState('pixels')
  const [width, setWidth] = useState(800)
  const [height, setHeight] = useState(600)
  const [lockAspect, setLockAspect] = useState(true)
  const [percent, setPercent] = useState(50)
  const [presetId, setPresetId] = useState('3x4')
  const [fitMode, setFitMode] = useState('cover')
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!file) {
      setImgObj(null)
      setImgUrl('')
      return
    }
    const url = URL.createObjectURL(file)
    setImgUrl(url)
    const img = new Image()
    img.onload = () => {
      setImgObj(img)
      setWidth(img.naturalWidth)
      setHeight(img.naturalHeight)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const origW = imgObj ? (rotation % 180 !== 0 ? imgObj.naturalHeight : imgObj.naturalWidth) : 800
  const origH = imgObj ? (rotation % 180 !== 0 ? imgObj.naturalWidth : imgObj.naturalHeight) : 600
  const aspect = origW / Math.max(1, origH)

  const handleWidthChange = val => {
    const w = Math.max(1, Number(val) || 1)
    setWidth(w)
    if (lockAspect) {
      setHeight(Math.max(1, Math.round(w / aspect)))
    }
  }

  const handleHeightChange = val => {
    const h = Math.max(1, Number(val) || 1)
    setHeight(h)
    if (lockAspect) {
      setWidth(Math.max(1, Math.round(h * aspect)))
    }
  }

  const getTargetDimensions = () => {
    if (mode === 'percent') {
      return {
        w: Math.max(1, Math.round((origW * percent) / 100)),
        h: Math.max(1, Math.round((origH * percent) / 100)),
      }
    }
    if (mode === 'preset') {
      const p = PRESETS.find(x => x.id === presetId) || PRESETS[1]
      return { w: p.w, h: p.h }
    }
    return { w: Math.max(1, width), h: Math.max(1, height) }
  }

  const targetDim = getTargetDimensions()

  const apply = async () => {
    if (!imgObj) return
    setBusy(true)
    try {
      // 1. First create an intermediate canvas with rotation & flip applied
      const rotCanvas = document.createElement('canvas')
      rotCanvas.width = origW
      rotCanvas.height = origH
      const rCtx = rotCanvas.getContext('2d')
      rCtx.translate(origW / 2, origH / 2)
      rCtx.rotate((rotation * Math.PI) / 180)
      if (flipH) rCtx.scale(-1, 1)
      rCtx.drawImage(imgObj, -imgObj.naturalWidth / 2, -imgObj.naturalHeight / 2)

      // 2. Render into final target dimensions
      const outCanvas = document.createElement('canvas')
      outCanvas.width = targetDim.w
      outCanvas.height = targetDim.h
      const ctx = outCanvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, targetDim.w, targetDim.h)

      if (fitMode === 'stretch' || (mode === 'pixels' && lockAspect) || mode === 'percent') {
        ctx.drawImage(rotCanvas, 0, 0, targetDim.w, targetDim.h)
      } else if (fitMode === 'contain') {
        const scale = Math.min(targetDim.w / origW, targetDim.h / origH)
        const dw = origW * scale
        const dh = origH * scale
        ctx.drawImage(rotCanvas, (targetDim.w - dw) / 2, (targetDim.h - dh) / 2, dw, dh)
      } else {
        // 'cover' center crop
        const scale = Math.max(targetDim.w / origW, targetDim.h / origH)
        const sw = targetDim.w / scale
        const sh = targetDim.h / scale
        const sx = (origW - sw) / 2
        const sy = (origH - sh) / 2
        ctx.drawImage(rotCanvas, sx, sy, sw, sh, 0, 0, targetDim.w, targetDim.h)
      }

      const outType = file.type === 'image/png' ? 'image/png' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg'
      const ext = outType === 'image/png' ? 'png' : outType === 'image/webp' ? 'webp' : 'jpg'

      const blob = await new Promise((resolve, reject) =>
        outCanvas.toBlob(b => (b ? resolve(b) : reject(new Error('Gagal menyimpan gambar'))), outType, 0.92),
      )

      setResult({
        name: `${baseName(file.name)}_${targetDim.w}x${targetDim.h}.${ext}`,
        blob,
        w: targetDim.w,
        h: targetDim.h,
      })
      toast.success(`Ukuran gambar berhasil diubah menjadi ${targetDim.w} × ${targetDim.h} px!`)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setRotation(0)
    setFlipH(false)
    setResult(null)
  }

  return (
    <ToolPage toolId="resize-image">
      {result ? (
        <ResultPanel
          title="Ukuran Gambar Berhasil Diubah"
          summary={`Dimensi baru: ${result.w} × ${result.h} px`}
          files={[result]}
          onReset={reset}
        />
      ) : !file ? (
        <Dropzone
          accept={ACCEPT_IMAGES}
          onFiles={f => setFile(f[0])}
          title="Pilih gambar untuk diubah ukurannya atau dipotong"
          hint="Mendukung ukuran piksel kustom, persentase, serta preset Pasfoto 2×3, 3×4, dan 4×6 cm"
        />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            <FileRow
              file={file}
              thumb={imgUrl}
              meta={
                imgObj
                  ? `Asli: ${imgObj.naturalWidth} × ${imgObj.naturalHeight} px → Baru: ${targetDim.w} × ${targetDim.h} px`
                  : 'membaca…'
              }
              onRemove={reset}
              disabled={busy}
            />
          </ul>

          <div className="split-layout">
            <div className="panel">
              <Field label="Metode Pengaturan Ukuran">
                <Segmented name="rsz-mode" value={mode} onChange={setMode} options={MODES} />
              </Field>

              {mode === 'pixels' && (
                <>
                  <div className="panel-grid-2" style={{ marginTop: '16px' }}>
                    <Field label="Lebar (Width px)" htmlFor="rsz-w">
                      <input
                        id="rsz-w"
                        type="number"
                        min={1}
                        max={10000}
                        className="input"
                        value={width}
                        onChange={e => handleWidthChange(e.target.value)}
                      />
                    </Field>
                    <Field label="Tinggi (Height px)" htmlFor="rsz-h">
                      <input
                        id="rsz-h"
                        type="number"
                        min={1}
                        max={10000}
                        className="input"
                        value={height}
                        onChange={e => handleHeightChange(e.target.value)}
                      />
                    </Field>
                  </div>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={lockAspect}
                      onChange={e => setLockAspect(e.target.checked)}
                    />
                    <span>Kunci rasio proporsi asli (cegah gambar gepeng)</span>
                  </label>
                </>
              )}

              {mode === 'percent' && (
                <Field label={`Skala Ukuran · ${percent}% (${targetDim.w} × ${targetDim.h} px)`}>
                  <div className="chips" style={{ marginBottom: '12px' }}>
                    {[25, 50, 75, 100, 150, 200].map(p => (
                      <button
                        key={p}
                        type="button"
                        className="chip"
                        data-active={percent === p || undefined}
                        onClick={() => setPercent(p)}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    className="range"
                    min={10}
                    max={200}
                    value={percent}
                    onChange={e => setPercent(Number(e.target.value))}
                  />
                </Field>
              )}

              {mode === 'preset' && (
                <>
                  <Field label="Pilih Preset Ukuran">
                    <div className="chips">
                      {PRESETS.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          className="chip"
                          data-active={presetId === p.id || undefined}
                          onClick={() => setPresetId(p.id)}
                        >
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Penyesuaian Pemotongan">
                    <Segmented name="fit-mode" value={fitMode} onChange={setFitMode} options={FIT_MODES} />
                  </Field>
                </>
              )}

              <Field label="Putar & Balik Gambar">
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setRotation(r => (r + 90) % 360)}
                  >
                    <IconRotate size={14} />
                    Putar 90°
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setFlipH(f => !f)}
                  >
                    ↔ Balik Horizontal {flipH ? '(Aktif)' : ''}
                  </button>
                </div>
              </Field>
            </div>

            <div className="panel preview-panel">
              <div className="panel-head">
                <h2>Pratinjau Proporsi ({targetDim.w} × {targetDim.h} px)</h2>
              </div>
              <div
                className="stage"
                style={{
                  aspectRatio: targetDim.w / targetDim.h,
                  maxHeight: '420px',
                  marginInline: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#ffffff',
                }}
              >
                {imgUrl && (
                  <img
                    src={imgUrl}
                    alt="Pratinjau"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit:
                        mode === 'preset' || (mode === 'pixels' && !lockAspect) ? fitMode : 'contain',
                      transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="action-bar">
            <p className="action-note">
              Ukuran hasil: {targetDim.w} × {targetDim.h} piksel.
            </p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti gambar
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={apply} disabled={busy || !imgObj}>
              {busy ? <Spinner /> : <IconResize size={17} />}
              {busy ? 'Memproses…' : 'Simpan Gambar'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
