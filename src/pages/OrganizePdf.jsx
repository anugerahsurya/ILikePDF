import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PDFDocument, degrees } from '@cantoo/pdf-lib'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { usePdfPages } from '../components/PageGrid'
import { FileRow, Spinner } from '../components/ui'
import {
  IconOrganize,
  IconArrowLeft,
  IconArrowRight,
  IconRotate,
  IconCopy,
  IconClose,
  IconPlus,
  IconRefresh,
} from '../components/Icons'
import { loadEditablePdf, savePdf } from '../utils/pdfConfig'
import { baseName } from '../utils/files'

const norm = deg => ((deg % 360) + 360) % 360

let nextUid = 1

export default function OrganizePdf() {
  const [file, setFile] = useState(null)
  const { numPages, pages } = usePdfPages(file)
  const [items, setItems] = useState([])
  const [dragIdx, setDragIdx] = useState(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!numPages) {
      setItems([])
      return
    }
    setItems(
      Array.from({ length: numPages }, (_, i) => ({
        id: nextUid++,
        type: 'page',
        srcPage: i + 1,
        rotation: 0,
      })),
    )
  }, [numPages])

  const moveItem = (index, delta) => {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    setItems(prev => {
      const next = [...prev]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  const rotateItem = (index, delta = 90) => {
    setItems(prev =>
      prev.map((it, idx) => (idx === index ? { ...it, rotation: it.rotation + delta } : it)),
    )
  }

  const duplicateItem = index => {
    setItems(prev => {
      const next = [...prev]
      const copy = { ...prev[index], id: nextUid++ }
      next.splice(index + 1, 0, copy)
      return next
    })
  }

  const removeItem = index => {
    if (items.length <= 1) {
      toast.error('Minimal harus tersisa 1 halaman dalam dokumen.')
      return
    }
    setItems(prev => prev.filter((_, idx) => idx !== index))
  }

  const insertBlankPage = afterIndex => {
    setItems(prev => {
      const next = [...prev]
      const blank = { id: nextUid++, type: 'blank', rotation: 0 }
      if (afterIndex == null || afterIndex >= next.length) {
        next.push(blank)
      } else {
        next.splice(afterIndex + 1, 0, blank)
      }
      return next
    })
  }

  const reverseOrder = () => {
    setItems(prev => [...prev].reverse())
  }

  const resetItems = () => {
    if (!numPages) return
    setItems(
      Array.from({ length: numPages }, (_, i) => ({
        id: nextUid++,
        type: 'page',
        srcPage: i + 1,
        rotation: 0,
      })),
    )
  }

  const handleDrop = targetIdx => {
    if (dragIdx == null || dragIdx === targetIdx) {
      setDragIdx(null)
      return
    }
    setItems(prev => {
      const next = [...prev]
      const [moved] = next.splice(dragIdx, 1)
      next.splice(targetIdx, 0, moved)
      return next
    })
    setDragIdx(null)
  }

  const apply = async () => {
    if (!items.length) return
    setBusy(true)
    try {
      const srcDoc = await loadEditablePdf(file)
      const outDoc = await PDFDocument.create()

      // Reference page size from first page
      const firstPage = srcDoc.getPages()[0]
      const defaultSize = firstPage ? firstPage.getSize() : { width: 595.28, height: 841.89 }

      for (const item of items) {
        if (item.type === 'blank') {
          const blankPage = outDoc.addPage([defaultSize.width, defaultSize.height])
          const rot = norm(item.rotation)
          if (rot) blankPage.setRotation(degrees(rot))
        } else {
          const [copied] = await outDoc.copyPages(srcDoc, [item.srcPage - 1])
          const rot = norm((copied.getRotation()?.angle || 0) + item.rotation)
          copied.setRotation(degrees(rot))
          outDoc.addPage(copied)
        }
      }

      const blob = await savePdf(outDoc)
      setResult({
        name: `${baseName(file.name)}_diatur.pdf`,
        blob,
        totalPages: items.length,
      })
    } catch (err) {
      toast.error(`Gagal mengatur halaman: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setItems([])
    setResult(null)
  }

  return (
    <ToolPage toolId="organize-pdf">
      {result ? (
        <ResultPanel
          title="Urutan Halaman Disimpan"
          summary={`Dokumen baru berisi ${result.totalPages} halaman`}
          files={[result]}
          onReset={reset}
        />
      ) : !file ? (
        <Dropzone
          onFiles={f => setFile(f[0])}
          title="Pilih file PDF yang ingin diatur halamannya"
          hint="Geser urutan halaman, duplikat, sisipkan halaman kosong, putar, atau hapus halaman"
        />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            <FileRow
              file={file}
              meta={numPages ? `${numPages} halaman asli · kini ${items.length} halaman` : 'membaca…'}
              onRemove={reset}
              disabled={busy}
            />
          </ul>

          <div className="panel">
            <div className="panel-head">
              <h2>Seret kartu halaman untuk mengurutkan, atau gunakan tombol aksi</h2>
              <div className="panel-tools">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => insertBlankPage(items.length - 1)}
                  disabled={!numPages}
                >
                  <IconPlus size={14} />
                  Halaman Kosong
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={reverseOrder}
                  disabled={items.length < 2}
                >
                  <IconRefresh size={14} />
                  Balik Urutan
                </button>
                <button
                  type="button"
                  className="link-btn"
                  onClick={resetItems}
                  disabled={!numPages}
                >
                  Reset
                </button>
              </div>
            </div>

            <ul className="page-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(144px, 1fr))' }}>
              {items.map((item, idx) => {
                const pageThumb = item.type === 'page' ? pages[item.srcPage - 1] : null
                return (
                  <li
                    key={item.id}
                    className="page-cell"
                    draggable
                    onDragStart={() => setDragIdx(idx)}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => handleDrop(idx)}
                    style={{
                      opacity: dragIdx === idx ? 0.45 : 1,
                      cursor: 'grab',
                    }}
                  >
                    <div className="page-thumb" style={{ cursor: 'grab' }}>
                      <span className="page-frame">
                        {item.type === 'blank' ? (
                          <div
                            style={{
                              width: '72%',
                              aspectRatio: '0.707',
                              background: '#ffffff',
                              border: '1.5px dashed var(--border-strong)',
                              borderRadius: '3px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '11px',
                              color: 'var(--text-3)',
                              transform: `rotate(${item.rotation}deg)`,
                            }}
                          >
                            Kosong
                          </div>
                        ) : pageThumb ? (
                          <img
                            src={pageThumb.url}
                            alt={`Halaman ${item.srcPage}`}
                            draggable={false}
                            style={{ transform: `rotate(${item.rotation}deg)` }}
                          />
                        ) : (
                          <span className="page-skeleton" />
                        )}
                      </span>
                    </div>

                    <div
                      className="page-caption"
                      style={{
                        justifyContent: 'space-between',
                        paddingInline: '2px',
                        marginTop: '6px',
                      }}
                    >
                      <span className="mono" title={item.type === 'blank' ? 'Halaman kosong' : `Halaman asli #${item.srcPage}`}>
                        #{idx + 1}{' '}
                        <span style={{ color: 'var(--text-3)', fontSize: '11px' }}>
                          ({item.type === 'blank' ? 'Kosong' : `Hal.${item.srcPage}`})
                        </span>
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: '2px',
                        marginTop: '4px',
                        background: 'var(--surface-2)',
                        borderRadius: '6px',
                        padding: '2px',
                      }}
                    >
                      <button
                        type="button"
                        className="btn-icon btn-icon-sm"
                        onClick={() => moveItem(idx, -1)}
                        disabled={idx === 0}
                        title="Geser ke kiri"
                      >
                        <IconArrowLeft size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-icon-sm"
                        onClick={() => moveItem(idx, 1)}
                        disabled={idx === items.length - 1}
                        title="Geser ke kanan"
                      >
                        <IconArrowRight size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-icon-sm"
                        onClick={() => rotateItem(idx, 90)}
                        title="Putar 90°"
                      >
                        <IconRotate size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-icon-sm"
                        onClick={() => duplicateItem(idx)}
                        title="Duplikat halaman ini"
                      >
                        <IconCopy size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-icon-sm btn-icon-danger"
                        onClick={() => removeItem(idx)}
                        disabled={items.length <= 1}
                        title="Hapus halaman ini"
                      >
                        <IconClose size={13} />
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="action-bar">
            <p className="action-note">Total hasil: {items.length} halaman.</p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={apply} disabled={busy || !items.length}>
              {busy ? <Spinner /> : <IconOrganize size={17} />}
              {busy ? 'Menyimpan…' : 'Simpan PDF'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
