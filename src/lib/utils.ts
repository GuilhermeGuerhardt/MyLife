import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function uid(): string {
  return crypto.randomUUID()
}

/** Data de hoje em ISO (YYYY-MM-DD), no fuso local — não em UTC. */
export function today(): string {
  const d = new Date()
  const offset = d.getTimezoneOffset() * 60_000
  return new Date(d.getTime() - offset).toISOString().slice(0, 10)
}

export function isoDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

export function ageFromBirthdate(birthdate: string): number {
  const birth = new Date(`${birthdate}T12:00:00`)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--
  return age
}
