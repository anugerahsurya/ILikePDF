import { useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { usePagePreview } from '../components/PdfPreview'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconCrop, IconArrowLeft, IconArrowRight } from '../components/Icons'
import { loadEditablePdf, savePdf } from '../utils/pdfConfig'
import { baseName } from '../utils/files'

// 1 mm ≈ 2.83465 pt
const MM_TO_PT = 2.83465

const TARGET_OPTIONS = [
  { value: 'all', label: 'Semua Halaman' },
  { value: 'current', label: 'Hanya Halaman Ini' },
]

export default function CropPdf() {
  const [file, setFile] = useState(null)
  const [pageNo, setPageNo] = useState(1)
  const { numPages, preview } = usePagePreview(file, pageNo)
  const [topMm, setTopMm] = useState(15)
  const [bottomMm, setBottomMm] = useState(15)
  const [leftMm, setLeftMm] = useState(15)
  const [rightMm, setRightMm] = useState(15)
  const [target, setTarget] = useState('all')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const page = preview?.size || { width: 595, height: 842 }

  const topPt = Math.round(topMm * MM_TO_PT)
  const bottomPt = Math.round(bottomMm * MM_TO_PT)
  const leftPt = Math.round(leftMm * MM_TO_PT)
  const rightPt = Math.round(rightMm * MM_TO_PT)

  const setPreset = (t, b, l, r) => {
    setTopMm(t)
    setBottomMm(b)
    setLeftMm(l)
    setRightMm(r)
  }

  const apply = async () => {
    setBusy(true)
    try {
      const doc = await loadEditablePdf(file)
      const pages = doc.getPages()
      let croppedCount = 0

      pages.forEach((pdfPage, idx) => {
        if (target === 'current' && idx !== pageNo - 1) return

        const box = pdfPage.getCropBox()
        const newX = box.x + leftPt
        const newY = box.y + bottomPt
        const newW = Math.max(50, box.width - leftPt - rightPt)
        const newH = Math.max(50, box.height - topPt - bottomPt)

        pdfPage.setCropBox(newX, newY, newW, newH)
        pdfPage.setMediaBox(newX, newY, newW, newH)
        croppedCount++
      })

      const blob = await savePdf(doc)
      setResult({
        name: `${baseName(file.name)}_dipotong.pdf`,
        blob,
        croppedCount,
      })
    } catch (err) {
      toast.error(`Gagal memotong halaman: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPageNo(1)
    setResult(null)
  }

  const topPct = Math.min(45, (topPt / page.height) * 100)
  const bottomPct = Math.min(45, (bottomPt / page.height) * 100)
  const leftPct = Math.min(45, (leftPt / page.width) * 100)
  const rightPct = Math.min(45, (rightPt / page.width) * 100)

  return (
    <ToolPage toolId="crop-pdf">
      {result ? (
        <ResultPanel
          title="Margin PDF Berhasil Dipotong"
          summary={`Diterapkan pada ${result.croppedCount} halaman`}
          files={[result]}
          onReset={reset}
        />
      ) : !file ? (
        <Dropzone
          onFiles={f => setFile(f[0])}
          title="Pilih file PDF yang ingin dipotong marginnya"
          hint="Potong tepi atas, bawah, kiri, dan kanan halaman secara presisi"
        />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            <FileRow
              file={file}
              meta={numPages ? `${numPages} halaman` : 'membaca…'}
              onRemove={reset}
              disabled={busy}
            />
          </ul>

          <div className="split-layout">
            <div className="panel">
              <Field label="Preset Pemotongan Cepat">
                <div className="chips">
                  <button type="button" className="chip" onClick={() => setPreset(10, 10, 10, 10)}>
                    Tipis (10 mm)
                  </button>
                  <button type="button" className="chip" onClick={() => setPreset(20, 20, 20, 20)}>
                    Sedang (20 mm)
                  </button>
                  <button type="button" className="chip" onClick={() => setPreset(25, 25, 0, 0)}>
                    Potong Header & Footer
                  </button>
                  <button type="button" className="chip" onClick={() => setPreset(0, 0, 0, 0)}>
                    Reset (0 mm)
                  </button>
                </div>
              </Field>

              <div className="panel-grid-2" style={{ marginTop: '20px' }}>
                <Field label={`Atas · ${topMm} mm`} htmlFor="crop-top">
                  <input
                    id="crop-top"
                    type="range"
                    className="range"
                    min={0}
                    max={80}
                    value={topMm}
                    onChange={e => setTopMm(Number(e.target.value))}
                  />
                </Field>
                <Field label={`Bawah · ${bottomMm} mm`} htmlFor="crop-bottom">
                  <input
                    id="crop-bottom"
                    type="range"
                    className="range"
                    min={0}
                    max={80}
                    value={bottomMm}
                    onChange={e => setBottomMm(Number(e.target.value))}
                  />
                </Field>
                <Field label={`Kiri · ${leftMm} mm`} htmlFor="crop-left">
                  <input
                    id="crop-left"
                    type="range"
                    className="range"
                    min={0}
                    max={80}
                    value={leftMm}
                    onChange={e => setLeftMm(Number(e.target.value))}
                  />
                </Field>
                <Field label={`Kanan · ${rightMm} mm`} htmlFor="crop-right">
                  <input
                    id="crop-right"
                    type="range"
                    className="range"
                    min={0}
                    max={80}
                    value={rightMm}
                    onChange={e => setRightMm(Number(e.target.value))}
                  />
                </Field>
              </div>

              <Field label="Terapkan ke">
                <Segmented name="crop-target" value={target} onChange={setTarget} options={TARGET_OPTIONS} />
              </Field>
            </div>

            <div className="panel preview-panel">
              <div className="panel-head">
                <h2>Area Pemotongan</h2>
                <div className="pager">
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setPageNo(n => n - 1)}
                    disabled={pageNo <= 1}
                    aria-label="Halaman sebelumnya"
                  >
                    <IconArrowLeft size={15} />
                  </button>
                  <span className="mono">
                    {pageNo} / {numPages || '–'}
                  </span>
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setPageNo(n => n + 1)}
                    disabled={pageNo >= numPages}
                    aria-label="Halaman berikutnya"
                  >
                    <IconArrowRight size={15} />
                  </button>
                </div>
              </div>

              <div className="stage" style={{ aspectRatio: page.width / page.height }}>
                {preview ? (
                  <img className="stage-page" src={preview.url} alt={`Halaman ${preview.n}`} />
                ) : (
                  <span className="page-skeleton" />
                )}
                {/* Shaded outer region and dashed inner crop frame */}
                <div
                  style={{
                    position: 'absolute',
                    top: `${topPct}%`,
                    bottom: `${bottomPct}%`,
                    left: `${leftPct}%`,
                    right: `${rightPct}%`,
                    border: '2px dashed var(--accent)',
                    boxShadow: '0 0 0 9999px rgba(20, 20, 18, 0.42)',
                    pointerEvents: 'none',
                  }}
                />
              </div>
              <p className="field-hint" style={{ marginTop: '10px' }}>
                Area terang di dalam garis putus-putus adalah bagian halaman yang akan dipertahankan.
              </p>
            </div>
          </div>

          <div className="action-bar">
            <p className="action-note">
              {target === 'all' ? `Memotong semua ${numPages || ''} halaman.` : `Hanya memotong halaman ${pageNo}.`}
            </p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={apply}
              disabled={busy || !numPages || (topMm === 0 && bottomMm === 0 && leftMm === 0 && rightMm === 0)}
            >
              {busy ? <Spinner /> : <IconCrop size={17} />}
              {busy ? 'Memotong…' : 'Potong PDF'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
