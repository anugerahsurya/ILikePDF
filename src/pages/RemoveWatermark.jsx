import { useState } from 'react'
import { toast } from 'sonner'
import ToolPage from '../components/ToolPage'
import Dropzone from '../components/Dropzone'
import ResultPanel from '../components/ResultPanel'
import { usePagePreview } from '../components/PdfPreview'
import { Field, FileRow, Segmented, Spinner } from '../components/ui'
import {
  IconRemoveWatermark,
  IconArrowLeft,
  IconArrowRight,
  IconSparkles,
  IconCopy,
  IconCheck,
  IconAlertTriangle,
  IconCheckCircle,
  IconShieldCheck,
} from '../components/Icons'
import { baseName, downloadBlob, formatSize } from '../utils/files'
import {
  inspectPdfDocument,
  cleanPdfDocument,
  inspectText,
  cleanText,
  cleanImageMetadata,
} from '../utils/watermarkCleaner'

const TABS = [
  { value: 'pdf', label: 'PDF & Dokumen' },
  { value: 'text', label: 'Teks & AI Stego' },
  { value: 'image', label: 'Gambar (EXIF/C2PA)' },
]

const PRESETS = [
  { value: 'none', label: 'Hanya Metadata & AI' },
  { value: 'diagonal', label: 'Diagonal Tengah' },
  { value: 'center', label: 'Tengah Halaman' },
  { value: 'top', label: 'Header (Atas)' },
  { value: 'bottom', label: 'Footer (Bawah)' },
]

