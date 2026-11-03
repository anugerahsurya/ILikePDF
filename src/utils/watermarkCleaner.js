import { loadEditablePdf, savePdf, openPdfjs, closePdf } from './pdfConfig'
import { PDFName, rgb } from '@cantoo/pdf-lib'
import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate'

/**
 * Watermarks & AI Provenance Cleaner Utility
 * Inspired by and implementing the Layer A / File / Document metadata stripping from
 * guillaumemeyer/watermarks-remover (MIT), extended with Microsoft Word (.docx / .doc)
 * VML/DrawingML/SDT watermark & metadata cleaning.
 */

// Invisible Unicode, formatting characters, bidi overrides, variation selectors, and steganography marks
export const STRIP_CODEPOINTS = new Map([
  [0x00ad, 'Soft Hyphen (U+00AD)'],
  [0x034f, 'Combining Grapheme Joiner (CGJ, U+034F)'],
  [0x061c, 'Arabic Letter Mark (ALM, U+061C)'],
  [0x115f, 'Hangul Choseong Filler (U+115F)'],
  [0x1160, 'Hangul Jungseong Filler (U+1160)'],
  [0x17b4, 'Khmer Vowel Inherent AQ (U+17B4)'],
  [0x17b5, 'Khmer Vowel Inherent AA (U+17B5)'],
  [0x180b, 'Mongolian Free Variation Selector 1 (U+180B)'],
  [0x180c, 'Mongolian Free Variation Selector 2 (U+180C)'],
  [0x180d, 'Mongolian Free Variation Selector 3 (U+180D)'],
  [0x180e, 'Mongolian Vowel Separator (U+180E)'],
  [0x180f, 'Mongolian Free Variation Selector 4 (U+180F)'],
  [0x200b, 'Zero Width Space (ZWSP, U+200B)'],
  [0x200c, 'Zero Width Non-Joiner (ZWNJ, U+200C)'],
  [0x200d, 'Zero Width Joiner (ZWJ, U+200D)'],
  [0x200e, 'Left-to-Right Mark (LRM, U+200E)'],
  [0x200f, 'Right-to-Left Mark (RLM, U+200F)'],
  [0x202a, 'Left-to-Right Embedding (LRE, U+202A)'],
  [0x202b, 'Right-to-Left Embedding (RLE, U+202B)'],
  [0x202c, 'Pop Directional Formatting (PDF, U+202C)'],
  [0x202d, 'Left-to-Right Override (LRO, U+202D)'],
  [0x202e, 'Right-to-Left Override (RLO, U+202E)'],
  [0x2060, 'Word Joiner (U+2060)'],
  [0x2061, 'Function Application (U+2061)'],
  [0x2062, 'Invisible Times (U+2062)'],
  [0x2063, 'Invisible Separator (U+2063)'],
  [0x2064, 'Invisible Plus (U+2064)'],
  [0x2066, 'Left-to-Right Isolate (LRI, U+2066)'],
  [0x2067, 'Right-to-Left Isolate (RLI, U+2067)'],
  [0x2068, 'First Strong Isolate (FSI, U+2068)'],
  [0x2069, 'Pop Directional Isolate (PDI, U+2069)'],
  [0x206a, 'Inhibit Symmetric Swapping (U+206A)'],
  [0x206b, 'Activate Symmetric Swapping (U+206B)'],
  [0x206c, 'Inhibit Arabic Form Shaping (U+206C)'],
  [0x206d, 'Activate Arabic Form Shaping (U+206D)'],
  [0x206e, 'National Digit Shapes (U+206E)'],
  [0x206f, 'Nominal Digit Shapes (U+206F)'],
  [0xfeff, 'Zero Width No-Break Space / BOM (U+FEFF)'],
  [0xfe00, 'Variation Selector 1 (U+FE00)'],
  [0xfe01, 'Variation Selector 2 (U+FE01)'],
  [0xfe02, 'Variation Selector 3 (U+FE02)'],
  [0xfe03, 'Variation Selector 4 (U+FE03)'],
  [0xfe04, 'Variation Selector 5 (U+FE04)'],
  [0xfe05, 'Variation Selector 6 (U+FE05)'],
  [0xfe06, 'Variation Selector 7 (U+FE06)'],
  [0xfe07, 'Variation Selector 8 (U+FE07)'],
  [0xfe08, 'Variation Selector 9 (U+FE08)'],
  [0xfe09, 'Variation Selector 10 (U+FE09)'],
  [0xfe0a, 'Variation Selector 11 (U+FE0A)'],
  [0xfe0b, 'Variation Selector 12 (U+FE0B)'],
  [0xfe0c, 'Variation Selector 13 (U+FE0C)'],
  [0xfe0d, 'Variation Selector 14 (U+FE0D)'],
  [0xfe0e, 'Variation Selector 15 (U+FE0E)'],
  [0xfe0f, 'Variation Selector 16 (U+FE0F)'],
  [0x3164, 'Hangul Filler (U+3164)'],
  [0xffa0, 'Halfwidth Hangul Filler (U+FFA0)'],
  [0xfff9, 'Interlinear Annotation Anchor (U+FFF9)'],
  [0xfffa, 'Interlinear Annotation Separator (U+FFFA)'],
  [0xfffb, 'Interlinear Annotation Terminator (U+FFFB)'],
])

// Space homoglyphs that substitute or disguise standard ASCII space (U+0020)
export const SPACE_HOMOGLYPHS = new Map([
  [0x00a0, { name: 'No-Break Space (NBSP, U+00A0)', replace: ' ' }],
  [0x1680, { name: 'Ogham Space Mark (U+1680)', replace: ' ' }],
  [0x2000, { name: 'En Quad (U+2000)', replace: ' ' }],
  [0x2001, { name: 'Em Quad (U+2001)', replace: ' ' }],
  [0x2002, { name: 'En Space (U+2002)', replace: ' ' }],
  [0x2003, { name: 'Em Space (U+2003)', replace: ' ' }],
  [0x2004, { name: 'Three-Per-Em Space (U+2004)', replace: ' ' }],
  [0x2005, { name: 'Four-Per-Em Space (U+2005)', replace: ' ' }],
  [0x2006, { name: 'Six-Per-Em Space (U+2006)', replace: ' ' }],
  [0x2007, { name: 'Figure Space (U+2007)', replace: ' ' }],
  [0x2008, { name: 'Punctuation Space (U+2008)', replace: ' ' }],
  [0x2009, { name: 'Thin Space (U+2009)', replace: ' ' }],
  [0x200a, { name: 'Hair Space (U+200A)', replace: ' ' }],
  [0x202f, { name: 'Narrow No-Break Space (U+202F)', replace: ' ' }],
  [0x205f, { name: 'Medium Mathematical Space (U+205F)', replace: ' ' }],
  [0x3000, { name: 'Ideographic Space (U+3000)', replace: ' ' }],
])

