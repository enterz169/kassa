import { ArrowDown, ArrowUp, BellRing, DatabaseBackup, ShieldCheck, Download, Info, Palette, RotateCcw, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PageHeader } from '../components/Common'
import { Button } from '../components/ui/Button'
import { Card, SectionTitle } from '../components/ui/Card'
import { Field, Input, MoneyInput, Segmented, Switch } from '../components/ui/Fields'
import { Notice } from '../components/ui/Feedback'
import { clearAllData, importBackup, isUserDataEmpty } from '../db/backup'
import { saveBackupFile } from '../lib/export/backupFile'
import { requestPersistence, storageInfo, forgetCounts, type StorageInfo } from '../lib/storage'
import { loadDemoData } from '../db/demo'
import { ensureAllSchedules } from '../db/loans'
import { updateSettings } from '../db/settings'
import { PAY_MODES } from '../lib/constants'
import { fmtDate } from '../lib/dates'
import { askPermission, detectSupport, showLocal, type Support } from '../lib/notifications/local'
import { parseMoney } from '../lib/money'
import { useApp } from '../store/context'
import { errText, useUI } from '../store/ui'
import { ACCENTS, applyTheme, BACKGROUNDS, BLOCKS, DEFAULT_THEME, normalizeTheme } from '../lib/theme'
import type { BgKind, HomeBlock, PayMode, Settings, ThemeSettings } from '../types'

export function SettingsPage() {
  const { settings } = useApp()
  return settings ? <Form key={settings.createdAt} s={settings} /> : null
}

