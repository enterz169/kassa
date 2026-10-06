/**
 * ЛОКАЛЬНЫЕ уведомления: работают только пока приложение открыто в браузере.
 * Это НЕ фоновые push — для них нужен сервер (см. раздел «Настройки» → «Фоновые push»).
 */
export interface Support {
  notifications: boolean
  permission: NotificationPermission | 'unsupported'
  serviceWorker: boolean
  pushManager: boolean
  secure: boolean
}

export function detectSupport(): Support {
  const notifications = typeof window !== 'undefined' && 'Notification' in window
  return {
    notifications,
    permission: notifications ? Notification.permission : 'unsupported',
    serviceWorker: typeof navigator !== 'undefined' && 'serviceWorker' in navigator,
    pushManager: typeof window !== 'undefined' && 'PushManager' in window,
    secure: typeof window !== 'undefined' && window.isSecureContext,
  }
}

export async function askPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!('Notification' in window)) return 'unsupported'
  try { return await Notification.requestPermission() } catch { return Notification.permission }
}

export function showLocal(title: string, body: string, tag: string): boolean {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false
    new Notification(title, { body, tag })
    return true
  } catch { return false }
}

const memory = new Set<string>()
const STORE = 'kassa-fired'

function wasFired(key: string): boolean {
  if (memory.has(key)) return true
  try { return (localStorage.getItem(STORE) ?? '').split('|').includes(key) } catch { return false }
}
function markFired(key: string) {
  memory.add(key)
  try {
    const list = (localStorage.getItem(STORE) ?? '').split('|').filter(Boolean)
    localStorage.setItem(STORE, [...list, key].slice(-200).join('|'))
  } catch { /* хранилище недоступно — достаточно памяти */ }
}

export const dayKey = (k: string, day: string) => `${day}:${k}`

/** Показывает всплывающее уведомление не чаще одного раза в день для каждого платежа. Возвращает число показанных. */
export function fireDue(items: { key: string; title: string; text: string; fireToday: boolean }[], day: string): number {
  let n = 0
  for (const it of items) {
    if (!it.fireToday) continue
    const k = dayKey(it.key, day)
    if (wasFired(k)) continue
    if (showLocal(it.title, it.text, it.key)) { markFired(k); n++ }
  }
  return n
}