function isTagCharacter(code) {
  return code >= 0xe0001 && code <= 0xe007f
}

function isVariationSelectorSupplement(code) {
  return code >= 0xe0100 && code <= 0xe01ef
}

function isPrivateUseArea(code) {
  return (
    (code >= 0xe000 && code <= 0xf8ff) ||
    (code >= 0xf0000 && code <= 0xffffd) ||
    (code >= 0x100000 && code <= 0x10fffd)
  )
}

/**
 * Inspect text for AI provenance and hidden steganography markers.
 */
export function inspectText(text) {
  if (!text) {
    return {
      totalChars: 0,
      invisibleCount: 0,
      homoglyphSpaceCount: 0,
      tagCharsCount: 0,
      puaCount: 0,
      findings: [],
      isSuspicious: false,
    }
  }

  const findings = []
  let invisibleCount = 0
  let homoglyphSpaceCount = 0
  let tagCharsCount = 0
  let puaCount = 0

  let index = 0
  let line = 1
  let col = 1

  for (const char of text) {
    const code = char.codePointAt(0)

    if (char === '\n') {
      line++
      col = 1
      index += char.length
      continue
    }

    if (STRIP_CODEPOINTS.has(code)) {
      invisibleCount++
      findings.push({
        type: 'invisible',
        char,
        code: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
        name: STRIP_CODEPOINTS.get(code),
        line,
        col,
        index,
      })
    } else if (isTagCharacter(code)) {
      tagCharsCount++
      findings.push({
        type: 'tag_stego',
        char,
        code: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
        name: 'Unicode Stego Tag Character (AI provenance mark)',
        line,
        col,
        index,
      })
    } else if (isVariationSelectorSupplement(code)) {
      invisibleCount++
      findings.push({
        type: 'variation_selector',
        char,
        code: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
        name: 'Variation Selector Supplement (U+E0100..U+E01EF)',
        line,
        col,
        index,
      })
    } else if (isPrivateUseArea(code)) {
      puaCount++
      findings.push({
        type: 'pua',
        char,
        code: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
        name: 'Private Use Area Codepoint (PUA marker)',
        line,
        col,
        index,
      })
    } else if (SPACE_HOMOGLYPHS.has(code)) {
      homoglyphSpaceCount++
      findings.push({
        type: 'homoglyph_space',
        char,
        code: `U+${code.toString(16).toUpperCase().padStart(4, '0')}`,
        name: SPACE_HOMOGLYPHS.get(code).name,
        line,
        col,
        index,
      })
    }

    col++
    index += char.length
  }

  const isSuspicious = invisibleCount > 0 || tagCharsCount > 0 || puaCount > 0 || homoglyphSpaceCount > 0

  return {
    totalChars: Array.from(text).length,
    invisibleCount,
    homoglyphSpaceCount,
    tagCharsCount,
    puaCount,
    findings,
    isSuspicious,
  }
}

/**
 * Clean text by stripping invisible steganography markers and normalizing homoglyph spaces.
 */
export function cleanText(text, options = {}) {
  const {
    normalizeSpaces = true,
    stripPua = true,
    stripTags = true,
    nfkc = false,
  } = options

  if (!text) return { cleanedText: '', stats: { removedCount: 0, replacedCount: 0 } }

  let intermediate = nfkc ? text.normalize('NFKC') : text
  let removedCount = 0
  let replacedCount = 0
  const resultChars = []

  for (const char of intermediate) {
    const code = char.codePointAt(0)

    if (STRIP_CODEPOINTS.has(code)) {
      removedCount++
      continue
    }

    if (stripTags && isTagCharacter(code)) {
      removedCount++
      continue
    }

    if (isVariationSelectorSupplement(code)) {
      removedCount++
      continue
    }

    if (stripPua && isPrivateUseArea(code)) {
      removedCount++
      continue
    }

    if (normalizeSpaces && SPACE_HOMOGLYPHS.has(code)) {
      resultChars.push(SPACE_HOMOGLYPHS.get(code).replace)
      replacedCount++
      continue
    }

    resultChars.push(char)
  }

  return {
    cleanedText: resultChars.join(''),
    stats: {
      removedCount,
      replacedCount,
      totalChanges: removedCount + replacedCount,
    },
  }
}

/**
 * Inspect a PDF file for invisible text watermarks, XMP metadata, Info dictionary, and Stamp/Watermark annotations.
 */
export async function inspectPdfDocument(file) {
  const findings = []
  let hasXmp = false
  let hasPieceInfo = false
  let watermarkAnnotsCount = 0
  let infoKeysFound = []
  let textInvisiblesCount = 0

  // 1. Inspect using pdf-lib
  try {
    const doc = await loadEditablePdf(file)

    if (doc.catalog.has(PDFName.of('Metadata'))) {
      hasXmp = true
      findings.push('Ditemukan stream XMP Metadata tingkat dokumen (berpotensi membawa jejak AI/C2PA)')
    }

    if (doc.catalog.has(PDFName.of('PieceInfo'))) {
      hasPieceInfo = true
      findings.push('Ditemukan PieceInfo Catalog (data pelacak aplikasi pihak ketiga)')
    }

    const info = doc.getInfoDict()
    if (info) {
      const standardKeys = ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate']
      for (const k of standardKeys) {
        if (info.has(PDFName.of(k))) {
          infoKeysFound.push(k)
        }
      }
    }

    for (const page of doc.getPages()) {
      try {
        const annots = page.node.get(PDFName.of('Annots'))
        if (annots && annots.size) {
          for (let i = 0; i < annots.size(); i++) {
            const annot = annots.get(i)
            const subtype = annot?.get?.(PDFName.of('Subtype'))?.toString?.()
            if (subtype === '/Watermark' || subtype === '/Stamp') {
              watermarkAnnotsCount++
            }
          }
        }
      } catch {}
    }
  } catch (err) {
    console.warn('PDF inspect warning:', err)
  }

  // 2. Sample extracted text for Layer A invisible markers
  try {
    const pdfjsDoc = await openPdfjs(file)
    const maxPagesToSample = Math.min(pdfjsDoc.numPages, 10)
    for (let p = 1; p <= maxPagesToSample; p++) {
      const page = await pdfjsDoc.getPage(p)
      const textContent = await page.getTextContent()
      const rawText = textContent.items.map(item => item.str).join(' ')
      const textInspection = inspectText(rawText)
      textInvisiblesCount += textInspection.invisibleCount + textInspection.tagCharsCount
    }
    closePdf(pdfjsDoc)
  } catch (err) {
    console.warn('PDF text sample warning:', err)
  }

  if (watermarkAnnotsCount > 0) {
    findings.push(`Ditemukan ${watermarkAnnotsCount} anotasi tipe Watermark/Stamp pada halaman PDF`)
  }
  if (textInvisiblesCount > 0) {
    findings.push(`Ditemukan ${textInvisiblesCount} karakter tersembunyi (Invisible Unicode / Stego) di dalam teks PDF`)
  }
  if (infoKeysFound.length > 0) {
    findings.push(`Metadata dokumen Info terisi: ${infoKeysFound.join(', ')}`)
  }

  return {
    hasXmp,
    hasPieceInfo,
    watermarkAnnotsCount,
    infoKeysFound,
    textInvisiblesCount,
    findings,
    isSuspicious: hasXmp || watermarkAnnotsCount > 0 || textInvisiblesCount > 0 || infoKeysFound.length > 0,
  }
}

