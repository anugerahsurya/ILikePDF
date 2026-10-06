import { useState } from 'react'
import { toast } from 'sonner'
import { degrees } from '@cantoo/pdf-lib'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import PageGrid, { usePdfPages } from '../components/PageGrid'
import { FileRow, Spinner } from '../components/ui'
import { IconRotate, IconRotateCcw } from '../components/Icons'
import { loadEditablePdf, savePdf } from '../utils/pdfConfig'
import { baseName } from '../utils/files'

// Angles keep accumulating (e.g. 450) so the CSS transition always turns the
// short way instead of spinning back through 0.
const norm = deg => ((deg % 360) + 360) % 360

export default function RotatePdf() {
  const [file, setFile] = useState(null)
  const { numPages, pages } = usePdfPages(file)
  const [angles, setAngles] = useState({})
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const turn = (n, delta) => setAngles(a => ({ ...a, [n]: (a[n] || 0) + delta }))
  const turnAll = delta =>
    setAngles(a => {
      const next = {}
      for (let n = 1; n <= numPages; n++) next[n] = (a[n] || 0) + delta
      return next
    })

  const changed = Object.values(angles).filter(d => norm(d) !== 0).length

  const apply = async () => {
    setBusy(true)
    try {
      const doc = await loadEditablePdf(file)
      doc.getPages().forEach((page, i) => {
        const add = norm(angles[i + 1] || 0)
        if (add) page.setRotation(degrees(norm(page.getRotation().angle + add)))
      })
      setResult({ name: `${baseName(file.name)}_diputar.pdf`, blob: await savePdf(doc) })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setAngles({})
    setResult(null)
  }

  return (
    <ToolPage toolId="rotate">
      {result ? (
        <ResultPanel title="Halaman berhasil diputar" summary={`${changed} halaman diubah orientasinya`} files={[result]} onReset={reset} />
      ) : !file ? (
        <Dropzone onFiles={f => setFile(f[0])} />
      ) : (
        <div className="workspace">
          <ul className="file-list">
            <FileRow file={file} meta={numPages ? `${numPages} halaman` : 'membaca…'} onRemove={reset} disabled={busy} />
          </ul>

          <div className="panel">
            <div className="panel-head">
              <h2>Klik halaman untuk memutar 90°</h2>
              <div className="panel-tools">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => turnAll(-90)} disabled={!numPages}>
                  <IconRotateCcw size={14} />
                  Semua ke kiri
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => turnAll(90)} disabled={!numPages}>
                  <IconRotate size={14} />
                  Semua ke kanan
                </button>
                {changed > 0 && (
                  <button type="button" className="link-btn" onClick={() => setAngles({})}>
                    Kembalikan
                  </button>
                )}
              </div>
            </div>
            <PageGrid
              numPages={numPages}
              pages={pages}
              variant="rotate"
              onToggle={n => turn(n, 90)}
              isActive={n => norm(angles[n] || 0) !== 0}
              rotation={n => angles[n] || 0}
              renderAction={n => (
                <button type="button" className="btn-icon btn-icon-sm" onClick={() => turn(n, -90)} aria-label={`Putar halaman ${n} ke kiri`}>
                  <IconRotateCcw size={13} />
                </button>
              )}
            />
          </div>

          <div className="action-bar">
            <p className="action-note">{changed ? `${changed} halaman akan diputar.` : 'Belum ada perubahan.'}</p>
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={apply} disabled={busy || !changed}>
              {busy ? <Spinner /> : <IconRotate size={17} />}
              {busy ? 'Menyimpan…' : 'Simpan PDF'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
