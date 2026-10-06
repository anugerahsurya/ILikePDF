import { useState } from 'react'
import { toast } from 'sonner'
import { downloadAll, downloadBlob, formatSize } from '../utils/files'
import { IconDownload, IconRefresh } from './Icons'

/*
 * Shown after every operation.
 * files: [{ name, blob, meta?, preview? }]
 */
export default function ResultPanel({ title = 'Selesai', summary, files, zipName = 'hasil.zip', onReset, children }) {
  const [zipping, setZipping] = useState(false)
  const total = files.reduce((s, f) => s + f.blob.size, 0)
  const many = files.length > 1

  const handleDownloadAll = async () => {
    setZipping(true)
    try {
      await downloadAll(files, zipName)
    } catch (err) {
      toast.error(`Gagal menyiapkan unduhan: ${err.message}`)
    } finally {
      setZipping(false)
    }
  }

  return (
    <section className="result page-enter" aria-live="polite">
      <div className="result-head">
        <span className="result-check" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" pathLength="1" />
          </svg>
        </span>
        <div className="result-head-text">
          <h2>{title}</h2>
          <p>{summary || `${files.length} file · ${formatSize(total)}`}</p>
        </div>
        <div className="result-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={handleDownloadAll} disabled={zipping}>
            {zipping ? <span className="spinner" /> : <IconDownload size={17} />}
            {many ? `Unduh semua (.zip)` : 'Unduh'}
          </button>
          <button type="button" className="btn btn-secondary btn-lg" onClick={onReset}>
            <IconRefresh size={16} />
            Proses file lain
          </button>
        </div>
      </div>

      {children}

      {many && !children && (
        <ul className="result-list">
          {files.map(f => (
            <li key={f.name} className="result-item">
              <div className="file-row-main">
                <span className="file-name" title={f.name}>
                  {f.name}
                </span>
                <span className="file-meta">
                  {formatSize(f.blob.size)}
                  {f.meta ? ` · ${f.meta}` : ''}
                </span>
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadBlob(f.blob, f.name)}>
                <IconDownload size={14} />
                Unduh
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
