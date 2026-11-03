import { useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import { IconLock, IconEye, IconEyeOff, IconShieldCheck } from '../components/Icons'
import { loadEditablePdf, savePdf } from '../utils/pdfConfig'
import { baseName } from '../utils/files'

const PRINT_OPTIONS = [
  { value: 'highResolution', label: 'Resolusi Tinggi' },
  { value: 'lowResolution', label: 'Resolusi Rendah' },
  { value: 'none', label: 'Dilarang Cetak' },
]

export default function ProtectPdf() {
  const [file, setFile] = useState(null)
  const [userPassword, setUserPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [printPerm, setPrintPerm] = useState('highResolution')
  const [allowCopy, setAllowCopy] = useState(false)
  const [allowModify, setAllowModify] = useState(false)
  const [allowAnnotate, setAllowAnnotate] = useState(true)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)

  const passwordMismatch = Boolean(confirmPassword && userPassword !== confirmPassword)
  const canSubmit = Boolean(file && (userPassword || ownerPassword) && !passwordMismatch)

  const apply = async e => {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true)

    try {
      const doc = await loadEditablePdf(file)
      const effectiveOwner = ownerPassword || userPassword

      doc.encrypt({
        userPassword: userPassword || undefined,
        ownerPassword: effectiveOwner,
        permissions: {
          printing: printPerm === 'none' ? false : printPerm,
          copying: allowCopy,
          contentAccessibility: allowCopy,
          modifying: allowModify,
          documentAssembly: allowModify,
          annotating: allowAnnotate,
          fillingForms: allowAnnotate,
        },
      })

      const blob = await savePdf(doc)
      setResult({
        name: `${baseName(file.name)}_terkunci.pdf`,
        blob,
        pages: doc.getPageCount(),
        hasOpenPass: Boolean(userPassword),
      })
      toast.success('PDF berhasil dienkripsi dengan AES-256!')
    } catch (err) {
      toast.error(`Gagal mengunci PDF: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  const reset = () => {
    setFile(null)
    setUserPassword('')
    setConfirmPassword('')
    setOwnerPassword('')
    setResult(null)
  }

  return (
    <ToolPage toolId="protect-pdf">
      {result ? (
        <ResultPanel
          title="PDF Berhasil Dikunci"
          summary={`${result.pages} halaman · Dilindungi enkripsi AES-256`}
          files={[result]}
          onReset={reset}
        >
          <div className="panel" style={{ marginTop: '16px', background: 'var(--surface-2)' }}>
            <h3 style={{ fontSize: '15px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconShieldCheck size={18} />
              Status Keamanan Dokumen:
            </h3>
            <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '13.5px', color: 'var(--text-2)' }}>
              <li>
                {result.hasOpenPass
                  ? 'Membutuhkan kata sandi saat dokumen dibuka.'
                  : 'Bisa dibuka langsung, namun dibatasi kata sandi izin pemilik.'}
              </li>
              <li>Izin Cetak: {printPerm === 'none' ? 'Dinonaktifkan' : printPerm === 'lowResolution' ? 'Resolusi Rendah' : 'Diizinkan'}</li>
              <li>Izin Salin Teks (Copy): {allowCopy ? 'Diizinkan' : 'Dinonaktifkan'}</li>
              <li>Izin Edit Halaman: {allowModify ? 'Diizinkan' : 'Dinonaktifkan'}</li>
            </ul>
          </div>
        </ResultPanel>
      ) : !file ? (
        <Dropzone
          onFiles={f => setFile(f[0])}
          title="Pilih file PDF yang ingin diberi kata sandi"
          hint="Enkripsi AES-256 untuk melindungi pembukaan, penyalinan, dan pencetakan dokumen"
        />
      ) : (
        <form className="workspace" onSubmit={apply}>
          <ul className="file-list">
            <FileRow file={file} onRemove={reset} disabled={busy} />
          </ul>

          <div className="panel">
            <h2 style={{ fontSize: '16px', marginBottom: '16px' }}>Pengaturan Kata Sandi</h2>

            <div className="panel-grid-2">
              <Field
                label="Kata Sandi Buka Dokumen"
                htmlFor="user-pass"
                hint="Wajib diketik pengguna saat membuka file PDF ini"
              >
                <div className="input-affix">
                  <input
                    id="user-pass"
                    className="input"
                    type={showPass ? 'text' : 'password'}
                    placeholder="Masukkan kata sandi…"
                    value={userPassword}
                    onChange={e => setUserPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => setShowPass(v => !v)}
                    aria-label={showPass ? 'Sembunyikan' : 'Tampilkan'}
                  >
                    {showPass ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                  </button>
                </div>
              </Field>

              <Field
                label="Ulangi Kata Sandi Buka"
                htmlFor="confirm-pass"
                hint="Pastikan sama dengan kata sandi di samping"
              >
                <input
                  id="confirm-pass"
                  className="input"
                  type={showPass ? 'text' : 'password'}
                  placeholder="Ketik ulang kata sandi…"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  aria-invalid={passwordMismatch || undefined}
                  autoComplete="new-password"
                />
                {passwordMismatch && (
                  <p className="field-error">Kata sandi konfirmasi belum cocok.</p>
                )}
              </Field>
            </div>

            <Field
              label="Kata Sandi Izin / Pemilik (Opsional)"
              htmlFor="owner-pass"
              hint="Jika dikosongkan, otomatis mengikuti kata sandi buka di atas."
            >
              <input
                id="owner-pass"
                className="input"
                type={showPass ? 'text' : 'password'}
                placeholder="Opsional: kata sandi khusus administrator/pemilik…"
                value={ownerPassword}
                onChange={e => setOwnerPassword(e.target.value)}
                style={{ maxWidth: '420px' }}
                autoComplete="new-password"
              />
            </Field>
          </div>

          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '16px' }}>Batasan & Hak Akses Pembaca</h2>

            <Field label="Izin Mencetak (Print)">
              <Segmented
                name="print-perm"
                value={printPerm}
                onChange={setPrintPerm}
                options={PRINT_OPTIONS}
              />
            </Field>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowCopy}
                  onChange={e => setAllowCopy(e.target.checked)}
                />
                <span>Izinkan menyalin teks dan gambar dari dokumen (Copy/Extract)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowModify}
                  onChange={e => setAllowModify(e.target.checked)}
                />
                <span>Izinkan memodifikasi isi, memutar, atau menghapus halaman</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowAnnotate}
                  onChange={e => setAllowAnnotate(e.target.checked)}
                />
                <span>Izinkan mengisi formulir dan menambahkan komentar/tanda tangan</span>
              </label>
            </div>
          </div>

          <div className="action-bar">
            <button type="button" className="btn btn-secondary" onClick={reset} disabled={busy}>
              Ganti file
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={busy || !canSubmit || (userPassword && !confirmPassword)}
            >
              {busy ? <Spinner /> : <IconLock size={17} />}
              {busy ? 'Mengenkripsi…' : 'Kunci PDF'}
            </button>
          </div>
        </form>
      )}
    </ToolPage>
  )
}
