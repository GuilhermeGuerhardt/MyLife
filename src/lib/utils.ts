import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// A aritmética de datas mora em `dates.ts` (pura e testada); reexportada aqui
// porque metade do app já a importa deste caminho.
export { addDays, ageFromBirthdate, isoDate, today } from './dates'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(): string {
  return crypto.randomUUID()
}