export default function RemoveWatermark() {
  const [activeTab, setActiveTab] = useState('pdf')

  // --- PDF Mode States ---
  const [pdfFile, setPdfFile] = useState(null)
  const [pageNo, setPageNo] = useState(1)
  const { numPages, preview } = usePagePreview(pdfFile, pageNo)
  const [stripMetadata, setStripMetadata] = useState(true)
  const [stripXmp, setStripXmp] = useState(true)
  const [stripAnnotations, setStripAnnotations] = useState(true)
  const [visualPreset, setVisualPreset] = useState('none')
  const [targetPages, setTargetPages] = useState('all')
  const [customRange, setCustomRange] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfInspection, setPdfInspection] = useState(null)
  const [pdfResult, setPdfResult] = useState(null)

  // --- Text Mode States ---
  const [inputText, setInputText] = useState('')
  const [normalizeSpaces, setNormalizeSpaces] = useState(true)
  const [stripPua, setStripPua] = useState(true)
  const [stripTags, setStripTags] = useState(true)
  const [textInspection, setTextInspection] = useState(null)
  const [cleanedOutput, setCleanedOutput] = useState('')
  const [copied, setCopied] = useState(false)

  // --- Image Mode States ---
  const [imageFile, setImageFile] = useState(null)
  const [imageBusy, setImageBusy] = useState(false)
  const [imageResult, setImageResult] = useState(null)

  // ─────────────────── PDF Handlers ───────────────────
  const handlePdfUpload = async files => {
    const f = files[0]
    setPdfFile(f)
    setPageNo(1)
    setPdfResult(null)
    setPdfInspection(null)

    try {
      const inspectRes = await inspectPdfDocument(f)
      setPdfInspection(inspectRes)
      if (inspectRes.isSuspicious) {
        toast.info(`Audit menemukan ${inspectRes.findings.length} indikator watermark/metadata.`)
      }
    } catch {
      // ignore
    }
  }

  const handleApplyPdfClean = async () => {
    if (!pdfFile) return
    setPdfBusy(true)

    try {
      const visualMask = visualPreset !== 'none'
        ? {
            enabled: true,
            preset: visualPreset,
            targetPages,
            pageRange: customRange,
          }
        : null

      const res = await cleanPdfDocument(pdfFile, {
        stripMetadata,
        stripXmp,
        stripPieceInfo: true,
        stripAnnotations,
        visualMask,
      })

      const outName = `${baseName(pdfFile.name)}_tanpa_watermark.pdf`
      setPdfResult({
        name: outName,
        blob: res.blob,
        actions: res.actions,
        originalSize: res.originalSize,
        cleanedSize: res.cleanedSize,
      })
      toast.success('PDF berhasil dibersihkan dari watermark & jejak AI!')
    } catch (err) {
      toast.error(`Gagal membersihkan PDF: ${err.message}`)
    } finally {
      setPdfBusy(false)
    }
  }

  // ─────────────────── Text Handlers ───────────────────
  const handleInspectText = () => {
    if (!inputText) {
      toast.error('Masukkan teks terlebih dahulu')
      return
    }
    const res = inspectText(inputText)
    setTextInspection(res)
    if (res.isSuspicious) {
      toast.warning(`Terdeteksi ${res.invisibleCount + res.tagCharsCount + res.puaCount} karakter steganografi AI / tersembunyi!`)
    } else {
      toast.success('Teks tampak bersih dari invisible steganography.')
    }
  }

  const handleCleanText = () => {
    if (!inputText) {
      toast.error('Masukkan teks terlebih dahulu')
      return
    }
    const res = cleanText(inputText, {
      normalizeSpaces,
      stripPua,
      stripTags,
    })
    setCleanedOutput(res.cleanedText)
    setTextInspection(inspectText(res.cleanedText))
    toast.success(`Berhasil membersihkan: ${res.stats.removedCount} karakter dihapus, ${res.stats.replacedCount} spasi dinormalisasi.`)
  }

  const handleCopyText = async () => {
    if (!cleanedOutput) return
    await navigator.clipboard.writeText(cleanedOutput)
    setCopied(true)
    toast.success('Teks bersih disalin ke clipboard!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownloadText = () => {
    if (!cleanedOutput) return
    const blob = new Blob([cleanedOutput], { type: 'text/plain;charset=utf-8' })
    downloadBlob(blob, 'teks_bersih.txt')
  }

  const handleSampleText = () => {
    // Inserts text containing Zero Width Space (U+200B), Soft Hyphen (U+00AD), and Non-Breaking Space
    const sample =
      'Laporan\u200B ini disusun\u00AD secara otomatis\u200C oleh asisten\u200D AI dengan\u00A0format tersembunyi\uFEFF.'
    setInputText(sample)
    setTextInspection(inspectText(sample))
    setCleanedOutput('')
    toast.info('Contoh teks dengan invisible AI marks dimasukkan.')
  }

  const handleTextFileUpload = async files => {
    const f = files[0]
    if (!f) return
    const text = await f.text()
    setInputText(text)
    setTextInspection(inspectText(text))
    setCleanedOutput('')
    toast.success(`File "${f.name}" berhasil dimuat.`)
  }

  // ─────────────────── Image Handlers ───────────────────
  const handleImageUpload = async files => {
    const f = files[0]
    if (!f) return
    setImageFile(f)
    setImageBusy(true)
    setImageResult(null)

    try {
      const res = await cleanImageMetadata(f)
      const outName = `${baseName(f.name)}_clean.${f.type === 'image/jpeg' ? 'jpg' : 'png'}`
      setImageResult({
        name: outName,
        blob: res.blob,
        actions: res.actions,
        originalSize: res.originalSize,
        cleanedSize: res.cleanedSize,
      })
      toast.success('Metadata gambar dan jejak C2PA berhasil dibersihkan!')
    } catch (err) {
      toast.error(`Gagal membersihkan gambar: ${err.message}`)
    } finally {
      setImageBusy(false)
    }
  }

  // Render Visual Overlay for preview
  const renderVisualOverlay = () => {
    if (!preview || visualPreset === 'none') return null
    let style = {}
    if (visualPreset === 'diagonal') {
      style = {
        top: '40%',
        left: '15%',
        width: '70%',
        height: '20%',
        background: 'rgba(255, 255, 255, 0.85)',
        border: '2px dashed var(--accent)',
      }
    } else if (visualPreset === 'center') {
      style = {
        top: '35%',
        left: '20%',
        width: '60%',
        height: '30%',
        background: 'rgba(255, 255, 255, 0.85)',
        border: '2px dashed var(--accent)',
      }
    } else if (visualPreset === 'top') {
      style = {
        top: '15px',
        left: '5%',
        width: '90%',
        height: '40px',
        background: 'rgba(255, 255, 255, 0.85)',
        border: '2px dashed var(--accent)',
      }
    } else if (visualPreset === 'bottom') {
      style = {
        bottom: '15px',
        left: '5%',
        width: '90%',
        height: '40px',
        background: 'rgba(255, 255, 255, 0.85)',
        border: '2px dashed var(--accent)',
      }
    }

    return (
      <div
        className="preview-mask-box"
        style={{
          position: 'absolute',
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          fontSize: '12px',
          fontWeight: 600,
          borderRadius: '4px',
          backdropFilter: 'blur(2px)',
          ...style,
        }}
      >
        Area Pembersihan Watermark
      </div>
    )
  }

  return (
    <ToolPage toolId="remove-watermark">
      {/* Tab Switcher */}
      <div style={{ marginBottom: '24px' }}>
        <Segmented
          name="tool-mode"
          value={activeTab}
          onChange={setActiveTab}
          options={TABS}
        />
      </div>

      {/* ──────────────── TAB 1: PDF ──────────────── */}
      {activeTab === 'pdf' && (
        <>
          {pdfResult ? (
            <ResultPanel
              title="PDF Berhasil Dibersihkan"
              summary={`Ukuran: ${formatSize(pdfResult.cleanedSize)} (sebelumnya ${formatSize(pdfResult.originalSize)})`}
              files={[pdfResult]}
              onReset={() => {
                setPdfFile(null)
                setPdfResult(null)
                setPdfInspection(null)
              }}
            >
              <div className="panel" style={{ marginTop: '16px', background: 'var(--surface-2)' }}>
                <h3 style={{ fontSize: '15px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconShieldCheck size={18} />
                  Tindakan yang Telah Diterapkan:
                </h3>
                <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '14px', color: 'var(--text-2)' }}>
                  {pdfResult.actions.map((act, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{act}</li>
                  ))}
                </ul>
              </div>
            </ResultPanel>
          ) : !pdfFile ? (
            <Dropzone
              onFiles={handlePdfUpload}
              title="Pilih file PDF untuk dibersihkan"
              hint="Dibersihkan 100% lokal di browser Anda (metadata, jejak AI, C2PA, watermark visual)"
            />
          ) : (
            <div className="tool-layout">
              {/* Left / Settings Column */}
              <div className="tool-controls">
                <ul className="file-list" style={{ marginBottom: '16px' }}>
                  <FileRow
                    file={pdfFile}
                    meta={`${numPages || '…'} halaman`}
                    onRemove={() => {
                      setPdfFile(null)
                      setPdfInspection(null)
                    }}
                  />
                </ul>

                {/* Audit Findings */}
                {pdfInspection && (
                  <div
                    className="panel"
                    style={{
                      marginBottom: '16px',
                      background: pdfInspection.isSuspicious ? 'var(--warn-soft)' : 'var(--ok-soft)',
                      borderColor: pdfInspection.isSuspicious ? 'var(--warn)' : 'var(--ok)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                      {pdfInspection.isSuspicious ? (
                        <IconAlertTriangle size={18} />
                      ) : (
                        <IconCheckCircle size={18} />
                      )}
                      <strong style={{ fontSize: '14px' }}>
                        {pdfInspection.isSuspicious
                          ? 'Audit: Ditemukan Jejak Watermark & Metadata'
                          : 'Audit: Dokumen Tampak Bersih'}
                      </strong>
                    </div>
                    {pdfInspection.findings.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--text-2)' }}>
                        {pdfInspection.findings.map((f, idx) => (
                          <li key={idx}>{f}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Cleaning Options */}
                <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h3 style={{ fontSize: '15px' }}>Opsi Pembersihan Jejak AI & Metadata</h3>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stripXmp}
                      onChange={e => setStripXmp(e.target.checked)}
                    />
                    <div>
                      <span style={{ fontWeight: 500 }}>Hapus Stream XMP Metadata & C2PA</span>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>
                        Menghapus manifest C2PA, jejak model AI generator, dan prompt tersembunyi.
                      </p>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stripMetadata}
                      onChange={e => setStripMetadata(e.target.checked)}
                    />
                    <div>
                      <span style={{ fontWeight: 500 }}>Bersihkan Info Dokumen (Author, Creator, ModDate)</span>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>
                        Mengosongkan nama pembuat, software produsen, dan tanggal riwayat.
                      </p>
                    </div>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={stripAnnotations}
                      onChange={e => setStripAnnotations(e.target.checked)}
                    />
                    <div>
                      <span style={{ fontWeight: 500 }}>Hapus Anotasi Watermark & Stempel</span>
                      <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-3)' }}>
                        Menghapus objek anotasi tipe /Watermark dan /Stamp dari dokumen.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Visual Watermark Removal / Masking */}
                <div className="panel" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <h3 style={{ fontSize: '15px' }}>Pembersihan Watermark Visual (Stempel)</h3>
                  <Field label="Posisi Stempel Watermark" hint="Tutup stempel visual dengan lapisan putih bersih">
                    <Segmented
                      name="visual-preset"
                      value={visualPreset}
                      onChange={setVisualPreset}
                      options={PRESETS}
                    />
                  </Field>

                  {visualPreset !== 'none' && (
                    <>
                      <Field label="Terapkan Pada Halaman:">
                        <Segmented
                          name="target-pages"
                          value={targetPages}
                          onChange={setTargetPages}
                          options={[
                            { value: 'all', label: 'Semua Halaman' },
                            { value: 'custom', label: 'Halaman Pilihan' },
                          ]}
                        />
                      </Field>

                      {targetPages === 'custom' && (
                        <Field label="Rentang Halaman" hint="Contoh: 1, 2-5, 8">
                          <input
                            type="text"
                            className="input"
                            placeholder="1, 2-5"
                            value={customRange}
                            onChange={e => setCustomRange(e.target.value)}
                          />
                        </Field>
                      )}
                    </>
                  )}
                </div>

                <div className="action-bar" style={{ marginTop: '20px' }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={handleApplyPdfClean}
                    disabled={pdfBusy}
                    style={{ width: '100%' }}
                  >
                    {pdfBusy ? <Spinner /> : <IconRemoveWatermark size={18} />}
                    Bersihkan PDF Sekarang
                  </button>
                </div>
              </div>

              {/* Right / Preview Column */}
              <div className="tool-preview">
                <div className="preview-panel" style={{ position: 'relative' }}>
                  <div className="preview-nav">
                    <button
                      type="button"
                      className="btn-icon"
                      disabled={pageNo <= 1}
                      onClick={() => setPageNo(p => Math.max(1, p - 1))}
                    >
                      <IconArrowLeft size={16} />
                    </button>
                    <span>
                      Halaman {pageNo} dari {numPages || 1}
                    </span>
                    <button
                      type="button"
                      className="btn-icon"
                      disabled={!numPages || pageNo >= numPages}
                      onClick={() => setPageNo(p => Math.min(numPages, p + 1))}
                    >
                      <IconArrowRight size={16} />
                    </button>
                  </div>

                  <div
                    className="preview-canvas-wrapper"
                    style={{
                      position: 'relative',
                      display: 'inline-block',
                      margin: '0 auto',
                      boxShadow: 'var(--shadow)',
                      background: '#fff',
                    }}
                  >
                    {preview ? (
                      <img
                        src={preview.url}
                        alt={`Halaman ${pageNo}`}
                        style={{ display: 'block', maxWidth: '100%', height: 'auto' }}
                      />
                    ) : (
                      <div className="page-skeleton" style={{ width: '380px', height: '520px' }} />
                    )}
                    {renderVisualOverlay()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ──────────────── TAB 2: TEXT & AI STEGO ──────────────── */}
      {activeTab === 'text' && (
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          <div className="panel" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>Pembersih Steganografi AI & Invisible Unicode</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                  Menghapus Zero-Width Space (U+200B), Soft Hyphen, Tag Characters, BiDi Overrides, dan menormalkan spasi homoglyph.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleSampleText}
              >
                <IconSparkles size={14} />
                Uji Contoh Teks AI
              </button>
            </div>

            <Field label="Input Teks Anda:" hint="Tempel teks artikel/esai atau unggah file .txt / .md">
              <textarea
                className="input"
                rows={8}
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                placeholder="Tempel teks di sini..."
                value={inputText}
                onChange={e => {
                  setInputText(e.target.value)
                  setTextInspection(null)
                  setCleanedOutput('')
                }}
              />
            </Field>

            <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '13px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={normalizeSpaces}
                    onChange={e => setNormalizeSpaces(e.target.checked)}
                  />
                  Normalisasi Spasi Homoglyph (NBSP, Ogham, thin space)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={stripTags}
                    onChange={e => setStripTags(e.target.checked)}
                  />
                  Hapus AI Tag Stego (U+E0000)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={stripPua}
                    onChange={e => setStripPua(e.target.checked)}
                  />
                  Hapus Private Use Area (PUA)
                </label>
              </div>

              <div style={{ marginTop: '8px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Dropzone
                  compact
                  accept={{ 'text/plain': ['.txt', '.md', '.markdown'] }}
                  onFiles={handleTextFileUpload}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleInspectText}
                  disabled={!inputText}
                >
                  Periksa Karakter Tersembunyi
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleCleanText}
                  disabled={!inputText}
                >
                  <IconRemoveWatermark size={16} />
                  Bersihkan Teks
                </button>
              </div>
            </div>
          </div>

          {/* Inspection Results Box */}
          {textInspection && (
            <div
              className="panel"
              style={{
                marginBottom: '20px',
                background: textInspection.isSuspicious ? 'var(--warn-soft)' : 'var(--ok-soft)',
                borderColor: textInspection.isSuspicious ? 'var(--warn)' : 'var(--ok)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                {textInspection.isSuspicious ? <IconAlertTriangle size={20} /> : <IconCheckCircle size={20} />}
                <strong style={{ fontSize: '15px' }}>
                  {textInspection.isSuspicious
                    ? `Peringatan: Ditemukan ${textInspection.findings.length} Karakter Steganografi AI!`
                    : 'Teks Bersih: Tidak ditemukan invisible watermark.'}
                </strong>
              </div>

              {textInspection.isSuspicious && (
                <div style={{ fontSize: '13px', marginTop: '10px' }}>
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
                    <span>Invisible / Zero-Width: <strong>{textInspection.invisibleCount}</strong></span>
                    <span>Tag Characters: <strong>{textInspection.tagCharsCount}</strong></span>
                    <span>Homoglyph Spaces: <strong>{textInspection.homoglyphSpaceCount}</strong></span>
                  </div>

                  <div style={{ maxHeight: '160px', overflowY: 'auto', background: 'var(--surface)', borderRadius: '6px', padding: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <th style={{ padding: '4px' }}>Kode</th>
                          <th style={{ padding: '4px' }}>Nama Karakter</th>
                          <th style={{ padding: '4px' }}>Posisi (Baris:Kolom)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {textInspection.findings.map((f, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '4px', fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>{f.code}</td>
                            <td style={{ padding: '4px' }}>{f.name}</td>
                            <td style={{ padding: '4px' }}>Baris {f.line}, Kol {f.col}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Cleaned Output Box */}
          {cleanedOutput && (
            <div className="panel" style={{ background: 'var(--surface)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ fontSize: '14px', margin: 0, fontWeight: 600 }}>Hasil Teks Bersih:</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={handleCopyText}>
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    {copied ? 'Tersalin' : 'Salin Teks'}
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadText}>
                    Unduh .txt
                  </button>
                </div>
              </div>
              <textarea
                className="input"
                rows={8}
                readOnly
                value={cleanedOutput}
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '13px', background: 'var(--surface-2)' }}
              />
            </div>
          )}
        </div>
      )}

      {/* ──────────────── TAB 3: IMAGES ──────────────── */}
      {activeTab === 'image' && (
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          {imageResult ? (
            <ResultPanel
              title="Metadata Gambar Bersih"
              summary={`Ukuran: ${formatSize(imageResult.cleanedSize)} (sebelumnya ${formatSize(imageResult.originalSize)})`}
              files={[imageResult]}
              onReset={() => {
                setImageFile(null)
                setImageResult(null)
              }}
            >
              <div className="panel" style={{ marginTop: '16px', background: 'var(--surface-2)' }}>
                <h3 style={{ fontSize: '15px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <IconShieldCheck size={18} />
                  Pembersihan Selesai:
                </h3>
                <ul style={{ paddingLeft: '20px', margin: 0, fontSize: '14px', color: 'var(--text-2)' }}>
                  {imageResult.actions.map((act, i) => (
                    <li key={i} style={{ marginBottom: '4px' }}>{act}</li>
                  ))}
                </ul>
              </div>
            </ResultPanel>
          ) : imageBusy && imageFile ? (
            <div className="panel" style={{ textAlign: 'center', padding: '32px' }}>
              <Spinner />
              <p style={{ marginTop: '12px', fontWeight: 500 }}>Membersihkan metadata "{imageFile.name}"…</p>
            </div>
          ) : (
            <Dropzone
              accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] }}
              onFiles={handleImageUpload}
              busy={imageBusy}
              title="Pilih gambar untuk dibersihkan"
              hint="Menghapus EXIF, XMP, jejak C2PA, GPS, dan metadata AI generator secara otomatis"
            />
          )}
        </div>
      )}
    </ToolPage>
  )
}
