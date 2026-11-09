import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'unavailable' | 'checking' | 'current' | 'available' | 'activated' | 'error'

export function useAppUpdate() {
  const [status, setStatus] = useState<Status>('unavailable')
  const registration = useRef<ServiceWorkerRegistration | null>(null)
  const activated = useRef(false)
  const check = useCallback(async () => {
    const worker = registration.current
    if (!worker) return
    if (activated.current) { setStatus('activated'); return }
    if (worker.waiting && navigator.serviceWorker.controller) { setStatus('available'); return }
    setStatus('checking')
    try {
      await worker.update()
      setStatus(activated.current ? 'activated' : worker.waiting && navigator.serviceWorker.controller ? 'available' : worker.installing ? 'checking' : 'current')
    } catch { setStatus('error') }
  }, [])
  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    let active = true
    let cleanup = () => {}
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' }).then(worker => {
      if (!active) return
      registration.current = worker
      const waiting = () => {
        if (activated.current) setStatus('activated')
        else if (worker.waiting && navigator.serviceWorker.controller) setStatus('available')
        else if (worker.installing) setStatus('checking')
        else setStatus('current')
      }
      const onUpdate = () => {
        const installing = worker.installing
        if (!installing) return
        setStatus('checking')
        installing.addEventListener('statechange', () => {
          if (installing.state === 'redundant' && !worker.waiting) setStatus('error')
          else waiting()
        })
      }
      const onController = () => { activated.current = true; setStatus('activated') }
      const foreground = () => { if (document.visibilityState === 'visible') void check() }
      worker.addEventListener('updatefound', onUpdate)
      navigator.serviceWorker.addEventListener('controllerchange', onController)
      document.addEventListener('visibilitychange', foreground)
      cleanup = () => { worker.removeEventListener('updatefound', onUpdate); navigator.serviceWorker.removeEventListener('controllerchange', onController); document.removeEventListener('visibilitychange', foreground) }
      if (worker.installing) onUpdate()
      waiting()
      void check()
    }).catch(() => { if (active) setStatus('error') })
    return () => { active = false; cleanup() }
  }, [check])
  const activate = () => {
    if (activated.current) { window.location.reload(); return }
    registration.current?.waiting?.postMessage({ type: 'SKIP_WAITING' })
  }
  return { status, check, activate }
}