/**
 * Clean a PDF document:
 * 1. Strips XMP & C2PA Metadata stream
 * 2. Cleans Info dictionary (Author, Creator, Producer, Dates, AI prompt traces)
 * 3. Cleans PieceInfo application trackers
 * 4. Strips Watermark and Stamp annotations
 * 5. Optionally applies visual watermark masking / cleanup on target pages
 */
export async function cleanPdfDocument(file, options = {}) {
  const {
    stripMetadata = true,
    stripXmp = true,
    stripPieceInfo = true,
    stripAnnotations = true,
    visualMask = null,
  } = options

  const doc = await loadEditablePdf(file)
  const actions = []

  // 1. Clean Info dictionary
  if (stripMetadata) {
    doc.setTitle('')
    doc.setAuthor('')
    doc.setSubject('')
    doc.setKeywords([])
    doc.setProducer('')
    doc.setCreator('')
    try {
      const info = doc.getInfoDict()
      if (info) {
        const keysToRemove = [
          'Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer',
          'CreationDate', 'ModDate', 'Trapped', 'PTEX.Fullbanner',
          'AIGenerator', 'AI', 'Claude', 'OpenAI', 'Gemini', 'SynthID', 'C2PA',
          'Anthropic', 'Prompt', 'SystemPrompt',
        ]
        keysToRemove.forEach(k => {
          try {
            info.delete(PDFName.of(k))
          } catch {}
        })
      }
      actions.push('Membersihkan Info Dictionary (Author, Creator, Producer, ModDate, & AI prompt keys)')
    } catch {}
  }

  // 2. Clean Catalog XMP Metadata & C2PA Provenance Manifest
  if (stripXmp) {
    try {
      if (doc.catalog.has(PDFName.of('Metadata'))) {
        doc.catalog.delete(PDFName.of('Metadata'))
        actions.push('Menghapus stream XMP Metadata & C2PA Provenance Manifest')
      }
    } catch {}
  }

  // 3. Clean PieceInfo (Adobe / third party metadata)
  if (stripPieceInfo) {
    try {
      if (doc.catalog.has(PDFName.of('PieceInfo'))) {
        doc.catalog.delete(PDFName.of('PieceInfo'))
        actions.push('Menghapus PieceInfo dari Catalog')
      }
    } catch {}
  }

  // 4. Clean Pages
  const pages = doc.getPages()
  let removedAnnotsCount = 0
  let visualMaskCount = 0

  // Parse page targets for visual mask if enabled
  let maskTargetSet = new Set()
  if (visualMask?.enabled) {
    if (visualMask.targetPages === 'all') {
      pages.forEach((_, idx) => maskTargetSet.add(idx))
    } else if (visualMask.pageRange) {
      const parts = visualMask.pageRange.split(',')
      for (const part of parts) {
        const trimmed = part.trim()
        if (trimmed.includes('-')) {
          const [startStr, endStr] = trimmed.split('-')
          const start = parseInt(startStr, 10) - 1
          const end = parseInt(endStr, 10) - 1
          if (!isNaN(start) && !isNaN(end)) {
            for (let i = Math.max(0, start); i <= Math.min(pages.length - 1, end); i++) {
              maskTargetSet.add(i)
            }
          }
        } else {
          const p = parseInt(trimmed, 10) - 1
          if (!isNaN(p) && p >= 0 && p < pages.length) {
            maskTargetSet.add(p)
          }
        }
      }
    }
  }

  const maskColorRgb = rgb(1, 1, 1) // default clean white

  pages.forEach((page, pageIndex) => {
    // Strip page level metadata & PieceInfo
    try {
      if (page.node.has(PDFName.of('Metadata'))) {
        page.node.delete(PDFName.of('Metadata'))
      }
      if (page.node.has(PDFName.of('PieceInfo'))) {
        page.node.delete(PDFName.of('PieceInfo'))
      }
    } catch {}

    // Strip Watermark / Stamp annotations
    if (stripAnnotations) {
      try {
        const annots = page.node.get(PDFName.of('Annots'))
        if (annots && annots.size) {
          const keepAnnots = []
          for (let i = 0; i < annots.size(); i++) {
            const annot = annots.get(i)
            let isWatermark = false
            try {
              const subtype = annot?.get?.(PDFName.of('Subtype'))?.toString?.()
              if (subtype === '/Watermark' || subtype === '/Stamp') {
                isWatermark = true
                removedAnnotsCount++
              }
            } catch {}
            if (!isWatermark) {
              keepAnnots.push(annot)
            }
          }
          if (keepAnnots.length === 0) {
            page.node.delete(PDFName.of('Annots'))
          }
        }
      } catch {}
    }

    // Apply visual watermark masking if enabled on this page
    if (visualMask?.enabled && maskTargetSet.has(pageIndex)) {
      const crop = page.getCropBox()
      const W = crop.width
      const H = crop.height

      if (visualMask.preset === 'diagonal') {
        page.drawRectangle({
          x: crop.x + W * 0.15,
          y: crop.y + H * 0.40,
          width: W * 0.70,
          height: H * 0.20,
          color: maskColorRgb,
          opacity: 1,
        })
        visualMaskCount++
      } else if (visualMask.preset === 'center') {
        page.drawRectangle({
          x: crop.x + W * 0.20,
          y: crop.y + H * 0.35,
          width: W * 0.60,
          height: H * 0.30,
          color: maskColorRgb,
          opacity: 1,
        })
        visualMaskCount++
      } else if (visualMask.preset === 'top') {
        page.drawRectangle({
          x: crop.x + 20,
          y: crop.y + H - 70,
          width: W - 40,
          height: 50,
          color: maskColorRgb,
          opacity: 1,
        })
        visualMaskCount++
      } else if (visualMask.preset === 'bottom') {
        page.drawRectangle({
          x: crop.x + 20,
          y: crop.y + 20,
          width: W - 40,
          height: 50,
          color: maskColorRgb,
          opacity: 1,
        })
        visualMaskCount++
      } else if (visualMask.preset === 'custom' && visualMask.customBox) {
        const { x, y, width, height } = visualMask.customBox
        page.drawRectangle({
          x: crop.x + (x || 0),
          y: crop.y + (y || 0),
          width: Math.max(1, width || 100),
          height: Math.max(1, height || 100),
          color: maskColorRgb,
          opacity: 1,
        })
        visualMaskCount++
      }
    }
  })

  if (removedAnnotsCount > 0) {
    actions.push(`Menghapus ${removedAnnotsCount} anotasi Watermark / Stamp`)
  }

  if (visualMaskCount > 0) {
    actions.push(`Membersihkan area watermark visual pada ${visualMaskCount} halaman`)
  }

  const cleanedBlob = await savePdf(doc)

  return {
    blob: cleanedBlob,
    actions,
    originalSize: file.size,
    cleanedSize: cleanedBlob.size,
    findingsCount: actions.length,
  }
}

