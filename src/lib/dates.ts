/**
 * Datas em ISO local (AAAA-MM-DD).
 *
 * Nada aqui usa UTC: `new Date().toISOString()` devolve o dia errado para quem
 * está a oeste de Greenwich depois das 21h — e o app é usado no Brasil, à
 * noite, justamente para registrar o dia que passou.
 *
 * Toda conversão de string para `Date` fixa o meio-dia local. Isso torna a
 * aritmética imune ao horário de verão: somar um dia num fuso que avança 1h à
 * meia-noite não muda a data quando se parte das 12h.
 *
 * A semana começa no **domingo**, como no calendário brasileiro e no heatmap
 * do GitHub. Toda agregação semanal do app segue essa convenção.
 */

export function isoDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

export function today(): string {
  return isoDate(new Date())
}

/** ISO para `Date` ao meio-dia local. */
export function parseIso(iso: string): Date {
  return new Date(`${iso}T12:00:00`)
}

export function addDays(iso: string, days: number): string {
  const date = parseIso(iso)
  date.setDate(date.getDate() + days)
  return isoDate(date)
}

/** Dias inteiros de `from` até `to`. Negativo quando `to` é anterior. */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000)
}

/** 0 = domingo, 6 = sábado. */
export function weekdayOf(iso: string): number {
  return parseIso(iso).getDay()
}

/** Domingo da semana a que a data pertence. */
export function weekStart(iso: string): string {
  return addDays(iso, -weekdayOf(iso))
}

/** Todos os dias do intervalo, inclusive nas duas pontas. */
export function eachDay(from: string, to: string): string[] {
  const days: string[] = []
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) days.push(cursor)
  return days
}

/** Os N dias que terminam em `end` (o próprio `end` incluído). */
export function lastDays(end: string, count: number): string[] {
  return eachDay(addDays(end, -(count - 1)), end)
}

export function startOfMonth(competence: string): string {
  return `${competence}-01`
}

export function endOfMonth(competence: string): string {
  const [year, month] = competence.split('-').map(Number) as [number, number]
  return `${competence}-${String(new Date(year, month, 0).getDate()).padStart(2, '0')}`
}

/**
 * As 6 semanas que a tela do mês exibe: começa no domingo anterior ao dia 1 e
 * termina no sábado seguinte ao último dia. Seis linhas fixas evitam que a
 * grade mude de altura ao trocar de mês.
 */
export function monthGrid(competence: string): string[] {
  const first = weekStart(startOfMonth(competence))
  return Array.from({ length: 42 }, (_, index) => addDays(first, index))
}

export function ageFromBirthdate(birthdate: string): number {
  const birth = parseIso(birthdate)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDiff = now.getMonth() - birth.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) age--
  return age
}
