import { WarningCircle } from '@phosphor-icons/react'

export default function Aviso({ error, children }) {
  if (!error && !children) return null
  return (
    <div className="aviso aviso--error" role="alert">
      <WarningCircle size={18} weight="bold" aria-hidden="true" />
      <div>{children || error.message}</div>
    </div>
  )
}
