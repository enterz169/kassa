import { Car, CreditCard, GraduationCap, Home, Landmark, ShoppingBag, Smartphone, Wallet, type LucideIcon } from 'lucide-react'

const MAP: Record<string, LucideIcon> = {
  landmark: Landmark, 'credit-card': CreditCard, car: Car, home: Home, 'shopping-bag': ShoppingBag,
  'graduation-cap': GraduationCap, smartphone: Smartphone, wallet: Wallet,
}

export function LoanIcon({ name, className }: { name: string; className?: string }) {
  const I = MAP[name] ?? Landmark
  return <I className={className} />
}
