import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { openPdfjs, renderPage, canvasToBlob, closePdf } from '../utils/pdfConfig'

const THUMB_WIDTH = 150

/*
 * Renders page thumbnails progressively so large PDFs show the first pages
 * right away. Returns object URLs that are revoked on cleanup.
 */
export function usePdfPages(file) {
  const [state, setState] = useState({ numPages: 0, pages: [], loading: false, error: null })

  useEffect(() => {
    if (!file) {
      setState({ numPages: 0, pages: [], loading: false, error: null })
      return
    }
    let cancelled = false
    let pdf = null
    const urls = []
    setState({ numPages: 0, pages: [], loading: true, error: null })

    ;(async () => {
      try {
        pdf = await openPdfjs(file)
        if (cancelled) return
        setState(s => ({ ...s, numPages: pdf.numPages }))
        const dpr = Math.min(2, window.devicePixelRatio || 1)
        for (let n = 1; n <= pdf.numPages; n++) {
          if (cancelled) return
          const page = await pdf.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const canvas = await renderPage(page, (THUMB_WIDTH * dpr) / base.width)
          const blob = await canvasToBlob(canvas, 'image/jpeg', 0.82)
          if (cancelled) return
          const url = URL.createObjectURL(blob)
          urls.push(url)
          const entry = { n, url, ratio: base.width / base.height }
          setState(s => ({ ...s, pages: [...s.pages, entry] }))
        }
        setState(s => ({ ...s, loading: false }))
      } catch (err) {
        if (cancelled) return
        toast.error(err.message)
        setState(s => ({ ...s, loading: false, error: err }))
      }
    })()

    return () => {
      cancelled = true
      closePdf(pdf)
      urls.forEach(u => URL.revokeObjectURL(u))
    }
  }, [file])

  return state
}

/*
 * variant: 'select' shows a check, 'delete' strikes the page out.
 * rotation(n) returns a CSS rotation in degrees for the Rotate tool.
 */
export default function PageGrid({ numPages, pages, isActive, onToggle, variant = 'select', rotation, renderAction }) {
  return (
    <ul className="page-grid">
      {Array.from({ length: numPages }, (_, i) => {
        const n = i + 1
        const page = pages[i]
        const active = isActive?.(n)
        const deg = rotation?.(n) ?? 0
        const clickable = Boolean(onToggle)
        return (
          <li key={n} className="page-cell" data-active={active || undefined} data-variant={variant}>
            <button
              type="button"
              className="page-thumb"
              onClick={clickable ? () => onToggle(n) : undefined}
              disabled={!clickable}
              aria-pressed={clickable ? Boolean(active) : undefined}
              aria-label={`Halaman ${n}`}
            >
              <span className="page-frame">
                {page ? (
                  <img
                    src={page.url}
                    alt=""
                    draggable={false}
                    style={rotation ? { transform: `rotate(${deg}deg)` } : undefined}
                  />
                ) : (
                  <span className="page-skeleton" />
                )}
              </span>
              {variant === 'select' && (
                <span className="page-check" aria-hidden="true">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              )}
              {variant === 'delete' && <span className="page-strike" aria-hidden="true" />}
            </button>
            <div className="page-caption">
              <span className="mono">{n}</span>
              {renderAction?.(n)}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
