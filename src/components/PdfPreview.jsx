import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { openPdfjs, renderPage, canvasToBlob, closePdf } from '../utils/pdfConfig'

const PREVIEW_WIDTH = 640

// Swap in the new preview first, then free the old URL, so the image never flashes empty.
const replacePreview = next => prev => {
  if (prev) setTimeout(() => URL.revokeObjectURL(prev.url), 1000)
  return next
}

/*
 * Opens a PDF once and renders one page at a time for placement previews.
 * `size` is the displayed page size in PDF points (rotation applied).
 */
export function usePagePreview(file, pageNumber) {
  const [pdf, setPdf] = useState(null)
  const [numPages, setNumPages] = useState(0)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (!file) return
    let cancelled = false
    let doc = null
    openPdfjs(file)
      .then(d => {
        doc = d
        if (cancelled) return closePdf(d)
        setPdf(d)
        setNumPages(d.numPages)
      })
      .catch(err => !cancelled && toast.error(err.message))
    return () => {
      cancelled = true
      closePdf(doc)
      setPdf(null)
      setNumPages(0)
      setPreview(replacePreview(null))
    }
  }, [file])

  useEffect(() => {
    if (!pdf || !pageNumber) return
    let cancelled = false
    ;(async () => {
      const page = await pdf.getPage(pageNumber)
      const base = page.getViewport({ scale: 1 })
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const canvas = await renderPage(page, (PREVIEW_WIDTH * dpr) / base.width)
      const blob = await canvasToBlob(canvas, 'image/jpeg', 0.88)
      if (cancelled) return
      const url = URL.createObjectURL(blob)
      setPreview(replacePreview({ url, n: pageNumber, size: { width: base.width, height: base.height } }))
    })().catch(err => !cancelled && toast.error(err.message))
    return () => {
      cancelled = true
    }
  }, [pdf, pageNumber])

  return { numPages, preview }
}
