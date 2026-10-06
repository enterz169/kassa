import type { BgKind, HomeBlock, ThemeSettings } from '../types'

export const ACCENTS: { id: string; label: string; colors: [string, string, string] }[] = [
  { id: 'sunset', label: 'Закат', colors: ['#ff7a1a', '#ff3d7f', '#a53df0'] },
  { id: 'ocean', label: 'Океан', colors: ['#22d3ee', '#3b82f6', '#6366f1'] },
  { id: 'forest', label: 'Лес', colors: ['#a3e635', '#22c55e', '#14b8a6'] },
  { id: 'rose', label: 'Роза', colors: ['#fb7185', '#ec4899', '#d946ef'] },
  { id: 'gold', label: 'Золото', colors: ['#fbbf24', '#f97316', '#ef4444'] },
  { id: 'violet', label: 'Фиалка', colors: ['#818cf8', '#a855f7', '#ec4899'] },
]

export const BACKGROUNDS: Record<BgKind, { label: string; bg: string; s1: string; s2: string; s3: string }> = {
  dark: { label: 'Тёмный', bg: '#09090b', s1: '#111114', s2: '#17171b', s3: '#202026' },
  graphite: { label: 'Графит', bg: '#121316', s1: '#1a1c20', s2: '#212429', s3: '#2a2e34' },
  amoled: { label: 'Чёрный', bg: '#000000', s1: '#08080a', s2: '#0f0f12', s3: '#17171b' },
  navy: { label: 'Ночь', bg: '#070b16', s1: '#0d1324', s2: '#131b31', s3: '#1b2540' },
}

export const BLOCKS: Record<HomeBlock, string> = {
  hero: 'Остаток денег',
  reminders: 'Напоминания о платежах',
  stats: 'Плитки с цифрами',
  insights: 'Выводы',
  chart: 'График по дням',
  lists: 'Смены, расходы, платежи',
}

export const DEFAULT_THEME: ThemeSettings = {
  accent: 'sunset', colors: ACCENTS[0].colors, bg: 'dark', radius: 'normal', scale: 'md', glow: true,
  order: ['hero', 'reminders', 'stats', 'insights', 'chart', 'lists'], hidden: [],
}

/** Подтягивает недостающие поля (старые настройки, чужие резервные копии). */
export function normalizeTheme(t?: Partial<ThemeSettings>): ThemeSettings {
  const d = DEFAULT_THEME
  const all = d.order
  const order = [...(t?.order ?? []).filter((b) => all.includes(b)), ...all.filter((b) => !(t?.order ?? []).includes(b))]
  return {
    accent: t?.accent ?? d.accent,
    colors: t?.colors && t.colors.length === 3 ? t.colors : d.colors,
    bg: t?.bg && BACKGROUNDS[t.bg] ? t.bg : d.bg,
    radius: t?.radius ?? d.radius, scale: t?.scale ?? d.scale, glow: t?.glow ?? d.glow,
    order, hidden: (t?.hidden ?? []).filter((b) => all.includes(b)),
  }
}

const RADIUS = { sharp: 0.45, normal: 1, round: 1.35 }
const SCALE = { sm: '92%', md: '100%', lg: '110%' }
const KEY = 'kassa-theme'

export function applyTheme(raw?: Partial<ThemeSettings>): void {
  const t = normalizeTheme(raw)
  const r = document.documentElement
  const [c1, c2, c3] = t.colors
  const bg = BACKGROUNDS[t.bg]
  const set = (k: string, v: string) => r.style.setProperty(k, v)
  set('--color-orange', c1); set('--color-pink', c2); set('--color-purple', c3)
  set('--brand', `linear-gradient(135deg, ${c1} 0%, ${c2} 55%, ${c3} 100%)`)
  set('--color-bg', bg.bg); set('--color-surface', bg.s1); set('--color-surface-2', bg.s2); set('--color-surface-3', bg.s3)
  const k = RADIUS[t.radius]
  for (const [n, v] of [['lg', 0.5], ['xl', 0.75], ['2xl', 1], ['3xl', 1.5], ['4xl', 2]] as const) set(`--radius-${n}`, `${(v * k).toFixed(3)}rem`)
  r.style.fontSize = SCALE[t.scale]
  r.dataset.glow = t.glow ? 'on' : 'off'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg.bg)
  try { localStorage.setItem(KEY, JSON.stringify(t)) } catch { /* хранилище может быть недоступно */ }
}

/** Применить сохранённую тему сразу при старте — до загрузки базы, чтобы не мигало. */
export function applyCachedTheme(): void {
  try { const v = localStorage.getItem(KEY); if (v) applyTheme(JSON.parse(v)) } catch { /* ignore */ }
}
