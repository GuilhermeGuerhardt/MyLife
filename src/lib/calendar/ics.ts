/**
 * Export da agenda em iCalendar (RFC 5545) — o formato que Google Agenda,
 * Apple Calendário e Outlook importam.
 *
 * Duas decisões que evitam dor de cabeça:
 *
 * - **Horário flutuante.** Aula das 19h é às 19h onde quer que o calendário
 *   seja aberto. Gravar com fuso exigiria embutir um bloco `VTIMEZONE`
 *   completo, e gravar em UTC faria a aula "andar" no horário de verão.
 * - **UID estável.** O identificador vem do registro de origem, então
 *   reimportar o arquivo atualiza o evento em vez de duplicá-lo.
 */

import type { AgendaEvent } from './agenda'
import { addDays } from '@/lib/dates'

const PRODID = '-//Life//Agenda//PT-BR'

export function toIcs(events: AgendaEvent[], calendarName = 'Life'): string {
  const stamp = timestamp(new Date())

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    ...events.flatMap((event) => vevent(event, stamp)),
    'END:VCALENDAR',
  ]

  // O RFC exige CRLF; parsers tolerantes aceitam LF, os rigorosos não.
  return lines.flatMap(fold).join('\r\n') + '\r\n'
}

function vevent(event: AgendaEvent, stamp: string): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${uidFor(event)}`,
    `DTSTAMP:${stamp}`,
    ...datesFor(event),
    `SUMMARY:${escapeText(event.title)}`,
  ]

  const description = [event.detail, event.amountCents ? amount(event.amountCents) : null]
    .filter(Boolean)
    .join(' · ')
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`)

  lines.push(`CATEGORIES:${escapeText(event.source)}`)
  if (event.done) lines.push('STATUS:CONFIRMED')
  lines.push('END:VEVENT')

  return lines
}

function datesFor(event: AgendaEvent): string[] {
  if (!event.time) {
    // Evento de dia inteiro: DTEND é exclusivo, por isso o dia seguinte.
    return [
      `DTSTART;VALUE=DATE:${compact(event.date)}`,
      `DTEND;VALUE=DATE:${compact(addDays(event.date, 1))}`,
    ]
  }

  const end = event.endTime ?? addMinutes(event.time, 60)
  return [
    `DTSTART:${compact(event.date)}T${compactTime(event.time)}`,
    `DTEND:${compact(event.date)}T${compactTime(end)}`,
  ]
}

function uidFor(event: AgendaEvent): string {
  return `${event.id.replace(/[^a-zA-Z0-9:_-]/g, '-')}@life.app`
}

function compact(iso: string): string {
  return iso.replace(/-/g, '')
}

function compactTime(time: string): string {
  const [hour = '00', minute = '00'] = time.split(':')
  return `${hour.padStart(2, '0')}${minute.padStart(2, '0')}00`
}

function addMinutes(time: string, minutes: number): string {
  const [hour = '0', minute = '0'] = time.split(':')
  const total = (Number(hour) * 60 + Number(minute) + minutes) % 1440
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

function timestamp(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
}

function amount(cents: number): string {
  return `R$ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

/** Barra invertida, ponto e vírgula, vírgula e quebra de linha são reservados. */
function escapeText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Dobra a linha em 75 octetos, como o RFC manda — a continuação começa com um
 * espaço. Conta em octetos, não em caracteres: um "ç" ocupa dois, e cortar no
 * meio dele corrompe o arquivo.
 */
function fold(line: string): string[] {
  const encoder = new TextEncoder()
  if (encoder.encode(line).length <= 75) return [line]

  const parts: string[] = []
  let current = ''
  let bytes = 0
  // A partir da segunda linha, o espaço inicial já consome um octeto.
  let limit = 75

  for (const char of line) {
    const size = encoder.encode(char).length
    if (bytes + size > limit) {
      parts.push(current)
      current = ''
      bytes = 0
      limit = 74
    }
    current += char
    bytes += size
  }
  if (current) parts.push(current)

  return parts.map((part, index) => (index === 0 ? part : ` ${part}`))
}

/** Nome de arquivo sugerido no download. */
export function icsFilename(label: string): string {
  return `life-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`
}
