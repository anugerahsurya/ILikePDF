import { useDropzone } from 'react-dropzone'
import { toast } from 'sonner'
import { IconUpload, IconPlus } from './Icons'

const PDF = { 'application/pdf': ['.pdf'] }

export default function Dropzone({
  onFiles,
  accept = PDF,
  multiple = false,
  title,
  hint,
  compact = false,
  busy = false,
}) {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: accepted => accepted.length && onFiles(accepted),
    onDropRejected: rejected => {
      const names = rejected.map(r => r.file.name).join(', ')
      toast.error(`Format file tidak didukung: ${names}`)
    },
    accept,
    multiple,
    disabled: busy,
  })

  const isPdf = accept === PDF
  const defaultTitle = `Pilih file ${isPdf ? 'PDF' : 'gambar'} atau seret ke sini`

  if (compact) {
    return (
      <div {...getRootProps({ className: 'dropzone-compact', 'data-active': isDragActive || undefined })}>
        <input {...getInputProps()} />
        {busy ? <span className="spinner" /> : <IconPlus size={16} />}
        <span>{busy ? 'Membaca file…' : isDragActive ? 'Lepaskan untuk menambah' : 'Tambah file'}</span>
      </div>
    )
  }

  return (
    <div {...getRootProps({ className: 'dropzone', 'data-active': isDragActive || undefined })}>
      <input {...getInputProps()} />
      <div className="dropzone-icon">
        {busy ? <span className="spinner spinner-lg" /> : <IconUpload size={22} />}
      </div>
      <p className="dropzone-title">
        {busy ? 'Membaca file…' : isDragActive ? 'Lepaskan file di sini' : title || defaultTitle}
      </p>
      <p className="dropzone-hint">
        {hint || (multiple ? 'Bisa memilih beberapa file sekaligus' : 'Satu file')}
      </p>
      <span className="btn btn-primary dropzone-btn">Pilih file</span>
    </div>
  )
}
