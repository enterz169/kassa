import { createContext, useContext, type ReactNode } from 'react'
import { useData, type AppData } from './data'

const Ctx = createContext<AppData | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const data = useData()
  return <Ctx.Provider value={data}>{children}</Ctx.Provider>
}

export function useApp(): AppData {
  const v = useContext(Ctx)
  if (!v) throw new Error('DataProvider отсутствует')
  return v
}
