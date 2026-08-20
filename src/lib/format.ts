/** Formatadores pt-BR usados em toda a interface. */

const currencyFmt = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

export function currency(value: number): string {
  return currencyFmt.format(value)
}

export function decimal(value: number, digits = 1): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function integer(value: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)
}

export function percent(value: number, digits = 0): string {
  return `${decimal(value, digits)}%`
}

export function signed(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${decimal(value, digits)}`
}

const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' })
const longDateFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
})
const weekdayFmt = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })

function parse(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

export function shortDate(iso: string): string {
  return dateFmt.format(parse(iso))
}

export function longDate(iso: string): string {
  return longDateFmt.format(parse(iso))
}

export function weekday(iso: string): string {
  return weekdayFmt.format(parse(iso)).replace('.', '')
}

/** "hoje", "ontem", "em 3 dias", "há 5 dias". */
export function relativeDay(iso: string, base = new Date()): string {
  // Ambas as datas normalizadas ao meio-dia local: sem isso o horário-base
  // desloca a conta e "hoje" vira "amanhã".
  const baseIso = new Date(base.getTime() - base.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
  const days = Math.round((parse(iso).getTime() - parse(baseIso).getTime()) / 86_400_000)
  if (days === 0) return 'hoje'
  if (days === 1) return 'amanhã'
  if (days === -1) return 'ontem'
  if (days > 0) return `em ${days} dias`
  return `há ${Math.abs(days)} dias`
}

export function duration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}min`
  if (!m) return `${h}h`
  return `${h}h${String(m).padStart(2, '0')}`
}

export function kg(value: number): string {
  return `${decimal(value, 1)} kg`
}

export function kcal(value: number): string {
  return `${integer(value)} kcal`
}
