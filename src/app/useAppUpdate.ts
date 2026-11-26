import { useCallback, useEffect, useRef, useState } from 'react'

type Status = 'unavailable' | 'checking' | 'current' | 'available' | 'activating' | 'activated' | 'error'

export function useAppUpdate() {
  const [status, setStatus] = useState<Status>('unavailable')
  const [message, setMessage] = useState('')
  const registration = useRef<ServiceWorkerRegistration | null>(null)
  const activated = useRef(false)
  const busy = useRef(false)
  const mounted = useRef(false)
  const cancelAttempt = useRef<(() => void) | null>(null)

  const check = useCallback(async () => {
    const worker = registration.current
    if (!worker || busy.current) return
    if (activated.current) { setStatus('activated'); return }
    if (worker.waiting && navigator.serviceWorker.controller) { setStatus('available'); return }
    setStatus('checking')
    try {
      await worker.update()
      if (!mounted.current || busy.current) return
      setStatus(activated.current ? 'activated' : worker.waiting && navigator.serviceWorker.controller ? 'available' : worker.installing ? 'checking' : 'current')
    } catch { if (mounted.current && !busy.current) setStatus(activated.current ? 'activated' : 'error') }
  }, [])

  useEffect(() => {
    if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
    mounted.current = true
    let active = true
    let cleanup = () => {}
    let controller = navigator.serviceWorker.controller
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' }).then(worker => {
      if (!active) return
      registration.current = worker
      const listeners = new Map<ServiceWorker, () => void>()
      const waiting = () => {
        if (busy.current) return
        if (activated.current) setStatus('activated')
        else if (worker.waiting && navigator.serviceWorker.controller) setStatus('available')
        else if (worker.installing) setStatus('checking')
        else setStatus('current')
      }
      const onUpdate = () => {
        const installing = worker.installing
        if (!installing || listeners.has(installing)) return
        if (!busy.current) setStatus('checking')
        const onState = () => {
          if (installing.state === 'redundant' && !worker.waiting && !busy.current && !activated.current) setStatus('error')
          else waiting()
          if (installing.state === 'installed' || installing.state === 'redundant') { installing.removeEventListener('statechange', onState); listeners.delete(installing) }
        }
        listeners.set(installing, onState)
        installing.addEventListener('statechange', onState)
      }
      const onController = () => {
        const next = navigator.serviceWorker.controller
        if (controller && next && controller !== next) { activated.current = true; if (!busy.current) setStatus('activated') }
        controller = next
      }
      const foreground = () => { if (document.visibilityState === 'visible') void check() }
      worker.addEventListener('updatefound', onUpdate)
      navigator.serviceWorker.addEventListener('controllerchange', onController)
      document.addEventListener('visibilitychange', foreground)
      // Registration can resolve after a controller change.
      onController()
      cleanup = () => { worker.removeEventListener('updatefound', onUpdate); navigator.serviceWorker.removeEventListener('controllerchange', onController); document.removeEventListener('visibilitychange', foreground); for (const [installing, listener] of listeners) installing.removeEventListener('statechange', listener) }
      if (worker.installing) onUpdate()
      waiting()
      void check()
    }).catch(() => { if (active) setStatus('error') })
    return () => { active = false; mounted.current = false; cancelAttempt.current?.(); cleanup(); registration.current = null }
  }, [check])

  const activate = useCallback(async (guard: () => boolean) => {
    if (busy.current || !guard()) return
    busy.current = true
    setMessage('')
    setStatus('activating')
    try {
      if (!activated.current) {
        const oldController = navigator.serviceWorker.controller
        const worker = registration.current?.waiting
        if (!oldController || !worker) throw new Error('missing worker')
        await new Promise<void>((resolve, reject) => {
          let timer: ReturnType<typeof setTimeout>
          const finish = (success: boolean) => {
            clearTimeout(timer)
            navigator.serviceWorker.removeEventListener('controllerchange', changed)
            worker.removeEventListener('statechange', stateChanged)
            cancelAttempt.current = null
            if (success) resolve(); else reject(new Error('activation failed'))
          }
          const changed = () => { if (navigator.serviceWorker.controller && navigator.serviceWorker.controller !== oldController) finish(true) }
          const stateChanged = () => { if (worker.state === 'redundant') finish(false) }
          navigator.serviceWorker.addEventListener('controllerchange', changed)
          worker.addEventListener('statechange', stateChanged)
          timer = setTimeout(() => finish(false), 15000)
          cancelAttempt.current = () => finish(false)
          if (navigator.serviceWorker.controller !== oldController) changed()
          else if (worker.state === 'redundant') finish(false)
          else {
            try { worker.postMessage({ type: 'SKIP_WAITING' }) }
            catch { finish(false) }
          }
        })
        activated.current = true
      }
      if (mounted.current && guard()) window.location.reload()
      else if (mounted.current) setStatus('activated')
    } catch {
      if (mounted.current) {
        // A different tab may have activated the worker while this attempt failed.
        setStatus(activated.current ? 'activated' : 'available')
        setMessage('Could not activate the update. Your page has not reloaded; try again when ready.')
      }
    } finally { busy.current = false }
  }, [])
  return { status, message, check, activate }
}