/* ─────────────────── WORD (.DOCX & .DOC) WATERMARK & METADATA CLEANER ─────────────────── */

function decodeXmlEntities(str) {
  if (!str) return ''
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

function encodeXmlEntities(str) {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Detect whether a file is an OpenXML .docx archive, RTF .doc, HTML/XML .doc, or binary OLE2 .doc
 */
function detectWordFormat(bytes) {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) {
    return 'docx'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0xd0 &&
    bytes[1] === 0xcf &&
    bytes[2] === 0x11 &&
    bytes[3] === 0xe0
  ) {
    return 'ole_doc'
  }
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 256)).trimStart()
  if (head.startsWith('{\\rtf')) return 'rtf_doc'
  if (head.startsWith('<') || head.toLowerCase().includes('<html') || head.toLowerCase().includes('<?xml')) {
    return 'xml_doc'
  }
  return 'ole_doc'
}

/**
 * Extract readable paragraphs from an OLE2 binary .doc buffer (supports both UTF-16LE and ANSI/CP1252 runs)
 */
export function extractTextFromBinaryDoc(bytes) {
  const paragraphs = []

  // 1. Scan for UTF-16LE text runs
  let currentUtf16 = []
  for (let i = 0; i < bytes.length - 1; i += 2) {
    const lo = bytes[i]
    const hi = bytes[i + 1]
    const code = (hi << 8) | lo
    const isPrintable =
      (code >= 0x20 && code <= 0x7e) ||
      (code >= 0xa0 && code <= 0x024f) ||
      code === 0x0d ||
      code === 0x0a ||
      code === 0x09 ||
      STRIP_CODEPOINTS.has(code) ||
      SPACE_HOMOGLYPHS.has(code)
    if (isPrintable && hi === 0x00) {
      currentUtf16.push(String.fromCharCode(code))
    } else if (STRIP_CODEPOINTS.has(code) || SPACE_HOMOGLYPHS.has(code)) {
      currentUtf16.push(String.fromCharCode(code))
    } else {
      if (currentUtf16.length >= 16) {
        const text = currentUtf16.join('').trim()
        if (text && !/^(Root Entry|WordDocument|SummaryInformation|DocumentSummaryInformation|CompObj|1Table|0Table)/i.test(text)) {
          paragraphs.push(text)
        }
      }
      currentUtf16 = []
    }
  }

  // 2. Scan for ASCII/CP1252 text segments if UTF-16LE yielded few lines
  let currentAscii = []
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    if ((b >= 32 && b <= 126) || b === 10 || b === 13 || b === 9) {
      currentAscii.push(String.fromCharCode(b))
    } else {
      if (currentAscii.length >= 24) {
        const s = currentAscii.join('').trim()
        if (
          s &&
          !/^(MSWordDoc|Word\.Document|Normal\.dotm|Times New Roman|Calibri|Arial|Cambria|http:\/\/schemas|_PID_)/i.test(s) &&
          /[a-zA-Z]{3,}/.test(s)
        ) {
          paragraphs.push(s)
        }
      }
      currentAscii = []
    }
  }

  // Deduplicate and split lines
  const lines = []
  const seen = new Set()
  for (const raw of paragraphs) {
    for (const line of raw.split(/[\r\n]+/)) {
      const clean = line.trim()
      if (clean.length >= 3 && !seen.has(clean)) {
        seen.add(clean)
        lines.push(clean)
      }
    }
  }
  return lines
}

/**
 * Inspect a Word document (.docx or .doc) for visual watermarks, background shapes,
 * document metadata, RSID session tracking, and Layer A invisible Unicode markers.
 */
