import { useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconWord, IconCopy, IconCheck } from '../components/Icons'
import { openPdfjs, closePdf } from '../utils/pdfConfig'
import { baseName } from '../utils/files'
import { buildCleanDocxFromParagraphs } from '../utils/watermarkCleaner'

const FORMAT_OPTIONS = [
  { value: 'docx', label: 'Word (.docx)' },
  { value: 'txt', label: 'Teks (.txt)' },
  { value: 'md', label: 'Markdown (.md)' },
]

/**
 * Reconstruct natural lines and paragraphs from PDF.js text items using Y/X coordinates.
 */
function reconstructPageParagraphs(items) {
  if (!items || !items.length) return []

  // Sort items top-to-bottom (descending Y in PDF space), then left-to-right (ascending X)
  const positioned = items
    .filter(it => it.str && it.str.trim())
    .map(it => ({
      str: it.str,
      x: it.transform ? it.transform[4] : 0,
      y: it.transform ? it.transform[5] : 0,
      h: Math.abs(it.height || (it.transform ? it.transform[3] : 12)) || 12,
    }))

  positioned.sort((a, b) => {
    if (Math.abs(b.y - a.y) > 4) return b.y - a.y
    return a.x - b.x
  })

  const lines = []
  let curLine = null

  for (const item of positioned) {
    if (!curLine || Math.abs(item.y - curLine.y) > Math.max(4, curLine.h * 0.45)) {
      if (curLine) lines.push(curLine)
      curLine = { y: item.y, h: item.h, parts: [item.str] }
    } else {
      curLine.parts.push(item.str)
    }
  }
  if (curLine) lines.push(curLine)

  // Group lines into paragraphs when line spacing is tight
  const paragraphs = []
  let currentPara = []
  for (let i = 0; i < lines.length; i++) {
    const lineText = lines[i].parts.join(' ').replace(/\s+/g, ' ').trim()
    if (!lineText) continue
    currentPara.push(lineText)

    const nextLine = lines[i + 1]
    if (!nextLine) {
      paragraphs.push(currentPara.join(' '))
      currentPara = []
    } else {
      const gap = Math.abs(lines[i].y - nextLine.y)
      if (gap > lines[i].h * 1.65 || /[.:;?!]$/.test(lineText)) {
        paragraphs.push(currentPara.join(' '))
        currentPara = []
      }
    }
  }
  if (currentPara.length) paragraphs.push(currentPara.join(' '))

  return paragraphs
}

