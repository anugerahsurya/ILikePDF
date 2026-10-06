import { useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import PageGrid, { usePdfPages } from '../components/PageGrid'
import { FileRow, Spinner } from '../components/ui'
import { IconRemovePage } from '../components/Icons'
import { PDFDocument, loadEditablePdf, savePdf } from '../utils/pdfConfig'
import { baseName } from '../utils/files'

export default function RemovePage() {
  const [file, setFile] = useState(null)
  const { numPages, pages } = usePdfPages(file)
  const [marked, setMarked] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const toggle = n => setMarked(m => (m.includes(n) ? m.filter(x => x !== n) : [...m, n]))

  const remove = async () => {
    setBusy(true)
    try {
      const src = await loadEditablePdf(file)
      const keep = src.getPageIndices().filter(i => !marked.includes(i + 1))
      const doc = await PDFDocument.create()
      const copied = await doc.copyPages(src, keep)
      copied.forEach(p => doc.addPage(p))
      setResult({ name: `${baseName(file.name)}_dihapus.pdf`, blob: await savePdf(doc), pages: keep.length })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setMarked([])
    setResult(null)
  }

  const allMarked = numPages > 0 && marked.length >= numPages

  return (
    <ToolPage toolId="remove-page">
      {result ? (
        <ResultPanel
          title="Halaman berhasil dihapus"
          summary={`${marked.length} halaman dibuang · tersisa ${result.pages} halaman`}
          files={[result]}
          onReset={reset}
        />
      ) : !file ? (
        <Dropzone onFiles={f => setFile(f[0])} />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            <FileRow file={file} meta={numPages ? `${numPages} halaman` : 'membaca…'} onRemove={reset} disabled={busy} />
          </ul>

          <div className="panel">
            <div className="panel-head">
              <h2>Klik halaman yang ingin dihapus</h2>
              <span className="panel-note">
                {marked.length} ditandai
                {marked.length > 0 && (
                  <button type="button" className="link-btn" onClick={() => setMarked([])}>
                    Batalkan
                  </button>
                )}
              </span>
            </div>
            <PageGrid numPages={numPages} pages={pages} variant="delete" isActive={n => marked.includes(n)} onToggle={toggle} />
          </div>

          <div className="action-bar">
            <p className="action-note">
              {allMarked
                ? 'Tidak bisa menghapus semua halaman.'
                : marked.length
                  ? `Hasil akan berisi ${numPages - marked.length} halaman.`
                  : 'Belum ada halaman yang ditandai.'}
            </p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button type="button" className="btn btn-danger btn-lg" onClick={remove} disabled={busy || !marked.length || allMarked}>
              {busy ? <Spinner /> : <IconRemovePage size={17} />}
              {busy ? 'Menghapus…' : `Hapus ${marked.length || ''} halaman`}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