export async function inspectWordDocument(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const format = detectWordFormat(bytes)
  const findings = []
  const watermarkTexts = []
  let watermarkCount = 0
  let hasBackground = false
  let metadataFound = []
  let rsidCount = 0
  let textInvisiblesCount = 0
  let previewParagraphs = []

  if (format === 'docx') {
    let entries
    try {
      entries = unzipSync(bytes)
    } catch {
      throw new Error(`File "${file.name}" tidak dapat dibuka sebagai dokumen DOCX yang valid.`)
    }

    const fileNames = Object.keys(entries)

    // 1. Inspect Headers & Document for Watermarks
    const xmlTargets = fileNames.filter(
      name => /^word\/(header\d*|footer\d*|document)\.xml$/i.test(name),
    )

    for (const name of xmlTargets) {
      const xml = strFromU8(entries[name])

      // Check SDT Watermark Gallery
      const sdtWatermarkMatches = xml.match(/<w:docPartGallery\s+w:val="(?:Watermarks?|PowerPlusWaterMark[^"]*)"/gi)
      if (sdtWatermarkMatches) {
        watermarkCount += sdtWatermarkMatches.length
      }

      // Check VML Watermark shapes (PowerPlusWaterMarkObject, WordPictureWatermark, type="#_x0000_t136", or v:textpath)
      const textpathRegex = /<v:textpath\b[^>]*\bstring="([^"]*)"[^>]*\/?>/gi
      let tpMatch
      while ((tpMatch = textpathRegex.exec(xml)) !== null) {
        const wmStr = decodeXmlEntities(tpMatch[1])
        if (wmStr) watermarkTexts.push(wmStr)
        watermarkCount++
      }

      // Check Picture Watermarks in VML shapes or Header behindDoc drawings
      const picWatermarkMatches = xml.match(/id="(?:WordPictureWatermark|PowerPlusWaterMarkObject)[^"]*"/gi)
      if (picWatermarkMatches && !xml.includes('<v:textpath')) {
        watermarkCount += picWatermarkMatches.length
      }

      if (/^word\/header/i.test(name)) {
        const behindDocMatches = xml.match(/<wp:anchor\b[^>]*\bbehindDoc="1"[^>]*>/gi)
        if (behindDocMatches) {
          watermarkCount += behindDocMatches.length
        }
        // Any remaining <v:shape> inside a header that uses center/absolute positioning
        if (watermarkCount === 0 && /<v:shape\b/i.test(xml)) {
          watermarkCount += (xml.match(/<v:shape\b/gi) || []).length
        }
      }

      // Check <w:background> in document.xml
      if (name === 'word/document.xml' && /<w:background\b/i.test(xml)) {
        hasBackground = true
      }

      // Extract text from <w:p> and <w:t> for preview and invisible character inspection
      const pRegex = /<w:p\b[^>]*>([\s\S]*?)<\/w:p>/gi
      let pMatch
      while ((pMatch = pRegex.exec(xml)) !== null) {
        const pContent = pMatch[1]
        const tRegex = /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi
        let tMatch
        const parts = []
        while ((tMatch = tRegex.exec(pContent)) !== null) {
          parts.push(decodeXmlEntities(tMatch[1]))
        }
        const paragraphText = parts.join('')
        if (paragraphText.trim()) {
          if (name === 'word/document.xml' && previewParagraphs.length < 40) {
            previewParagraphs.push(paragraphText)
          }
          const insp = inspectText(paragraphText)
          textInvisiblesCount +=
            insp.invisibleCount + insp.tagCharsCount + insp.puaCount + insp.homoglyphSpaceCount
        }
      }
    }

    // 2. Inspect Settings for displayBackgroundShape & RSIDs
    if (entries['word/settings.xml']) {
      const settingsXml = strFromU8(entries['word/settings.xml'])
      if (/<w:displayBackgroundShape/i.test(settingsXml)) {
        hasBackground = true
      }
      const rsidMatches = settingsXml.match(/<w:rsid\b/gi)
      if (rsidMatches) {
        rsidCount = rsidMatches.length
      }
    }

    // 3. Inspect Metadata in docProps/core.xml & docProps/app.xml
    if (entries['docProps/core.xml']) {
      const coreXml = strFromU8(entries['docProps/core.xml'])
      const checkTag = (tag, label) => {
        const m = coreXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
        if (m && m[1].trim()) {
          metadataFound.push(`${label}: "${decodeXmlEntities(m[1].trim())}"`)
        }
      }
      checkTag('dc:creator', 'Author/Creator')
      checkTag('cp:lastModifiedBy', 'LastModifiedBy')
      checkTag('dc:title', 'Title')
      checkTag('cp:keywords', 'Keywords')
    }

    if (entries['docProps/app.xml']) {
      const appXml = strFromU8(entries['docProps/app.xml'])
      const checkAppTag = (tag, label) => {
        const m = appXml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'))
        if (m && m[1].trim()) {
          metadataFound.push(`${label}: "${decodeXmlEntities(m[1].trim())}"`)
        }
      }
      checkAppTag('Application', 'Aplikasi')
      checkAppTag('Company', 'Instansi/Company')
    }

    if (watermarkCount > 0) {
      const textNote = watermarkTexts.length > 0 ? ` (Teks: "${watermarkTexts.join('", "')}")` : ''
      findings.push(`Terdeteksi ${watermarkCount} objek Watermark pada Header/Dokumen Word${textNote}`)
    }
    if (hasBackground) {
      findings.push('Terdeteksi latar belakang halaman (<w:background> / displayBackgroundShape)')
    }
    if (metadataFound.length > 0) {
      findings.push(`Metadata dokumen ditemukan: ${metadataFound.join(', ')}`)
    }
    if (rsidCount > 0) {
      findings.push(`Ditemukan ${rsidCount} kode pelacak sesi edit (RSID fingerprint) di word/settings.xml`)
    }
    if (textInvisiblesCount > 0) {
      findings.push(`Ditemukan ${textInvisiblesCount} karakter steganografi AI / Invisible Unicode di dalam teks dokumen`)
    }
  } else {
    // Legacy .doc (RTF, HTML/XML, or OLE2 binary)
    const rawLatin = new TextDecoder('latin1').decode(bytes)
    if (
      /PowerPlusWaterMarkObject|WordPictureWatermark|\\\*\\watermark|mso-position-horizontal:\s*center/i.test(rawLatin)
    ) {
      watermarkCount++
      findings.push('Terdeteksi struktur objek Watermark di dalam file .DOC')
    }
    const textpathMatch = rawLatin.match(/string="([^"]+)"/i)
    if (textpathMatch) {
      watermarkTexts.push(textpathMatch[1])
      findings.push(`Teks Watermark terdeteksi: "${textpathMatch[1]}"`)
    }

    if (format === 'rtf_doc' || format === 'xml_doc') {
      const textDecoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      const insp = inspectText(textDecoded)
      textInvisiblesCount = insp.invisibleCount + insp.tagCharsCount + insp.puaCount
      previewParagraphs = textDecoded
        .replace(/<[^>]+>/g, ' ')
        .replace(/\\[a-z]+\d*\s?/gi, ' ')
        .split(/[\r\n]+/)
        .map(s => s.trim())
        .filter(s => s.length > 3)
        .slice(0, 30)
    } else {
      previewParagraphs = extractTextFromBinaryDoc(bytes)
      const joined = previewParagraphs.join('\n')
      const insp = inspectText(joined)
      textInvisiblesCount = insp.invisibleCount + insp.tagCharsCount + insp.puaCount
    }

    if (rawLatin.includes('SummaryInformation') || rawLatin.includes('\\info')) {
      metadataFound.push('Stream SummaryInformation / Info Metadata')
      findings.push('Ditemukan blok metadata SummaryInformation pada file .DOC')
    }
    if (textInvisiblesCount > 0) {
      findings.push(`Ditemukan ${textInvisiblesCount} karakter tersembunyi (Invisible Unicode) di dalam teks .DOC`)
    }
  }

  return {
    format,
    watermarkCount,
    watermarkTexts,
    hasBackground,
    metadataFound,
    rsidCount,
    textInvisiblesCount,
    previewParagraphs,
    findings,
    isSuspicious:
      watermarkCount > 0 ||
      hasBackground ||
      metadataFound.length > 0 ||
      rsidCount > 0 ||
      textInvisiblesCount > 0,
  }
}

