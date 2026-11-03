import { useState } from 'react'
import { toast } from 'sonner'
import { rgb, StandardFonts, degrees } from '@cantoo/pdf-lib'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { usePagePreview } from '../components/PdfPreview'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconPageNumbers, IconArrowLeft, IconArrowRight } from '../components/Icons'
import { loadEditablePdf, savePdf } from '../utils/pdfConfig'
import { baseName } from '../utils/files'

const POSITIONS = [
  { value: 'bottom-center', label: 'Bawah Tengah' },
  { value: 'bottom-right', label: 'Bawah Kanan' },
  { value: 'bottom-left', label: 'Bawah Kiri' },
  { value: 'top-center', label: 'Atas Tengah' },
  { value: 'top-right', label: 'Atas Kanan' },
  { value: 'top-left', label: 'Atas Kiri' },
]

const FORMATS = [
  { value: 'n', label: '1, 2, 3' },
  { value: 'dash', label: '- 1 -' },
  { value: 'n-of-total', label: '1 / N' },
  { value: 'page-n', label: 'Halaman 1' },
  { value: 'page-n-of-total', label: 'Halaman 1 dari N' },
]

const COLORS = ['#111827', '#4B5563', '#1D4ED8', '#DC2626']

function formatPageLabel(fmt, num, total) {
  if (fmt === 'dash') return `- ${num} -`
  if (fmt === 'n-of-total') return `${num} / ${total}`
  if (fmt === 'page-n') return `Halaman ${num}`
  if (fmt === 'page-n-of-total') return `Halaman ${num} dari ${total}`
  return String(num)
}

const hexToRgb = hex =>
  rgb(
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  )

