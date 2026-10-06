import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { GROUPS, TOOLS } from '../tools'
import { IconSearch, IconClose } from '../components/Icons'

export default function Home() {
  const [query, setQuery] = useState('')
  const inputRef = useRef(null)

  // "/" jumps to search, like most web apps.
  useEffect(() => {
    const onKey = e => {
      const tag = e.target.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const q = query.trim().toLowerCase()
  const matches = TOOLS.filter(t => !q || `${t.title} ${t.desc} ${t.keywords}`.toLowerCase().includes(q))

  return (
    <div className="home page-enter">
      <section className="home-intro">
        <h1>Alat PDF untuk pekerjaan sehari-hari</h1>
        <p>Gabung, pisah, kompres, tanda tangan, dan lainnya. Semua dikerjakan di browser ini, jadi dokumen Anda tidak pernah meninggalkan komputer.</p>
        <div className="search">
          <IconSearch size={17} className="search-icon" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Cari alat, misalnya kompres atau tanda tangan"
            aria-label="Cari alat"
          />
          {query ? (
            <button type="button" className="search-clear" onClick={() => setQuery('')} aria-label="Hapus pencarian">
              <IconClose size={15} />
            </button>
          ) : (
            <kbd className="search-kbd">/</kbd>
          )}
        </div>
      </section>

      {GROUPS.map(group => {
        const tools = matches.filter(t => t.group === group.id)
        if (!tools.length) return null
        return (
          <section key={group.id} className="tool-group">
            <h2 className="tool-group-title">{group.title}</h2>
            <ul className="tool-grid">
              {tools.map(tool => {
                const Icon = tool.icon
                return (
                  <li key={tool.id}>
                    <Link to={tool.path} className="tool-card">
                      <span className="tool-card-icon">
                        <Icon size={20} />
                      </span>
                      <span className="tool-card-title">{tool.title}</span>
                      <span className="tool-card-desc">{tool.desc}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {matches.length === 0 && (
        <div className="empty">
          <p>Tidak ada alat yang cocok dengan “{query}”.</p>
          <button type="button" className="btn btn-secondary" onClick={() => setQuery('')}>
            Tampilkan semua alat
          </button>
        </div>
      )}
    </div>
  )
}
