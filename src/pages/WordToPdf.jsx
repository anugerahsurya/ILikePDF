import { useState } from 'react'
import { toast } from 'sonner'
import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib'
import { unzipSync, strFromU8 } from 'fflate'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconFileText, IconWord } from '../components/Icons'
import { savePdf } from '../utils/pdfConfig'
import { baseName } from '../utils/files'
import { extractTextFromBinaryDoc, cleanText } from '../utils/watermarkCleaner'

const ACCEPT_WORD = {
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/msword': ['.doc'],
}

const PAGE_SIZES = [
  { value: 'a4', label: 'A4 (210 × 297 mm)', w: 595.28, h: 841.89 },
  { value: 'f4', label: 'F4 / Folio (215 × 330 mm)', w: 609.45, h: 935.43 },
  { value: 'letter', label: 'Letter (216 × 279 mm)', w: 612, h: 792 },
]

const ORIENTATIONS = [
  { value: 'portrait', label: 'Tegak (Potret)' },
  { value: 'landscape', label: 'Mendatar (Lanskap)' },
]

function decodeEntities(str) {
  if (!str) return ''
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

// Sanitize characters outside WinAnsi range for StandardFonts
function toWinAnsiSafe(str) {
  return cleanText(str)
    .cleanedText.replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')
}

/**
 * Parse a .docx or .doc file into structured paragraphs:
 * [{ text, isHeading, isBold, isItalic, align: 'left' | 'center' | 'right', isBullet }]
 */
async function parseWordBlocks(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const isZip =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    bytes[2] === 0x03 &&
    bytes[3] === 0x04

  if (isZip) {
    const entries = unzipSync(bytes)
    const docBytes = entries['word/document.xml']
    if (!docBytes) throw new Error('Struktur word/document.xml tidak ditemukan dalam file DOCX.')
    const xml = strFromU8(docBytes)

    const blocks = []
    const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi
    let pMatch
    while ((pMatch = pRegex.exec(xml)) !== null) {
      const pBody = pMatch[1]

      // Skip if inside a watermark shape
      if (/PowerPlusWaterMarkObject|WordPictureWatermark|<v:textpath\b/i.test(pBody)) {
        continue
      }

      const styleMatch = pBody.match(/<w:pStyle\s+w:val="([^"]+)"/i)
      const styleVal = styleMatch ? styleMatch[1] : ''
      const isHeading = /^(Heading[1-4]|Title|Subtitle|Judul)/i.test(styleVal)
      const isBullet = /<w:numPr\b/i.test(pBody)

      const jcMatch = pBody.match(/<w:jc\s+w:val="([^"]+)"/i)
      const align = jcMatch ? jcMatch[1].toLowerCase() : 'left'

      const isBold = isHeading || /<w:b(?:\s+w:val="(?:true|1)")?\s*\/?>/i.test(pBody)
      const isItalic = /<w:i(?:\s+w:val="(?:true|1)")?\s*\/?>/i.test(pBody)

      const tRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi
      let tMatch
      const parts = []
      while ((tMatch = tRegex.exec(pBody)) !== null) {
        parts.push(decodeEntities(tMatch[1]))
      }
      const text = parts.join('').trim()
      if (text) {
        blocks.push({
          text: isBullet ? `• ${text}` : text,
          isHeading,
          isBold,
          isItalic,
          align: align === 'center' || align === 'right' ? align : 'left',
        })
      }
    }
    return blocks
  }

  // Fallback for legacy .doc
  const lines = extractTextFromBinaryDoc(bytes)
  return lines.map((line, idx) => ({
    text: line,
    isHeading: idx === 0 && line.length < 80,
    isBold: idx === 0 && line.length < 80,
    isItalic: false,
    align: 'left',
  }))
}

function wrapTextLines(text, font, fontSize, maxWidth) {
  const words = toWinAnsiSafe(text).split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines = []
  let current = words[0]

  for (let i = 1; i < words.length; i++) {
    const candidate = `${current} ${words[i]}`
    const width = font.widthOfTextAtSize(candidate, fontSize)
    if (width <= maxWidth) {
      current = candidate
    } else {
      lines.push(current)
      current = words[i]
    }
  }
  if (current) lines.push(current)
  return lines
}

