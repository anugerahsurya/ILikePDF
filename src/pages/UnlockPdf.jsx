import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { PDFDocument, EncryptedPDFError } from '@cantoo/pdf-lib'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { Field, FileRow, Spinner } from '../components/ui'
import { IconUnlock, IconEye, IconEyeOff, IconInfo } from '../components/Icons'
import { savePdf } from '../utils/pdfConfig'
import { baseName } from '../utils/files'

/* 'open' = not encrypted, 'owner' = restrictions only, 'user' = needs a password to open. */
async function detectLock(file) {
  const bytes = await file.arrayBuffer()
  try {
    await PDFDocument.load(bytes)
    return 'open'
  } catch (err) {
    if (!(err instanceof EncryptedPDFError)) throw new Error(`"${file.name}" tidak bisa dibaca sebagai PDF.`)
  }
  try {
    await PDFDocument.load(bytes, { password: '' })
    return 'owner'
  } catch {
    return 'user'
  }
}

export default function UnlockPdf() {
  const [file, setFile] = useState(null)
  const [lock, setLock] = useState(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (!file) return
    let cancelled = false
    setLock(null)
    detectLock(file)
      .then(l => !cancelled && setLock(l))
      .catch(err => {
        if (cancelled) return
        toast.error(err.message)
        setFile(null)
      })
    return () => {
      cancelled = true
    }
  }, [file])

  const unlock = async e => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      let doc
      try {
        doc = await PDFDocument.load(await file.arrayBuffer(), { password: lock === 'user' ? password : '' })
      } catch {
        setError('Kata sandi salah. Periksa huruf besar/kecil lalu coba lagi.')
        return
      }
      setResult({ name: `${baseName(file.name)}_terbuka.pdf`, blob: await savePdf(doc), pages: doc.getPageCount() })
    } catch (err) {
      toast.error(`Gagal membuka kunci: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setLock(null)
    setPassword('')
    setError('')
    setResult(null)
  }

  return (
    <ToolPage toolId="unlock">
      {result ? (
        <ResultPanel title="Kunci PDF dibuka" summary={`${result.pages} halaman · bisa dibuka, diedit, dan dicetak tanpa kata sandi`} files={[result]} onReset={reset} />
      ) : !file ? (
        <Dropzone onFiles={f => setFile(f[0])} />
      ) : (
        <form className="workspace" onSubmit={unlock}>
          <ul className="file-list">
            <FileRow
              file={file}
              meta={!lock ? 'memeriksa…' : lock === 'open' ? 'tidak terkunci' : lock === 'owner' ? 'dibatasi edit/cetak' : 'butuh kata sandi'}
              onRemove={reset}
              disabled={busy}
            />
          </ul>

          {lock === 'open' && (
            <p className="note">
              <IconInfo size={15} />
              PDF ini tidak terkunci, jadi tidak ada yang perlu dibuka. Anda bisa langsung memakai alat lain.
            </p>
          )}

          {lock === 'owner' && (
            <p className="note">
              <IconInfo size={15} />
              PDF ini bisa dibuka tanpa kata sandi, tetapi edit atau cetaknya dibatasi. Batasan itu akan dihapus.
            </p>
          )}

          {lock === 'user' && (
            <div className="panel">
              <Field label="Kata sandi PDF" htmlFor="pdf-password" hint="Kata sandi yang biasa Anda ketik saat membuka file ini.">
                <div className="input-affix">
                  <input
                    id="pdf-password"
                    className="input"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => {
                      setPassword(e.target.value)
                      setError('')
                    }}
                    autoComplete="off"
                    autoFocus
                    aria-invalid={Boolean(error)}
                  />
                  <button type="button" className="btn-icon" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}>
                    {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </Field>
              {error && <p className="field-error">{error}</p>}
            </div>
          )}

          <div className="action-bar">
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !lock || lock === 'open' || (lock === 'user' && !password)}>
              {busy ? <Spinner /> : <IconUnlock size={17} />}
              {busy ? 'Membuka…' : 'Buka kunci'}
            </button>
          </div>
        </form>
      )}
    </ToolPage>
  )
}
