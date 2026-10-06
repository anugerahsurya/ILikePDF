import { Link } from 'react-router-dom'
import PdfProLogo from './PdfProLogo'
import { IconShieldCheck } from './Icons'

export default function Header() {
  return (
    <header className="site-header">
      <div className="shell site-header-inner">
        <Link to="/" className="brand">
          <PdfProLogo size={26} />
          <span>PDF Pro</span>
        </Link>
        <p className="header-note">
          <IconShieldCheck size={15} />
          <span>File diproses di browser Anda, tidak diunggah ke mana pun</span>
        </p>
      </div>
    </header>
  )
}
