import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { toolById } from '../tools'
import { IconArrowLeft } from './Icons'

export default function ToolPage({ toolId, children }) {
  const tool = toolById(toolId)
  const Icon = tool.icon

  useEffect(() => {
    document.title = `${tool.title} · PDF Pro`
    return () => {
      document.title = 'PDF Pro'
    }
  }, [tool.title])

  return (
    <div className="tool-page page-enter">
      <Link to="/" className="back-link">
        <IconArrowLeft size={15} />
        Semua alat
      </Link>
      <header className="tool-head">
        <span className="tool-head-icon">
          <Icon size={22} />
        </span>
        <div>
          <h1>{tool.title}</h1>
          <p>{tool.desc}</p>
        </div>
      </header>
      {children}
    </div>
  )
}
