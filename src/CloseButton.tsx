import { X } from 'lucide-react'

export function CloseButton({ onClick }: { onClick: () => void }) {
  return <button type="button" className="icon-close" aria-label="Close" onClick={onClick}><X size={19} aria-hidden="true"/></button>
}