export default function WordToPdf() {
  const [file, setFile] = useState(null)
  const [blocks, setBlocks] = useState([])
  const [pageSize, setPageSize] = useState('a4')
  const [orientation, setOrientation] = useState('portrait')
  const [baseFontSize, setBaseFontSize] = useState(11)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const handleUpload = async files => {
    const f = files[0]
    if (!f) return
    setFile(f)
    setResult(null)
    try {
      const parsed = await parseWordBlocks(f)
      setBlocks(parsed)
    } catch (err) {
      toast.error(`Gagal membaca file Word: ${err.message}`)
      setFile(null)
    }
  }

  const apply = async () => {
    if (!file) return
    setBusy(true)
    try {
      const pdfDoc = await PDFDocument.create()
      const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
      const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

      const sizeSpec = PAGE_SIZES.find(s => s.value === pageSize) || PAGE_SIZES[0]
      const pageW = orientation === 'landscape' ? sizeSpec.h : sizeSpec.w
      const pageH = orientation === 'landscape' ? sizeSpec.w : sizeSpec.h
      const margin = 54 // 0.75 inch

      const usableW = pageW - margin * 2
      let currentPage = pdfDoc.addPage([pageW, pageH])
      let cursorY = pageH - margin

      const contentBlocks = blocks.length
        ? blocks
        : [{ text: '(Dokumen Word kosong)', isHeading: false, isBold: false, isItalic: false, align: 'left' }]

      for (const blk of contentBlocks) {
        const fSize = blk.isHeading ? baseFontSize + 4 : baseFontSize
        const lineHeight = fSize * 1.45
        const activeFont = blk.isBold ? fontBold : blk.isItalic ? fontItalic : fontRegular

        if (blk.isHeading && cursorY < pageH - margin) {
          cursorY -= 6
        }

        const wrappedLines = wrapTextLines(blk.text, activeFont, fSize, usableW)

        for (const line of wrappedLines) {
          if (cursorY - lineHeight < margin) {
            currentPage = pdfDoc.addPage([pageW, pageH])
            cursorY = pageH - margin
          }

          const lw = activeFont.widthOfTextAtSize(line, fSize)
          let x = margin
          if (blk.align === 'center') x = margin + (usableW - lw) / 2
          else if (blk.align === 'right') x = margin + usableW - lw

          currentPage.drawText(line, {
            x,
            y: cursorY - fSize,
            size: fSize,
            font: activeFont,
            color: rgb(0.1, 0.1, 0.1),
          })

          cursorY -= lineHeight
        }

        cursorY -= fSize * 0.55 // Paragraph spacing
      }

      const blob = await savePdf(pdfDoc)
      setResult({
        name: `${baseName(file.name)}.pdf`,
        blob,
        pages: pdfDoc.getPageCount(),
      })
      toast.success('Dokumen Word berhasil dikonversi menjadi PDF!')
    } catch (err) {
      toast.error(`Gagal mengonversi ke PDF: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setBlocks([])
    setResult(null)
  }

  return (
    <ToolPage toolId="word-to-pdf">
      {result ? (
        <ResultPanel
          title="Word Berhasil Dikonversi ke PDF"
          summary={`Menghasilkan ${result.pages} halaman PDF siap cetak`}
          files={[result]}
          onReset={reset}
        />
      ) : !file ? (
        <Dropzone
          accept={ACCEPT_WORD}
          onFiles={handleUpload}
          title="Pilih file Word (.docx atau .doc) untuk diubah ke PDF"
          hint="Mengonversi dokumen Word menjadi file PDF bersih langsung di browser Anda"
        />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            <FileRow
              file={file}
              tag={file.name.toLowerCase().endsWith('.doc') ? 'DOC' : 'DOCX'}
              meta={`${blocks.length} paragraf terbaca`}
              onRemove={reset}
              disabled={busy}
            />
          </ul>

          <div className="split-layout">
            <div className="panel">
              <Field label="Ukuran Kertas">
                <Segmented name="w2p-size" value={pageSize} onChange={setPageSize} options={PAGE_SIZES} />
              </Field>

              <Field label="Orientasi Halaman">
                <Segmented name="w2p-orient" value={orientation} onChange={setOrientation} options={ORIENTATIONS} />
              </Field>

              <Field label={`Ukuran Huruf Dasar · ${baseFontSize} pt`} htmlFor="w2p-font">
                <input
                  id="w2p-font"
                  type="range"
                  className="range"
                  min={9}
                  max={16}
                  value={baseFontSize}
                  onChange={e => setBaseFontSize(Number(e.target.value))}
                />
              </Field>
            </div>

            <div className="panel preview-panel">
              <div className="panel-head">
                <h2>Pratinjau Isi Dokumen ({blocks.length} Paragraf)</h2>
                <IconWord size={18} />
              </div>

              <div
                style={{
                  maxHeight: '420px',
                  overflowY: 'auto',
                  padding: '24px',
                  background: '#ffffff',
                  color: '#1b1a17',
                  borderRadius: '8px',
                  boxShadow: 'inset 0 0 0 1px var(--border)',
                  fontSize: `${baseFontSize + 2}px`,
                  lineHeight: 1.55,
                }}
              >
                {blocks.length > 0 ? (
                  blocks.slice(0, 50).map((b, i) => (
                    <p
                      key={i}
                      style={{
                        marginBottom: '10px',
                        fontWeight: b.isBold ? 700 : 400,
                        fontStyle: b.isItalic ? 'italic' : 'normal',
                        fontSize: b.isHeading ? '1.2em' : '1em',
                        textAlign: b.align,
                      }}
                    >
                      {b.text}
                    </p>
                  ))
                ) : (
                  <p style={{ color: '#8a857b' }}>(Tidak ada teks yang terbaca)</p>
                )}
              </div>
            </div>
          </div>

          <div className="action-bar">
            <p className="action-note">Siap dikonversi ke format PDF {pageSize.toUpperCase()}.</p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={apply} disabled={busy}>
              {busy ? <Spinner /> : <IconFileText size={17} />}
              {busy ? 'Mengonversi…' : 'Konversi ke PDF'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
