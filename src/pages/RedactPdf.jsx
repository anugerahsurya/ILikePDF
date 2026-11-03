import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { PDFDocument, rgb } from '@cantoo/pdf-lib'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { usePagePreview } from '../components/PdfPreview'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconRedact, IconArrowLeft, IconArrowRight, IconClose, IconPlus } from '../components/Icons'
import { loadEditablePdf, savePdf, openPdfjs, renderPage, canvasToBlob, closePdf } from '../utils/pdfConfig'
import { baseName } from '../utils/files'

const FILL_COLORS = [
  { value: '#000000', label: 'Hitam (Redaksi Resmi)' },
  { value: '#FFFFFF', label: 'Putih (Tutup Bersih)' },
  { value: '#374151', label: 'Abu-abu Gelap' },
]

const hexToRgb = hex =>
  rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  )

let nextBoxId = 1

export default function RedactPdf() {
  const [file, setFile] = useState(null)
  const [pageNo, setPageNo] = useState(1)
  const { numPages, preview } = usePagePreview(file, pageNo)
  const [boxes, setBoxes] = useState([]) // [{ id, page: 1..N, xPct, yPct, wPct, hPct, color, applyAll }]
  const [fillColor, setFillColor] = useState('#000000')
  const [flattenPages, setFlattenPages] = useState(true)
  const [drawing, setDrawing] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const stageRef = useRef(null)

  const page = preview?.size || { width: 595, height: 842 }
  const visibleBoxes = boxes.filter(b => b.applyAll || b.page === pageNo)

  const getRelativeCoords = e => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))
    return { x, y }
  }

  const handlePointerDown = e => {
    if (e.target.closest('button')) return
    const { x, y } = getRelativeCoords(e)
    setDrawing({ startX: x, startY: y, curX: x, curY: y })
  }

  const handlePointerMove = e => {
    if (!drawing) return
    const { x, y } = getRelativeCoords(e)
    setDrawing(d => (d ? { ...d, curX: x, curY: y } : null))
  }

  const handlePointerUp = () => {
    if (!drawing) return
    const xPct = Math.min(drawing.startX, drawing.curX)
    const yPct = Math.min(drawing.startY, drawing.curY)
    const wPct = Math.abs(drawing.curX - drawing.startX)
    const hPct = Math.abs(drawing.curY - drawing.startY)
    setDrawing(null)

    if (wPct < 2 || hPct < 1.2) return

    setBoxes(prev => [
      ...prev,
      {
        id: nextBoxId++,
        page: pageNo,
        xPct,
        yPct,
        wPct,
        hPct,
        color: fillColor,
        applyAll: false,
      },
    ])
  }

  const addQuickBox = () => {
    setBoxes(prev => [
      ...prev,
      {
        id: nextBoxId++,
        page: pageNo,
        xPct: 20,
        yPct: 42,
        wPct: 60,
        hPct: 8,
        color: fillColor,
        applyAll: false,
      },
    ])
  }

  const toggleApplyAll = id => {
    setBoxes(prev => prev.map(b => (b.id === id ? { ...b, applyAll: !b.applyAll } : b)))
  }

  const removeBox = id => {
    setBoxes(prev => prev.filter(b => b.id !== id))
  }

  const apply = async () => {
    if (!boxes.length) {
      toast.error('Buat minimal 1 kotak area sensor terlebih dahulu.')
      return
    }
    setBusy(true)
    let pdfjsDoc = null
    try {
      if (flattenPages) {
        // Rasterize pages & burn redactions into pixels so underlying text cannot be extracted
        pdfjsDoc = await openPdfjs(file)
        const outDoc = await PDFDocument.create()

        for (let p = 1; p <= pdfjsDoc.numPages; p++) {
          const pdfPage = await pdfjsDoc.getPage(p)
          const vp = pdfPage.getViewport({ scale: 1 })
          const canvas = await renderPage(pdfPage, 2.0) // ~144 DPI crisp render
          const ctx = canvas.getContext('2d')

          const pageBoxes = boxes.filter(b => b.applyAll || b.page === p)
          for (const b of pageBoxes) {
            ctx.fillStyle = b.color
            ctx.fillRect(
              (b.xPct / 100) * canvas.width,
              (b.yPct / 100) * canvas.height,
              (b.wPct / 100) * canvas.width,
              (b.hPct / 100) * canvas.height,
            )
          }

          const jpgBlob = await canvasToBlob(canvas, 'image/jpeg', 0.9)
          const jpgBytes = await jpgBlob.arrayBuffer()
          const embedded = await outDoc.embedJpg(jpgBytes)
          const newPage = outDoc.addPage([vp.width, vp.height])
          newPage.drawImage(embedded, {
            x: 0,
            y: 0,
            width: vp.width,
            height: vp.height,
          })
        }

        const blob = await savePdf(outDoc)
        setResult({
          name: `${baseName(file.name)}_disensor.pdf`,
          blob,
          count: boxes.length,
        })
      } else {
        const doc = await loadEditablePdf(file)
        const pages = doc.getPages()
        pages.forEach((pdfPage, idx) => {
          const p = idx + 1
          const crop = pdfPage.getCropBox()
          const W = crop.width
          const H = crop.height
          const pageBoxes = boxes.filter(b => b.applyAll || b.page === p)

          for (const b of pageBoxes) {
            const rectW = (b.wPct / 100) * W
            const rectH = (b.hPct / 100) * H
            const rectX = crop.x + (b.xPct / 100) * W
            const rectY = crop.y + H - (b.yPct / 100) * H - rectH
            pdfPage.drawRectangle({
              x: rectX,
              y: rectY,
              width: rectW,
              height: rectH,
              color: hexToRgb(b.color),
              opacity: 1,
            })
          }
        })
        const blob = await savePdf(doc)
        setResult({
          name: `${baseName(file.name)}_disensor.pdf`,
          blob,
          count: boxes.length,
        })
      }
      toast.success('Area rahasia berhasil disensor!')
    } catch (err) {
      toast.error(`Gagal menyensor PDF: ${err.message}`)
    } finally {
      closePdf(pdfjsDoc)
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setPageNo(1)
    setBoxes([])
    setResult(null)
  }

  return (
    <ToolPage toolId="redact-pdf">
      {result ? (
        <ResultPanel
          title="Dokumen PDF Berhasil Disensor"
          summary={`${result.count} area sensor diterapkan secara permanen`}
          files={[result]}
          onReset={reset}
        />
      ) : !file ? (
        <Dropzone
          onFiles={f => setFile(f[0])}
          title="Pilih file PDF yang ingin disensor (Redaksi)"
          hint="Tarik kotak pada pratinjau halaman untuk menutup NIK, NIP, nomor rekening, atau data rahasia"
        />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            <FileRow
              file={file}
              meta={numPages ? `${numPages} halaman · ${boxes.length} kotak sensor` : 'membaca…'}
              onRemove={reset}
              disabled={busy}
            />
          </ul>

          <div className="split-layout">
            <div className="panel">
              <Field label="Warna Kotak Sensor">
                <Segmented name="redact-color" value={fillColor} onChange={setFillColor} options={FILL_COLORS} />
              </Field>

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={flattenPages}
                    onChange={e => setFlattenPages(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>
                      Ratakan Halaman (Hapus Teks di Balik Sensor)
                    </span>
                    <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-3)' }}>
                      Mengubah halaman menjadi lapisan datar sehingga teks di bawah kotak hitam tidak bisa di-copy atau dicari.
                    </p>
                  </div>
                </label>
              </div>

              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <strong style={{ fontSize: '14px' }}>Daftar Kotak Sensor ({boxes.length})</strong>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addQuickBox}>
                    <IconPlus size={14} />
                    Tambah Kotak
                  </button>
                </div>

                {boxes.length === 0 ? (
                  <p className="field-hint">
                    Klik dan seret (drag) langsung pada gambar pratinjau halaman di sebelah kanan untuk menandai area yang ingin ditutup.
                  </p>
                ) : (
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                    {boxes.map((b, i) => (
                      <li
                        key={b.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '8px',
                          padding: '8px 10px',
                          background: 'var(--bg)',
                          borderRadius: '8px',
                          fontSize: '13px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '3px',
                              background: b.color,
                              border: '1px solid var(--border-strong)',
                            }}
                          />
                          <span>
                            Sensor #{i + 1} ({b.applyAll ? 'Semua Hal.' : `Hal. ${b.page}`})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={b.applyAll}
                              onChange={() => toggleApplyAll(b.id)}
                            />
                            Semua hal.
                          </label>
                          <button
                            type="button"
                            className="btn-icon btn-icon-sm btn-icon-danger"
                            onClick={() => removeBox(b.id)}
                          >
                            <IconClose size={13} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="panel preview-panel">
              <div className="panel-head">
                <h2>Tarik Kotak pada Halaman</h2>
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

              <div
                ref={stageRef}
                className="stage"
                style={{
                  aspectRatio: page.width / page.height,
                  cursor: 'crosshair',
                }}
                onMouseDown={handlePointerDown}
                onMouseMove={handlePointerMove}
                onMouseUp={handlePointerUp}
                onMouseLeave={handlePointerUp}
              >
                {preview ? (
                  <img className="stage-page" src={preview.url} alt={`Halaman ${preview.n}`} draggable={false} />
                ) : (
                  <span className="page-skeleton" />
                )}

                {visibleBoxes.map(b => (
                  <div
                    key={b.id}
                    style={{
                      position: 'absolute',
                      left: `${b.xPct}%`,
                      top: `${b.yPct}%`,
                      width: `${b.wPct}%`,
                      height: `${b.hPct}%`,
                      background: b.color,
                      border: '1.5px solid var(--accent)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-end',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => removeBox(b.id)}
                      style={{
                        width: '18px',
                        height: '18px',
                        border: 0,
                        background: 'var(--danger)',
                        color: '#fff',
                        fontSize: '11px',
                        lineHeight: 1,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                      title="Hapus kotak sensor ini"
                    >
                      ×
                    </button>
                  </div>
                ))}

                {drawing && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${Math.min(drawing.startX, drawing.curX)}%`,
                      top: `${Math.min(drawing.startY, drawing.curY)}%`,
                      width: `${Math.abs(drawing.curX - drawing.startX)}%`,
                      height: `${Math.abs(drawing.curY - drawing.startY)}%`,
                      background: fillColor,
                      opacity: 0.75,
                      border: '1.5px dashed var(--accent)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
              <p className="field-hint" style={{ marginTop: '10px' }}>
                Klik tahan dan geser kursor di atas teks/area halaman untuk membuat kotak sensor baru.
              </p>
            </div>
          </div>

          <div className="action-bar">
            <p className="action-note">{boxes.length} area sensor ditandai.</p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={apply}
              disabled={busy || boxes.length === 0}
            >
              {busy ? <Spinner /> : <IconRedact size={17} />}
              {busy ? 'Memproses…' : 'Terapkan Sensor & Simpan'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