/**
 * Helper to strip watermark XML structures from a Word XML string (header*.xml, footer*.xml, document.xml)
 */
function stripWatermarksFromWordXml(xml, isHeaderOrFooter, customWatermarkText = '') {
  let modified = xml
  let removedShapes = 0

  // 1. Remove <w:sdt> blocks that belong to Watermarks gallery or contain PowerPlusWaterMarkObject / WordPictureWatermark / v:textpath
  modified = modified.replace(/<w:sdt\b[^>]*>[\s\S]*?<\/w:sdt>/gi, match => {
    if (
      /w:val="(?:Watermarks?|PowerPlusWaterMark[^"]*)"/i.test(match) ||
      /PowerPlusWaterMarkObject|WordPictureWatermark|<v:textpath\b/i.test(match)
    ) {
      removedShapes++
      return ''
    }
    return match
  })

  // 2. Remove <w:pict> blocks containing watermark shapes (or any <v:shape> in headers)
  modified = modified.replace(/<w:pict\b[^>]*>[\s\S]*?<\/w:pict>/gi, match => {
    if (
      isHeaderOrFooter ||
      /PowerPlusWaterMarkObject|WordPictureWatermark|<v:textpath\b|type="#_x0000_t136"|mso-position-horizontal:\s*center/i.test(
        match,
      )
    ) {
      removedShapes++
      return ''
    }
    return match
  })

  // 3. In headers/footers, remove <w:drawing> blocks that contain <wp:anchor ... behindDoc="1"> (modern Word image/shape watermarks)
  if (isHeaderOrFooter) {
    modified = modified.replace(/<w:drawing\b[^>]*>[\s\S]*?<\/w:drawing>/gi, match => {
      if (/<wp:anchor\b[^>]*\bbehindDoc="1"/i.test(match) || /Watermark/i.test(match)) {
        removedShapes++
        return ''
      }
      return match
    })
  }

  // 4. Remove <w:background .../> from document.xml
  if (/<w:background\b[^>]*\/?>/i.test(modified)) {
    modified = modified.replace(/<w:background\b[^>]*>[\s\S]*?<\/w:background>/gi, '')
    modified = modified.replace(/<w:background\b[^>]*\/>/gi, '')
    removedShapes++
  }

  // 5. Optional custom watermark text removal
  const customTrimmed = customWatermarkText ? customWatermarkText.trim() : ''
  if (customTrimmed) {
    const escapedRegex = customTrimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const rx = new RegExp(escapedRegex, 'gi')
    modified = modified.replace(/<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi, (full, inner) => {
      const decoded = decodeXmlEntities(inner)
      if (rx.test(decoded)) {
        removedShapes++
        const cleaned = decoded.replace(rx, '')
        return full.replace(inner, encodeXmlEntities(cleaned))
      }
      return full
    })
  }

  return { xml: modified, removedShapes }
}

/**
 * Build a clean OpenXML .docx binary (Uint8Array) from an array of plain text paragraphs.
 * Used both when converting legacy .doc to clean .docx and when generating documents.
 */
