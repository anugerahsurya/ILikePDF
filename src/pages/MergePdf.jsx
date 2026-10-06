import { useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { FileRow, Spinner } from '../components/ui'
import { IconMerge } from '../components/Icons'
import { PDFDocument, loadEditablePdf, savePdf } from '../utils/pdfConfig'
import { moveItem, withIds } from '../utils/files'

export default function MergePdf() {
  const [items, setItems] = useState([])
  const [reading, setReading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const addFiles = async files => {
    setReading(true)
    const added = []
    for (const item of withIds(files)) {
      try {
        const doc = await loadEditablePdf(item.file)
        added.push({ ...item, pages: doc.getPageCount() })
      } catch (err) {
        toast.error(err.message)
      }
    }
    setItems(prev => [...prev, ...added])
    setReading(false)
  }

  const merge = async () => {
    setBusy(true)
    try {
      const merged = await PDFDocument.create()
      for (const item of items) {
        const doc = await loadEditablePdf(item.file)
        const pages = await merged.copyPages(doc, doc.getPageIndices())
        pages.forEach(p => merged.addPage(p))
      }
      const blob = await savePdf(merged)
      setResult({ blob, name: 'gabungan.pdf', pages: merged.getPageCount() })
    } catch (err) {
      toast.error(`Gagal menggabungkan: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setItems([])
    setResult(null)
  }

  const totalPages = items.reduce((s, i) => s + i.pages, 0)

  return (
    <ToolPage toolId="merge">
      {result ? (
        <ResultPanel
          title="PDF berhasil digabung"
          summary={`${items.length} file menjadi satu dokumen · ${result.pages} halaman`}
          files={[{ name: result.name, blob: result.blob }]}
          onReset={reset}
        />
      ) : items.length === 0 ? (
        <Dropzone onFiles={addFiles} multiple busy={reading} hint="Pilih dua file PDF atau lebih" />
      ) : (
        <div className="workspace">
          <div className="panel">
            <div className="panel-head">
              <h2>{items.length} file · {totalPages} halaman</h2>
              <span className="panel-note">Urutan di bawah adalah urutan di hasil akhir</span>
            </div>
            <ol className="file-list">
              {items.map((item, i) => (
                <FileRow
                  key={item.id}
                  index={i}
                  file={item.file}
                  meta={`${item.pages} halaman`}
                  onUp={() => setItems(list => moveItem(list, i, i - 1))}
                  onDown={() => setItems(list => moveItem(list, i, i + 1))}
                  onRemove={() => setItems(list => list.filter(x => x.id !== item.id))}
                  disabled={busy || (i === 0 ? 'up' : i === items.length - 1 ? 'down' : false)}
                />
              ))}
            </ol>
            <Dropzone onFiles={addFiles} multiple compact busy={reading} />
          </div>

          <div className="action-bar">
            <p className="action-note">
              {items.length < 2 ? 'Tambahkan minimal satu file lagi.' : `Hasil: satu PDF berisi ${totalPages} halaman.`}
            </p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Mulai ulang
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={merge} disabled={busy || items.length < 2}>
              {busy ? <Spinner /> : <IconMerge size={17} />}
              {busy ? 'Menggabungkan…' : 'Gabungkan PDF'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
