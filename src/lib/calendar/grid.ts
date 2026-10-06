import { eachDayOfInterval, endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns'
import { parse, toStr } from '../dates'

export interface GridDay { date: string; inMonth: boolean }

export function monthGrid(anchor: string): GridDay[] {
  const a = parse(anchor)
  const start = startOfWeek(startOfMonth(a), { weekStartsOn: 1 })
  const end = endOfWeek(endOfMonth(a), { weekStartsOn: 1 })
  return eachDayOfInterval({ start, end }).map((d) => ({ date: toStr(d), inMonth: d.getMonth() === a.getMonth() }))
}

export const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
