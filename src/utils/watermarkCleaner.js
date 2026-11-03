import { loadEditablePdf, savePdf, openPdfjs, closePdf } from './pdfConfig'
import { PDFName, rgb } from '@cantoo/pdf-lib'

/**
 * Watermarks & AI Provenance Cleaner Utility
 * Inspired by and implementing the Layer A / File / Document metadata stripping from
 * guillaumemeyer/watermarks-remover (MIT)
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
    visualMask = null, // { enabled: boolean, preset: 'diagonal' | 'center' | 'top' | 'bottom' | 'custom', customBox?: { x, y, width, height }, targetPages: 'all' | 'custom', pageRange?: string, color: '#ffffff' }
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
        // Mask diagonal center band
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