export default function PageNumbers() {
  const [file, setFile] = useState(null)
  const [pageNo, setPageNo] = useState(1)
  const { numPages, preview } = usePagePreview(file, pageNo)
  const [position, setPosition] = useState('bottom-center')
  const [format, setFormat] = useState('n-of-total')
  const [startNum, setStartNum] = useState(1)
  const [fromPage, setFromPage] = useState(1)
  const [fontSize, setFontSize] = useState(11)
  const [margin, setMargin] = useState(28)
  const [color, setColor] = useState(COLORS[0])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const page = preview?.size || { width: 595, height: 842 }
  const totalNumbered = Math.max(1, (numPages || 1) - Math.max(1, fromPage) + Number(startNum || 1))
  const currentNum = pageNo - Math.max(1, fromPage) + Number(startNum || 1)
  const showOnCurrent = pageNo >= Math.max(1, fromPage)
  const previewLabel = formatPageLabel(format, currentNum, totalNumbered)

  const getPreviewPositionStyle = () => {
    const isTop = position.startsWith('top')
    const isLeft = position.endsWith('left')
    const isRight = position.endsWith('right')
    const marginPctX = (margin / page.width) * 100
    const marginPctY = (margin / page.height) * 100

    return {
      position: 'absolute',
      top: isTop ? `${marginPctY}%` : 'auto',
      bottom: !isTop ? `${marginPctY}%` : 'auto',
      left: isLeft ? `${marginPctX}%` : isRight ? 'auto' : '50%',
      right: isRight ? `${marginPctX}%` : 'auto',
      transform: !isLeft && !isRight ? 'translateX(-50%)' : 'none',
      fontSize: `${(fontSize / page.width) * 100}cqw`,
      fontWeight: 600,
      color,
      pointerEvents: 'none',
      whiteSpace: 'nowrap',
    }
  }

  const apply = async () => {
    setBusy(true)
    try {
      const doc = await loadEditablePdf(file)
      const font = await doc.embedFont(StandardFonts.Helvetica)
      const pages = doc.getPages()
      const startPageIdx = Math.max(0, (Number(fromPage) || 1) - 1)
      const firstNumber = Number(startNum) || 1
      const totalCount = Math.max(1, pages.length - startPageIdx + firstNumber - 1)
      let numberedCount = 0

      pages.forEach((pdfPage, idx) => {
        if (idx < startPageIdx) return
        const num = idx - startPageIdx + firstNumber
        const text = formatPageLabel(format, num, totalCount)
        const crop = pdfPage.getCropBox()
        const W = crop.width
        const H = crop.height
        const tw = font.widthOfTextAtSize(text, fontSize)
        const th = font.heightAtSize(fontSize, { descender: false })

        const isTop = position.startsWith('top')
        const isLeft = position.endsWith('left')
        const isRight = position.endsWith('right')

        let x = crop.x + (W - tw) / 2
        if (isLeft) x = crop.x + margin
        if (isRight) x = crop.x + W - margin - tw

        let y = isTop ? crop.y + H - margin - th : crop.y + margin

        pdfPage.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: hexToRgb(color),
          rotate: degrees(0),
        })
        numberedCount++
      })

      const blob = await savePdf(doc)
      setResult({
        name: `${baseName(file.name)}_bernomor.pdf`,
        blob,
        numberedCount,
      })
    } catch (err) {
      toast.error(`Gagal memberi nomor halaman: ${err.message}`)
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
    <ToolPage toolId="page-numbers">
      {result ? (
        <ResultPanel
          title="Nomor Halaman Ditambahkan"
          summary={`Nomor halaman diterapkan pada ${result.numberedCount} halaman`}
          files={[result]}
          onReset={reset}
        />
      ) : !file ? (
        <Dropzone
          onFiles={f => setFile(f[0])}
          title="Pilih file PDF untuk diberi nomor halaman"
          hint="Atur posisi, format penomoran, halaman awal, dan ukuran huruf"
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
              <Field label="Posisi Nomor Halaman">
                <Segmented name="pn-pos" value={position} onChange={setPosition} options={POSITIONS} />
              </Field>

              <Field label="Format Penomoran">
                <Segmented name="pn-fmt" value={format} onChange={setFormat} options={FORMATS} />
              </Field>

              <div className="panel-grid-2" style={{ marginTop: '20px' }}>
                <Field label="Mulai dari Angka" htmlFor="pn-start" hint="Angka pertama yang dicetak">
                  <input
                    id="pn-start"
                    type="number"
                    min={1}
                    max={9999}
                    className="input"
                    value={startNum}
                    onChange={e => setStartNum(Math.max(1, Number(e.target.value) || 1))}
                  />
                </Field>
                <Field label="Mulai pada Halaman PDF ke-" htmlFor="pn-from" hint="Isi 2 untuk melewati halaman sampul">
                  <input
                    id="pn-from"
                    type="number"
                    min={1}
                    max={numPages || 999}
                    className="input"
                    value={fromPage}
                    onChange={e => setFromPage(Math.max(1, Number(e.target.value) || 1))}
                  />
                </Field>
              </div>

              <Field label={`Ukuran Huruf · ${fontSize} pt`} htmlFor="pn-size">
                <input
                  id="pn-size"
                  className="range"
                  type="range"
                  min={8}
                  max={24}
                  value={fontSize}
                  onChange={e => setFontSize(Number(e.target.value))}
                />
              </Field>

              <Field label={`Jarak dari Tepi (Margin) · ${margin} pt`} htmlFor="pn-margin">
                <input
                  id="pn-margin"
                  className="range"
                  type="range"
                  min={14}
                  max={72}
                  value={margin}
                  onChange={e => setMargin(Number(e.target.value))}
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
                      aria-label={`Warna ${c}`}
                    >
                      <span className="swatch" style={{ background: c }} />
                    </button>
                  ))}
                  <label className="chip chip-swatch" data-active={!COLORS.includes(color) || undefined} title="Warna lain">
                    <input type="color" value={color} onChange={e => setColor(e.target.value.toUpperCase())} />
                  </label>
                </div>
              </Field>
            </div>

            <div className="panel preview-panel">
              <div className="panel-head">
                <h2>Pratinjau</h2>
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
                {showOnCurrent && <span style={getPreviewPositionStyle()}>{previewLabel}</span>}
              </div>
              {!showOnCurrent && (
                <p className="field-hint" style={{ marginTop: '10px' }}>
                  Halaman {pageNo} dilewati karena penomoran dimulai dari halaman ke-{fromPage}.
                </p>
              )}
            </div>
          </div>

          <div className="action-bar">
            <p className="action-note">
              Diterapkan mulai halaman {fromPage} hingga {numPages || 1}.
            </p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={apply} disabled={busy || !numPages}>
              {busy ? <Spinner /> : <IconPageNumbers size={17} />}
              {busy ? 'Menyimpan…' : 'Tambahkan Nomor Halaman'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