function Appearance({ saved }: { saved?: ThemeSettings }) {
  const [t, setT] = useState<ThemeSettings>(() => normalizeTheme(saved))
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const change = (patch: Partial<ThemeSettings>) => {
    const next = { ...t, ...patch }
    setT(next); applyTheme(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => { void updateSettings({ theme: next }) }, 250)
  }
  const move = (b: HomeBlock, d: -1 | 1) => {
    const o = [...t.order]; const i = o.indexOf(b); const j = i + d
    if (j < 0 || j >= o.length) return
    ;[o[i], o[j]] = [o[j], o[i]]
    change({ order: o })
  }
  const toggle = (b: HomeBlock, on: boolean) => change({ hidden: on ? t.hidden.filter((x) => x !== b) : [...t.hidden, b] })
  const custom = t.accent === 'custom'
  return (
    <Card className="space-y-5">
      <SectionTitle><span className="inline-flex items-center gap-2"><Palette className="size-4 text-pink" />Оформление</span></SectionTitle>
      <div>
        <span className="mb-2 block text-[13px] font-medium text-muted">Цветовая схема</span>
        <div className="flex flex-wrap gap-3">
          {ACCENTS.map((a) => (
            <button key={a.id} type="button" onClick={() => change({ accent: a.id, colors: a.colors })} aria-pressed={t.accent === a.id} aria-label={a.label} className="flex flex-col items-center gap-1.5">
              <span className="size-11 rounded-full" style={{ background: `linear-gradient(135deg, ${a.colors[0]}, ${a.colors[1]} 55%, ${a.colors[2]})`, boxShadow: t.accent === a.id ? '0 0 0 2px var(--color-surface), 0 0 0 4px rgb(255 255 255 / 0.85)' : undefined }} />
              <span className="text-[11px] text-muted">{a.label}</span>
            </button>
          ))}
          <button type="button" onClick={() => change({ accent: 'custom' })} aria-pressed={custom} aria-label="Свои цвета" className="flex flex-col items-center gap-1.5">
            <span className="flex size-11 items-center justify-center rounded-full border border-dashed border-line-strong text-lg text-muted" style={custom ? { boxShadow: '0 0 0 2px var(--color-surface), 0 0 0 4px rgb(255 255 255 / 0.85)', background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[1]} 55%, ${t.colors[2]})`, color: '#fff' } : undefined}>+</span>
            <span className="text-[11px] text-muted">Свои</span>
          </button>
        </div>
        {custom && (
          <div className="mt-3 grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <label key={i} className="flex flex-col gap-1.5 text-xs text-muted">Цвет {i + 1}
                <input type="color" value={t.colors[i]} onChange={(e) => { const c = [...t.colors] as ThemeSettings['colors']; c[i] = e.target.value; change({ colors: c }) }} className="h-11 w-full cursor-pointer rounded-xl border border-line bg-surface-2 p-1" />
              </label>
            ))}
          </div>
        )}
      </div>
      <div>
        <span className="mb-2 block text-[13px] font-medium text-muted">Фон</span>
        <Segmented value={t.bg} onChange={(v: BgKind) => change({ bg: v })} options={(Object.keys(BACKGROUNDS) as BgKind[]).map((k) => ({ value: k, label: BACKGROUNDS[k].label }))} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div><span className="mb-2 block text-[13px] font-medium text-muted">Скругление</span><Segmented value={t.radius} onChange={(v) => change({ radius: v })} options={[{ value: 'sharp', label: 'Строгое' }, { value: 'normal', label: 'Обычное' }, { value: 'round', label: 'Мягкое' }]} /></div>
        <div><span className="mb-2 block text-[13px] font-medium text-muted">Размер текста</span><Segmented value={t.scale} onChange={(v) => change({ scale: v })} options={[{ value: 'sm', label: 'Мелкий' }, { value: 'md', label: 'Обычный' }, { value: 'lg', label: 'Крупный' }]} /></div>
      </div>
      <div className="rounded-2xl border border-line bg-surface-2 px-4 py-1"><Switch checked={t.glow} onChange={(v) => change({ glow: v })} label="Свечение и подсветка" hint="Мягкое свечение фона и кнопок" /></div>
      <div>
        <span className="mb-2 block text-[13px] font-medium text-muted">Блоки на главной — порядок и видимость</span>
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface-2">
          {t.order.map((b, i) => (
            <div key={b} className="flex items-center gap-2 px-3 py-2">
              <div className="min-w-0 flex-1"><Switch checked={!t.hidden.includes(b)} onChange={(v) => toggle(b, v)} label={BLOCKS[b]} /></div>
              <button type="button" aria-label={`Выше: ${BLOCKS[b]}`} disabled={i === 0} onClick={() => move(b, -1)} className="flex size-9 items-center justify-center rounded-xl border border-line text-muted disabled:opacity-30"><ArrowUp className="size-4" /></button>
              <button type="button" aria-label={`Ниже: ${BLOCKS[b]}`} disabled={i === t.order.length - 1} onClick={() => move(b, 1)} className="flex size-9 items-center justify-center rounded-xl border border-line text-muted disabled:opacity-30"><ArrowDown className="size-4" /></button>
            </div>
          ))}
        </div>
      </div>
      <Button icon={<RotateCcw className="size-4" />} onClick={() => change({ ...DEFAULT_THEME })}>Сбросить оформление</Button>
    </Card>
  )
}

function Form({ s }: { s: Settings }) {
  const toast = useUI((x) => x.toast)
  const ask = useUI((x) => x.ask)
  const [name, setName] = useState(s.userName)
  const [rate, setRate] = useState(s.defaultRate ? String(s.defaultRate) : '')
  const [brk, setBrk] = useState(String(s.defaultBreak))
  const [start, setStart] = useState(s.defaultStart)
  const [end, setEnd] = useState(s.defaultEnd)
  const [mode, setMode] = useState<PayMode>(s.defaultPayMode)
  const [opening, setOpening] = useState(s.openingBalance ? String(s.openingBalance) : '')
  const [remind, setRemind] = useState(s.remindTime)
  const [sup, setSup] = useState<Support>(detectSupport())
  const file = useRef<HTMLInputElement>(null)

  const save = async () => {
    const r = rate.trim() === '' ? 0 : parseMoney(rate)
    const o = opening.trim() === '' ? 0 : parseMoney(opening)
    const b = Number.parseInt(brk || '0', 10)
    if (r === null) return toast('Неверная ставка', 'bad')
    if (o === null) return toast('Неверный начальный остаток', 'bad')
    if (!Number.isFinite(b) || b < 0 || b > 600) return toast('Перерыв: 0–600 минут', 'bad')
    try {
      await updateSettings({ userName: name.trim(), defaultRate: r, defaultBreak: b, defaultStart: start, defaultEnd: end, defaultPayMode: mode, openingBalance: o, remindTime: remind })
      toast('Настройки сохранены')
    } catch (e) { toast(errText(e), 'bad') }
  }

  const permission = async () => { const p = await askPermission(); setSup(detectSupport()); toast(p === 'granted' ? 'Уведомления разрешены' : p === 'denied' ? 'Уведомления запрещены в браузере' : 'Браузер не дал разрешение', p === 'granted' ? 'ok' : 'bad') }
  const test = () => { if (!showLocal('Касса', 'Так будут выглядеть напоминания о платежах', 'test')) toast('Не удалось показать уведомление: нет разрешения или браузер блокирует их здесь', 'bad') }

  const [store, setStore] = useState<StorageInfo | null>(null)
  useEffect(() => { void storageInfo().then(setStore) }, [])
  const protect = async () => { const ok = await requestPersistence(); setStore(await storageInfo()); toast(ok ? 'Хранилище защищено от автоочистки' : 'Браузер не дал защиту — делайте копии и установите приложение на экран «Домой»', ok ? 'ok' : 'bad') }

  const backup = async () => {
    try {
      const r = await saveBackupFile()
      if (r === 'failed') { toast('Не удалось сохранить файл: скачивание заблокировано', 'bad'); return }
      if (r === 'saved') toast('Резервная копия сохранена')
    } catch (e) { toast(errText(e), 'bad') }
  }
  const restore = async (f: File | undefined) => {
    if (!f) return
    try {
      const raw = JSON.parse(await f.text())
      ask({ title: 'Заменить все данные копией?', text: 'Текущие записи будут заменены данными из файла. Это нельзя отменить — сначала сделайте копию текущих данных.', confirmLabel: 'Заменить', onConfirm: async () => { await importBackup(raw); forgetCounts(); await ensureAllSchedules(); toast('Данные восстановлены') } })
    } catch (e) { toast(e instanceof SyntaxError ? 'Файл повреждён: это не JSON' : errText(e), 'bad') }
    if (file.current) file.current.value = ''
  }
  const demo = async () => {
    if (!(await isUserDataEmpty())) { toast('Демо-данные добавляются только в пустое приложение', 'bad'); return }
    try { await loadDemoData(); toast('Демо-данные загружены') } catch (e) { toast(errText(e), 'bad') }
  }
  const wipe = () => ask({ title: 'Удалить все данные?', text: 'Будут удалены смены, расходы, кредиты, заметки и цели. Категории вернутся к стандартным. Это нельзя отменить.', confirmLabel: 'Удалить всё', onConfirm: async () => { await clearAllData(); forgetCounts(); toast('Все данные удалены') } })

  const permLabel = sup.permission === 'granted' ? 'разрешены' : sup.permission === 'denied' ? 'запрещены в браузере' : sup.permission === 'default' ? 'ещё не запрошены' : 'не поддерживаются'

  return (
    <>
      <PageHeader title="Настройки" />
      <div className="space-y-5">
        <Appearance saved={s.theme} />

        <Card className="space-y-4">
          <SectionTitle>Профиль и значения по умолчанию</SectionTitle>
          <p className="-mt-2 text-xs text-faint">Используются, пока вы не сохранили данные смены в самом календаре — после этого статус «Смена» подставляет то, что вы заполнили в нём.</p>
          <Field label="Как к вам обращаться"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="Имя для приветствия" /></Field>
          <Segmented value={mode} onChange={setMode} options={(Object.keys(PAY_MODES) as PayMode[]).map((k) => ({ value: k, label: PAY_MODES[k].label }))} />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Ставка в час"><MoneyInput value={rate} onChange={setRate} /></Field>
            <Field label="Начало смены"><Input type="time" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
            <Field label="Конец смены"><Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} /></Field>
            <Field label="Перерыв, мин"><Input inputMode="numeric" value={brk} onChange={(e) => setBrk(e.target.value.replace(/\D/g, ''))} /></Field>
          </div>
          <Field label="Начальный остаток денег" hint="Сколько было у вас на момент начала ведения учёта — нужен для расчёта общего остатка."><MoneyInput value={opening} onChange={setOpening} /></Field>
          <Button variant="primary" onClick={save}>Сохранить</Button>
        </Card>

        <Card className="space-y-4">
          <SectionTitle><span className="inline-flex items-center gap-2"><BellRing className="size-4 text-pink" />Уведомления о платежах</span></SectionTitle>
          <Notice tone="good"><b>Всегда работает:</b> предстоящие и просроченные платежи показываются прямо в приложении — на главной, в «Кредитах» и в календаре. Интервалы напоминаний (за 7, 3, 1 день, в день платежа, свои) настраиваются отдельно для каждого кредита.</Notice>

          <div>
            <div className="mb-1 text-[15px] font-semibold">Всплывающие уведомления браузера</div>
            <p className="text-sm text-muted">Статус: <b className="text-ink">{permLabel}</b>. Появляются только пока приложение открыто в браузере (локальные уведомления).</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <Field label="Не раньше, чем в"><Input type="time" value={remind} onChange={(e) => setRemind(e.target.value)} className="w-36" /></Field>
              <Button onClick={permission} disabled={!sup.notifications || sup.permission === 'granted'}>Разрешить уведомления</Button>
              <Button onClick={test} disabled={sup.permission !== 'granted'}>Проверить</Button>
            </div>
            {sup.permission === 'denied' && <p className="mt-2 text-xs text-warn">Уведомления заблокированы в настройках сайта. Разрешите их в браузере и вернитесь сюда.</p>}
            {!sup.notifications && <p className="mt-2 text-xs text-warn">Этот браузер или окно не поддерживает уведомления. Платежи по-прежнему видны в приложении.</p>}
          </div>

          <div className="border-t border-line pt-4">
            <div className="mb-1 flex items-center gap-2 text-[15px] font-semibold">Фоновые push-уведомления <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-xs font-medium text-muted">не подключены</span></div>
            <p className="text-sm leading-relaxed text-muted">Чтобы уведомления приходили, когда приложение закрыто, нужны Service Worker, подписка Web Push и <b className="text-ink">сервер с планировщиком</b> и секретным VAPID-ключом. В этой версии данные хранятся только на этом устройстве, поэтому серверной части нет — и мы не делаем вид, что push работают.</p>
            <ul className="mt-3 space-y-1 text-sm text-muted">
              <li>HTTPS-соединение: <b className="text-ink">{sup.secure ? 'есть' : 'нет'}</b></li>
              <li>Service Worker в этом окне: <b className="text-ink">{sup.serviceWorker ? 'доступен' : 'недоступен'}</b></li>
              <li>Push API в этом окне: <b className="text-ink">{sup.pushManager ? 'доступен' : 'недоступен'}</b></li>
            </ul>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-muted">
              <li>Разверните приложение как обычный сайт на своём домене с HTTPS (не во встроенном окне).</li>
              <li>Запустите сервер из папки <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-ink">server/</code> проекта: создайте VAPID-ключи (<code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-ink">npx web-push generate-vapid-keys</code>) и сохраните их в переменных окружения сервера.</li>
              <li>Подключите регистрацию <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs text-ink">sw.js</code> и отправку подписки на сервер — инструкция в README проекта.</li>
              <li>Для нескольких пользователей добавьте авторизацию и базу данных на сервере.</li>
            </ol>
          </div>
        </Card>

        <Card className="space-y-4">
          <SectionTitle><span className="inline-flex items-center gap-2"><DatabaseBackup className="size-4 text-pink" />Данные и резервные копии</span></SectionTitle>
          <Notice tone="warn"><b>Где хранятся данные.</b> Только в этом браузере на этом устройстве (IndexedDB). Они переживают перезагрузку, но пропадут, если очистить данные сайта, сменить браузер или устройство. Делайте резервные копии. {s.lastBackupAt ? `Последняя копия: ${fmtDate(new Date(s.lastBackupAt).toISOString().slice(0, 10))}.` : 'Копий ещё не было.'}</Notice>
          <div className="rounded-2xl border border-line bg-surface-2 p-4 text-sm">
            <div className="flex items-start gap-3">
              <ShieldCheck className={`mt-0.5 size-5 shrink-0 ${store?.persisted ? 'text-ok' : 'text-warn'}`} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{!store ? 'Проверяю…' : !store.supported ? 'Защита хранилища недоступна в этом окне' : store.persisted ? 'Хранилище защищено от автоочистки' : 'Хранилище может быть очищено браузером'}</div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{store?.persisted ? 'Браузер не удалит историю при нехватке места. Копии всё равно нужны на случай смены телефона.' : 'Без защиты браузер вправе стереть данные сайта (чаще на iPhone, если не открывать ~неделю). Установите приложение на экран «Домой» и нажмите кнопку ниже.'}{store?.usedMb !== undefined ? ` Занято: ${store.usedMb < 1 ? '<1' : Math.round(store.usedMb)} МБ.` : ''}</p>
                {store?.supported && !store.persisted && <Button size="sm" className="mt-3" onClick={protect}>Защитить хранилище</Button>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" icon={<Download className="size-4" />} onClick={backup}>Скачать копию</Button>
            <Button icon={<Upload className="size-4" />} onClick={() => file.current?.click()}>Восстановить из файла</Button>
            <input ref={file} type="file" accept="application/json,.json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
          </div>
          <div className="flex flex-wrap gap-3 border-t border-line pt-4">
            <Button onClick={demo}>Загрузить демо-данные</Button>
            <Button variant="danger" icon={<Trash2 className="size-4" />} onClick={wipe}>Удалить все данные</Button>
          </div>
        </Card>

        <p className="flex items-start gap-2 px-1 text-xs leading-relaxed text-faint"><Info className="mt-0.5 size-3.5 shrink-0" />Касса — личное приложение для учёта смен, расходов и кредитов. Расчёты ориентировочные и не заменяют документы банка.</p>
      </div>
    </>
  )
}