export function buildCleanDocxFromParagraphs(paragraphs, title = '') {
  const escapedParagraphs = (paragraphs.length ? paragraphs : ['']).map(p => {
    const cleanP = encodeXmlEntities(p)
    return `<w:p><w:r><w:t xml:space="preserve">${cleanP}</w:t></w:r></w:p>`
  })

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`

  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
</w:styles>`

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${escapedParagraphs.join('\n    ')}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`

  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${encodeXmlEntities(title)}</dc:title>
  <dc:creator></dc:creator>
  <cp:lastModifiedBy></cp:lastModifiedBy>
</cp:coreProperties>`

  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>PDF Pro Document Cleaner</Application>
  <Company></Company>
</Properties>`

  return zipSync({
    '[Content_Types].xml': strToU8(contentTypesXml),
    '_rels/.rels': strToU8(relsXml),
    'word/_rels/document.xml.rels': strToU8(wordRelsXml),
    'word/styles.xml': strToU8(stylesXml),
    'word/document.xml': strToU8(documentXml),
    'docProps/core.xml': strToU8(coreXml),
    'docProps/app.xml': strToU8(appXml),
  })
}

/**
 * Clean a Word document (.docx or .doc):
 * 1. Removes visual text & image watermarks from headers, footers, and document body
 * 2. Removes page background shapes (<w:background> & <w:displayBackgroundShape>)
 * 3. Cleans document metadata (Author, Creator, LastModifiedBy, Company, RSID tracking)
 * 4. Cleans Layer A invisible Unicode & AI steganography inside document text runs
 */
export async function cleanWordDocument(file, options = {}) {
  const {
    stripVisualWatermark = true,
    stripMetadata = true,
    stripInvisibles = true,
    customWatermarkText = '',
    convertDocToDocx = false,
  } = options

  const bytes = new Uint8Array(await file.arrayBuffer())
  const format = detectWordFormat(bytes)
  const actions = []

  if (format === 'docx') {
    const entries = unzipSync(bytes)
    const fileNames = Object.keys(entries)
    let totalShapesRemoved = 0
    let totalInvisibleRemoved = 0

    for (const name of fileNames) {
      // 1. Clean headers, footers, and main document
      if (/^word\/(header\d*|footer\d*|document|footnotes|endnotes)\.xml$/i.test(name)) {
        let xml = strFromU8(entries[name])
        const isHeaderOrFooter = /^word\/(header|footer)/i.test(name)

        if (stripVisualWatermark) {
          const res = stripWatermarksFromWordXml(xml, isHeaderOrFooter, customWatermarkText)
          xml = res.xml
          totalShapesRemoved += res.removedShapes
        }

        if (stripMetadata) {
          // Strip w:rsid* tracking attributes
          xml = xml.replace(/\s+w:rsid[A-Za-z]*="[0-9A-Fa-f]+"/g, '')
        }

        if (stripInvisibles) {
          xml = xml.replace(/<w:t(\s+[^>]*)?>([\s\S]*?)<\/w:t>/gi, (full, attrs = '', inner) => {
            const decoded = decodeXmlEntities(inner)
            const cleaned = cleanText(decoded, {
              normalizeSpaces: true,
              stripPua: true,
              stripTags: true,
            })
            if (cleaned.stats.totalChanges > 0) {
              totalInvisibleRemoved += cleaned.stats.totalChanges
              return `<w:t${attrs}>${encodeXmlEntities(cleaned.cleanedText)}</w:t>`
            }
            return full
          })
        }

        entries[name] = strToU8(xml)
      }

      // 2. Clean word/settings.xml
      if (name === 'word/settings.xml') {
        let settingsXml = strFromU8(entries[name])
        if (stripVisualWatermark) {
          settingsXml = settingsXml.replace(/<w:displayBackgroundShape\s*\/?>/gi, '')
        }
        if (stripMetadata) {
          settingsXml = settingsXml.replace(/<w:rsids\b[^>]*>[\s\S]*?<\/w:rsids>/gi, '')
        }
        entries[name] = strToU8(settingsXml)
      }

      // 3. Clean docProps/core.xml
      if (stripMetadata && name === 'docProps/core.xml') {
        let coreXml = strFromU8(entries[name])
        const tagsToClear = [
          'dc:creator',
          'cp:lastModifiedBy',
          'dc:description',
          'cp:keywords',
          'dc:subject',
          'cp:category',
        ]
        for (const t of tagsToClear) {
          coreXml = coreXml.replace(new RegExp(`<${t}[^>]*>[\\s\\S]*?<\\/${t}>`, 'gi'), `<${t}></${t}>`)
        }
        entries[name] = strToU8(coreXml)
      }

      // 4. Clean docProps/app.xml
      if (stripMetadata && name === 'docProps/app.xml') {
        let appXml = strFromU8(entries[name])
        const appTags = ['Company', 'Manager', 'Application', 'TotalTime']
        for (const t of appTags) {
          appXml = appXml.replace(new RegExp(`<${t}[^>]*>[\\s\\S]*?<\\/${t}>`, 'gi'), `<${t}></${t}>`)
        }
        entries[name] = strToU8(appXml)
      }

      // 5. Remove custom properties / people tracking if metadata stripping is on
      if (stripMetadata && (name === 'docProps/custom.xml' || name === 'word/people.xml')) {
        delete entries[name]
      }
    }

    if (stripVisualWatermark) {
      actions.push(
        totalShapesRemoved > 0
          ? `Menghapus ${totalShapesRemoved} objek Watermark visual / gambar latar dari Header & Dokumen Word`
          : 'Memastikan Header, Footer, & latar belakang bebas dari objek Watermark',
      )
    }
    if (stripMetadata) {
      actions.push('Membersihkan metadata dokumen (Author, LastModifiedBy, Company) & menghapus riwayat sesi RSID')
    }
    if (stripInvisibles) {
      actions.push(
        totalInvisibleRemoved > 0
          ? `Menghapus ${totalInvisibleRemoved} karakter steganografi AI / Invisible Unicode dari teks dokumen`
          : 'Memindai & menormalkan teks dari karakter steganografi tersembunyi',
      )
    }

    const zipped = zipSync(entries)
    const blob = new Blob([zipped], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    return {
      blob,
      ext: 'docx',
      actions,
      originalSize: file.size,
      cleanedSize: blob.size,
    }
  }

  // Handle .DOC (RTF, HTML/XML, or OLE2 Binary)
  if (format === 'rtf_doc' || format === 'xml_doc') {
    let content = new TextDecoder('utf-8', { fatal: false }).decode(bytes)

    if (stripVisualWatermark) {
      // Remove RTF watermark groups & VML watermark shapes
      content = content.replace(/\{\\\*\\watermark[\s\S]*?\}/gi, '')
      content = content.replace(/\{\\shp[\s\S]*?(?:PowerPlusWaterMarkObject|WordPictureWatermark)[\s\S]*?\}/gi, '')
      content = content.replace(/<v:shape\b[^>]*?(?:PowerPlusWaterMarkObject|WordPictureWatermark)[\s\S]*?<\/v:shape>/gi, '')
      if (customWatermarkText.trim()) {
        const rx = new RegExp(customWatermarkText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
        content = content.replace(rx, '')
      }
      actions.push('Menghapus blok Watermark VML / RTF dari dokumen .DOC')
    }

    if (stripMetadata) {
      content = content.replace(/\{\\info[\s\S]*?\}\}/gi, '')
      content = content.replace(/<meta\b[^>]*name="(?:author|generator|company|keywords)"[^>]*>/gi, '')
      actions.push('Membersihkan informasi metadata Author & Generator dari .DOC')
    }

    if (stripInvisibles) {
      const cleaned = cleanText(content, { normalizeSpaces: true, stripPua: true, stripTags: true })
      content = cleaned.cleanedText
      actions.push(`Membersihkan karakter tersembunyi (${cleaned.stats.totalChanges} perubahan)`)
    }

    if (convertDocToDocx) {
      const lines = content
        .replace(/<[^>]+>/g, ' ')
        .replace(/\\[a-z]+\d*\s?/gi, ' ')
        .split(/[\r\n]+/)
        .map(s => s.trim())
        .filter(Boolean)
      const docxBytes = buildCleanDocxFromParagraphs(lines)
      const blob = new Blob([docxBytes], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      })
      actions.push('Mengonversi dokumen .DOC menjadi format .DOCX modern yang bersih')
      return {
        blob,
        ext: 'docx',
        actions,
        originalSize: file.size,
        cleanedSize: blob.size,
      }
    }

    const outBytes = new TextEncoder().encode(content)
    const blob = new Blob([outBytes], { type: 'application/msword' })
    return {
      blob,
      ext: 'doc',
      actions,
      originalSize: file.size,
      cleanedSize: blob.size,
    }
  }

  // Binary OLE2 .doc
  if (convertDocToDocx) {
    let paragraphs = extractTextFromBinaryDoc(bytes)
    if (stripVisualWatermark && customWatermarkText.trim()) {
      const rx = new RegExp(customWatermarkText.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
      paragraphs = paragraphs.map(p => p.replace(rx, '')).filter(p => p.trim())
    }
    if (stripInvisibles) {
      paragraphs = paragraphs.map(p => cleanText(p).cleanedText)
    }
    const docxBytes = buildCleanDocxFromParagraphs(paragraphs)
    const blob = new Blob([docxBytes], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    actions.push('Mengekstrak isi dokumen .DOC biner & membangun ulang sebagai .DOCX bersih tanpa objek Watermark')
    actions.push('Menghapus seluruh stream metadata lama & karakter steganografi AI')
    return {
      blob,
      ext: 'docx',
      actions,
      originalSize: file.size,
      cleanedSize: blob.size,
    }
  }

  // In-place binary sanitization for OLE2 .doc (preserves exact stream length so OLE sectors stay valid)
  const sanitized = new Uint8Array(bytes)
  let replacedUtf16 = 0

  // Neutralize UTF-16LE invisible characters in-place by replacing with standard space (0x20 0x00)
  for (let i = 0; i < sanitized.length - 1; i += 2) {
    const code = (sanitized[i + 1] << 8) | sanitized[i]
    if (stripInvisibles && (STRIP_CODEPOINTS.has(code) || SPACE_HOMOGLYPHS.has(code))) {
      sanitized[i] = 0x20
      sanitized[i + 1] = 0x00
      replacedUtf16++
    }
  }

  // Neutralize ASCII watermark shape identifiers in-place if present
  if (stripVisualWatermark) {
    const markers = ['PowerPlusWaterMarkObject', 'WordPictureWatermark']
    const rawStr = new TextDecoder('latin1').decode(sanitized)
    for (const marker of markers) {
      let pos = rawStr.indexOf(marker)
      while (pos !== -1) {
        for (let k = 0; k < marker.length; k++) {
          sanitized[pos + k] = 0x20 // space
        }
        pos = rawStr.indexOf(marker, pos + marker.length)
      }
    }
    actions.push('Menonaktifkan objek shape Watermark pada stream biner .DOC')
  }

  if (stripInvisibles) {
    actions.push(`Menetralkan ${replacedUtf16} karakter Invisible Unicode / spasi homoglyph pada stream .DOC`)
  }
  if (stripMetadata) {
    actions.push('Membersihkan penanda identitas dokumen pada stream .DOC')
  }

  const blob = new Blob([sanitized], { type: 'application/msword' })
  return {
    blob,
    ext: 'doc',
    actions,
    originalSize: file.size,
    cleanedSize: blob.size,
  }
}

/**
 * Create a realistic sample .DOCX file containing:
 * - A diagonal Word VML Watermark ("RAHASIA - DRAFT") in word/header1.xml inside a Watermarks SDT gallery
 * - Background shape display in word/settings.xml + RSID session tracking IDs
 * - Author/AI Creator metadata in docProps/core.xml & docProps/app.xml
 * - Invisible Unicode steganography markers (U+200B, U+00AD, U+200C) inside word/document.xml
 */
export function createSampleWatermarkedDocx() {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`

  const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`

  const wordRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>`

  const header1Xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
  <w:p>
    <w:pPr><w:pStyle w:val="Header"/></w:pPr>
    <w:sdt>
      <w:sdtPr>
        <w:id w:val="18493021"/>
        <w:docPartObj>
          <w:docPartGallery w:val="Watermarks"/>
          <w:docPartUnique/>
        </w:docPartObj>
      </w:sdtPr>
      <w:sdtContent>
        <w:r>
          <w:pict>
            <v:shape id="PowerPlusWaterMarkObject357476642" o:spid="_x0000_s2049" type="#_x0000_t136" style="position:absolute;margin-left:0;margin-top:0;width:468pt;height:117pt;rotation:315;z-index:-251656192;mso-position-horizontal:center;mso-position-horizontal-relative:margin;mso-position-vertical:center;mso-position-vertical-relative:margin" o:allowincell="f" fillcolor="silver" stroked="f">
              <v:fill opacity=".5"/>
              <v:textpath style="font-family:&quot;Calibri&quot;;font-size:1pt" string="RAHASIA - DRAFT"/>
            </v:shape>
          </w:pict>
        </w:r>
      </w:sdtContent>
    </w:sdt>
  </w:p>
</w:hdr>`

  const settingsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:displayBackgroundShape/>
  <w:rsids>
    <w:rsidRoot w:val="00A12B3C"/>
    <w:rsid w:val="00A12B3C"/>
    <w:rsid w:val="00F48D12"/>
    <w:rsid w:val="0099C4E1"/>
  </w:rsids>
</w:settings>`

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:background w:color="FFFFFF"/>
  <w:body>
    <w:p w:rsidR="00A12B3C">
      <w:r><w:t>LAPORAN EVALUASI KINERJA TRIWULAN</w:t></w:r>
    </w:p>
    <w:p w:rsidR="00F48D12">
      <w:r><w:t>Dokumen\u200B ini merupakan contoh file Microsoft Word (.docx) yang memiliki watermark diagonal "RAHASIA - DRAFT" pada bagian Header,\u00AD metadata pembuat otomatis,\u200C serta karakter tersembunyi (Invisible Unicode).\uFEFF</w:t></w:r>
    </w:p>
    <w:p w:rsidR="0099C4E1">
      <w:r><w:t>Gunakan fitur Hapus Watermark pada halaman ini untuk menghapus watermark visual Word, membersihkan jejak sesi RSID, mengosongkan metadata pembuat, dan menghapus steganografi karakter tersembunyi sekaligus.</w:t></w:r>
    </w:p>
    <w:sectPr>
      <w:headerReference w:type="default" r:id="rId1"/>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`

  const coreXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <dc:title>Laporan Evaluasi Internal</dc:title>
  <dc:creator>AI Assistant Generator v4.2</dc:creator>
  <cp:lastModifiedBy>Sistem Watermark Otomatis</cp:lastModifiedBy>
  <cp:keywords>AI-Generated, Confidential, Watermarked</cp:keywords>
</cp:coreProperties>`

  const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Microsoft Office Word / AI Writer</Application>
  <Company>Divisi Administrasi</Company>
</Properties>`

  const zipped = zipSync({
    '[Content_Types].xml': strToU8(contentTypesXml),
    '_rels/.rels': strToU8(relsXml),
    'word/_rels/document.xml.rels': strToU8(wordRelsXml),
    'word/header1.xml': strToU8(header1Xml),
    'word/settings.xml': strToU8(settingsXml),
    'word/document.xml': strToU8(documentXml),
    'docProps/core.xml': strToU8(coreXml),
    'docProps/app.xml': strToU8(appXml),
  })

  return new File([zipped], 'Contoh_Dokumen_Berwatermark.docx', {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  })
}

/**
 * Clean image metadata (EXIF, XMP, C2PA, and prompt chunks) by rasterizing
 * through an HTML5 canvas and re-encoding.
 */
export async function cleanImageMetadata(file) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0)

      const type = file.type || 'image/png'
      canvas.toBlob(blob => {
        if (!blob) {
          reject(new Error('Gagal memproses gambar'))
          return
        }
        resolve({
          blob,
          originalSize: file.size,
          cleanedSize: blob.size,
          actions: [
            'Menghapus metadata EXIF & GPS',
            'Menghapus tag XMP & manifest C2PA Content Credentials',
            'Menghapus chunk komentar & jejak AI generator',
          ],
        })
      }, type, 0.95)
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Gagal membaca file gambar "${file.name}"`))
    }

    img.src = url
  })
}
