import { formatSize } from '../utils/files'
import { IconArrowUp, IconArrowDown, IconClose } from './Icons'

export function Segmented({ name, value, onChange, options, disabled }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map(opt => (
        <label key={String(opt.value)} className="segmented-item" data-checked={value === opt.value || undefined}>
          <input
            type="radio"
            name={name}
            checked={value === opt.value}
            onChange={() => onChange(opt.value)}
            disabled={disabled}
          />
          <span className="segmented-label">{opt.label}</span>
          {opt.hint && <span className="segmented-hint">{opt.hint}</span>}
        </label>
      ))}
    </div>
  )
}

export function Field({ label, hint, children, htmlFor }) {
  return (
    <div className="field">
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  )
}

export function Progress({ value, label }) {
  return (
    <div className="progress">
      <div className="progress-meta">
        <span>{label}</span>
        <span className="mono">{Math.round(value)}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ transform: `scaleX(${Math.max(0, Math.min(1, value / 100))})` }} />
      </div>
    </div>
  )
}

export function FileTag({ children = 'PDF' }) {
  return <span className="file-tag">{children}</span>
}

export function FileRow({ index, file, meta, tag, thumb, onUp, onDown, onRemove, disabled, children }) {
  return (
    <li className="file-row">
      {index != null && <span className="file-index mono">{index + 1}</span>}
      {thumb ? <img className="file-thumb-img" src={thumb} alt="" /> : <FileTag>{tag}</FileTag>}
      <div className="file-row-main">
        <span className="file-name" title={file.name}>
          {file.name}
        </span>
        <span className="file-meta">
          {formatSize(file.size)}
          {meta ? ` · ${meta}` : ''}
        </span>
      </div>
      {children}
      <div className="file-row-actions">
        {onUp && (
          <button type="button" className="btn-icon" onClick={onUp} disabled={disabled === true || disabled === 'up'} aria-label="Pindah ke atas">
            <IconArrowUp size={15} />
          </button>
        )}
        {onDown && (
          <button type="button" className="btn-icon" onClick={onDown} disabled={disabled === true || disabled === 'down'} aria-label="Pindah ke bawah">
            <IconArrowDown size={15} />
          </button>
        )}
        {onRemove && (
          <button type="button" className="btn-icon btn-icon-danger" onClick={onRemove} disabled={disabled === true} aria-label="Hapus dari daftar">
            <IconClose size={15} />
          </button>
        )}
      </div>
    </li>
  )
}

export function Spinner() {
  return <span className="spinner" aria-hidden="true" />
}
