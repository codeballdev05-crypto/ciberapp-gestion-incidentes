import { Link } from 'react-router-dom'

// Marca: tres fichas en su ranura. SVG geométrico, sin ilustración.
export default function Marca({ a = '/' }) {
  return (
    <Link to={a} className="marca" aria-label="CiberApp, inicio">
      <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="6" fill="#1A1E26" />
        <rect x="5" y="9" width="5" height="14" rx="1" fill="#B93D0B" />
        <rect x="12" y="9" width="15" height="6" rx="1" fill="#FAFAF7" />
        <rect x="12" y="17" width="10" height="6" rx="1" fill="#FAFAF7" opacity=".55" />
      </svg>
      <span>CiberApp</span>
    </Link>
  )
}
