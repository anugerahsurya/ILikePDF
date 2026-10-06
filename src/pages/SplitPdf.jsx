import { useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import PageGrid, { usePdfPages } from '../components/PageGrid'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconSplit } from '../components/Icons'
import { PDFDocument, loadEditablePdf, savePdf } from '../utils/pdfConfig'
import { baseName, parseRanges } from '../utils/files'

const MODES = [
  { value: 'each', label: 'Setiap halaman', hint: 'Satu file per halaman' },
  { value: 'ranges', label: 'Rentang', hint: 'Misalnya 1-3, 4-8' },
  { value: 'chunk', label: 'Per N halaman', hint: 'Potongan sama besar' },
  { value: 'extract', label: 'Ambil halaman', hint: 'Jadi satu file' },
]

const label = group => (group.length === 1 ? `${group[0] + 1}` : `${group[0] + 1}-${group[group.length - 1] + 1}`)

export default function SplitPdf() {
  const [file, setFile] = useState(null)
  const { numPages, pages } = usePdfPages(file)
  const [mode, setMode] = useState('each')
  const [ranges, setRanges] = useState('')
  const [chunk, setChunk] = useState(2)
  const [picked, setPicked] = useState([])
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState(null)

  const buildGroups = total => {
    if (mode === 'each') return Array.from({ length: total }, (_, i) => [i])
    if (mode === 'ranges') return parseRanges(ranges, total)
    if (mode === 'chunk') {
      const size = Math.max(1, Math.floor(chunk))
      const groups = []
      for (let i = 0; i < total; i += size) groups.push(Array.from({ length: Math.min(size, total - i) }, (_, k) => i + k))
      return groups
    }
    if (!picked.length) throw new Error('Klik minimal satu halaman yang ingin diambil.')
    return [[...picked].sort((a, b) => a - b).map(n => n - 1)]
  }

  const split = async () => {
    setBusy(true)
    try {
      const src = await loadEditablePdf(file)
      const groups = buildGroups(src.getPageCount())
      const name = baseName(file.name)
      const out = []
      for (const group of groups) {
        const doc = await PDFDocument.create()
        const copied = await doc.copyPages(src, group)
        copied.forEach(p => doc.addPage(p))
        const suffix = mode === 'extract' ? 'pilihan' : `hal-${label(group)}`
        out.push({ name: `${name}_${suffix}.pdf`, blob: await savePdf(doc), meta: `${group.length} halaman` })
      }
      setResults(out)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setResults(null)
    setPicked([])
    setRanges('')
  }

  const toggle = n => setPicked(p => (p.includes(n) ? p.filter(x => x !== n) : [...p, n]))

  return (
    <ToolPage toolId="split">
      {results ? (
        <ResultPanel
          title="PDF berhasil dipisah"
          summary={`${results.length} file dibuat dari ${file.name}`}
          files={results}
          zipName={`${baseName(file.name)}_split.zip`}
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
            <Field label="Cara memisahkan">
              <Segmented name="split-mode" value={mode} onChange={setMode} options={MODES} disabled={busy} />
            </Field>

            {mode === 'ranges' && (
              <Field label="Rentang halaman" htmlFor="ranges" hint="Pisahkan dengan koma. Setiap rentang menjadi satu file.">
                <input
                  id="ranges"
                  className="input"
                  value={ranges}
                  onChange={e => setRanges(e.target.value)}
                  placeholder={numPages > 3 ? `1-3, 4-${numPages}` : '1-2, 3'}
                  autoComplete="off"
                />
              </Field>
            )}

            {mode === 'chunk' && (
              <Field label="Jumlah halaman per file" htmlFor="chunk" hint={numPages ? `Menghasilkan ${Math.ceil(numPages / Math.max(1, chunk))} file.` : undefined}>
                <input
                  id="chunk"
                  className="input input-narrow"
                  type="number"
                  min={1}
                  max={numPages || undefined}
                  value={chunk}
                  onChange={e => setChunk(Math.max(1, Number(e.target.value) || 1))}
                />
              </Field>
            )}
          </div>

          <div className="panel">
            <div className="panel-head">
              <h2>{mode === 'extract' ? 'Klik halaman yang ingin diambil' : 'Pratinjau halaman'}</h2>
              {mode === 'extract' && (
                <span className="panel-note">
                  {picked.length} dipilih
                  {picked.length > 0 && (
                    <button type="button" className="link-btn" onClick={() => setPicked([])}>
                      Batalkan
                    </button>
                  )}
                </span>
              )}
            </div>
            <PageGrid
              numPages={numPages}
              pages={pages}
              isActive={mode === 'extract' ? n => picked.includes(n) : undefined}
              onToggle={mode === 'extract' ? toggle : undefined}
            />
          </div>

          <div className="action-bar">
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={split} disabled={busy || !numPages}>
              {busy ? <Spinner /> : <IconSplit size={17} />}
              {busy ? 'Memisahkan…' : 'Pisahkan PDF'}
            </button>
          </div>
        </div>
      )}
    </ToolPage>
  )
}