export default function PdfToWord() {
  const [file, setFile] = useState(null)
  const [outFormat, setOutFormat] = useState('docx')
  const [includePageHeaders, setIncludePageHeaders] = useState(false)
  const [extractedPages, setExtractedPages] = useState([]) // [{ page: 1, paragraphs: [] }]
  const [loadingExtract, setLoadingExtract] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [result, setResult] = useState(null)

  const handleUpload = async files => {
    const f = files[0]
    if (!f) return
    setFile(f)
    setResult(null)
    setLoadingExtract(true)

    let pdf = null
    try {
      pdf = await openPdfjs(f)
      const pagesData = []
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p)
        const tc = await page.getTextContent()
        const paragraphs = reconstructPageParagraphs(tc.items)
        pagesData.push({ page: p, paragraphs })
      }
      setExtractedPages(pagesData)
    } catch (err) {
      toast.error(err.message)
      setFile(null)
    } finally {
      closePdf(pdf)
      setLoadingExtract(false)
    }
  }

  const allParagraphs = extractedPages.flatMap(pg => {
    const list = []
    if (includePageHeaders && extractedPages.length > 1) {
      list.push(outFormat === 'md' ? `## Halaman ${pg.page}` : `--- Halaman ${pg.page} ---`)
    }
    return list.concat(pg.paragraphs)
  })

  const fullPreviewText = allParagraphs.join('\n\n')

  const handleCopy = async () => {
    if (!fullPreviewText) return
    await navigator.clipboard.writeText(fullPreviewText)
    setCopied(true)
    toast.success('Teks berhasil disalin ke clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleConvert = () => {
    if (!file) return
    setBusy(true)
    try {
      const nameBase = baseName(file.name)
      if (outFormat === 'docx') {
        const bytes = buildCleanDocxFromParagraphs(
          allParagraphs.length ? allParagraphs : ['(Dokumen tidak memiliki lapisan teks yang dapat diekstrak)'],
          nameBase,
        )
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
        setResult({
          name: `${nameBase}.docx`,
          blob,
          pages: extractedPages.length,
          paragraphsCount: allParagraphs.length,
        })
      } else if (outFormat === 'md') {
        const blob = new Blob([fullPreviewText], { type: 'text/markdown;charset=utf-8' })
        setResult({
          name: `${nameBase}.md`,
          blob,
          pages: extractedPages.length,
          paragraphsCount: allParagraphs.length,
        })
      } else {
        const blob = new Blob([fullPreviewText], { type: 'text/plain;charset=utf-8' })
        setResult({
          name: `${nameBase}.txt`,
          blob,
          pages: extractedPages.length,
          paragraphsCount: allParagraphs.length,
        })
      }
      toast.success(`Berhasil dikonversi ke .${outFormat.toUpperCase()}!`)
    } catch (err) {
      toast.error(`Gagal mengonversi: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setExtractedPages([])
    setResult(null)
  }

  return (
    <ToolPage toolId="pdf-to-word">
      {result ? (
        <ResultPanel
          title={`Berhasil Dikonversi ke .${outFormat.toUpperCase()}`}
          summary={`${result.pages} halaman · ${result.paragraphsCount} paragraf diekstrak`}
          files={[result]}
          onReset={reset}
        />
      ) : !file ? (
        <Dropzone
          onFiles={handleUpload}
          title="Pilih file PDF untuk diubah ke Word (.docx) atau Teks"
          hint="Mengekstrak paragraf dan struktur teks dari PDF menjadi dokumen Word yang bisa diedit"
        />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            <FileRow
              file={file}
              meta={
                loadingExtract
                  ? 'mengekstrak teks…'
                  : `${extractedPages.length} halaman · ${allParagraphs.length} paragraf`
              }
              onRemove={reset}
              disabled={busy || loadingExtract}
            />
          </ul>

          <div className="split-layout">
            <div className="panel">
              <Field label="Format File Keluaran">
                <Segmented name="out-fmt" value={outFormat} onChange={setOutFormat} options={FORMAT_OPTIONS} />
              </Field>

              <div style={{ marginTop: '16px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={includePageHeaders}
                    onChange={e => setIncludePageHeaders(e.target.checked)}
                  />
                  <span>Sertakan penanda nomor halaman di setiap pergantian halaman</span>
                </label>
              </div>

              <p className="field-hint" style={{ marginTop: '16px' }}>
                Catatan: Alat ini mengekstrak teks asli dari dalam PDF. Jika PDF berasal dari foto scan tanpa lapisan teks (OCR), jumlah teks yang terbaca mungkin terbatas.
              </p>
            </div>

            <div className="panel">
              <div className="panel-head">
                <h2>Pratinjau Teks yang Diekstrak</h2>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCopy}
                  disabled={!fullPreviewText}
                >
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                  {copied ? 'Tersalin' : 'Salin Teks'}
                </button>
              </div>

              {loadingExtract ? (
                <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-3)' }}>
                  <Spinner />
                  <p style={{ marginTop: '10px' }}>Membaca isi halaman PDF…</p>
                </div>
              ) : (
                <textarea
                  className="input"
                  rows={12}
                  readOnly
                  value={fullPreviewText || '(Tidak ditemukan teks yang dapat diekstrak pada PDF ini)'}
                  style={{
                    width: '100%',
                    height: 'auto',
                    padding: '12px',
                    fontFamily: 'var(--font)',
                    fontSize: '13.5px',
                    lineHeight: 1.55,
                    background: 'var(--bg)',
                  }}
                />
              )}
            </div>
          </div>

          <div className="action-bar">
            <p className="action-note">{allParagraphs.length} paragraf siap disimpan.</p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={handleConvert}
              disabled={busy || loadingExtract}
            >
              {busy ? <Spinner /> : <IconWord size={17} />}
              {busy ? 'Mengonversi…' : `Unduh sebagai .${outFormat.toUpperCase()}`}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
