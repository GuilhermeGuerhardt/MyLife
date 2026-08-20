import type { HeatmapDay } from '@/lib/habits/habits'
import { longDate } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Da célula vazia à mais intensa. Classes fixas: Tailwind não gera nome dinâmico. */
const LEVELS = [
  'bg-surface-2',
  'bg-accent/25',
  'bg-accent/45',
  'bg-accent/70',
  'bg-accent',
] as const

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

/**
 * Heatmap de consistência, colunas de domingo a sábado.
 *
 * Rola na horizontal no celular em vez de encolher as células: célula menor que
 * ~10px vira uma mancha ilegível, e a graça do heatmap é enxergar o padrão.
 */
export function Heatmap({
  weeks,
  onSelect,
  className,
}: {
  weeks: HeatmapDay[][]
  onSelect?: (date: string) => void
  className?: string
}) {
  return (
    <div className={cn('overflow-x-auto pb-1', className)}>
      <div className="flex gap-[3px]">
        <div className="mt-[15px] flex shrink-0 flex-col gap-[3px] pr-1">
          {WEEKDAYS.map((label, row) => (
            <span
              key={row}
              className="text-fg-subtle h-2.5 text-[9px] leading-[10px]"
              aria-hidden
            >
              {row % 2 === 1 ? label : ''}
            </span>
          ))}
        </div>

        {weeks.map((week, index) => (
          <div key={week[0]!.date} className="flex shrink-0 flex-col gap-[3px]">
            <span className="text-fg-subtle h-3 text-[9px] leading-3 whitespace-nowrap">
              {monthLabel(week, weeks[index - 1])}
            </span>
            {week.map((day) => (
              <Cell key={day.date} day={day} onSelect={onSelect} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function Cell({ day, onSelect }: { day: HeatmapDay; onSelect?: (date: string) => void }) {
  // count -1 = dia futuro: some, em vez de virar um "zero" que parece falha.
  if (day.count < 0) return <span className="size-2.5" aria-hidden />

  const title = `${longDate(day.date)} — ${day.count === 0 ? 'sem registro' : `${day.count} registro${day.count > 1 ? 's' : ''}`}`

  if (!onSelect) {
    return <span className={cn('size-2.5 rounded-[3px]', LEVELS[day.level])} title={title} />
  }

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => onSelect(day.date)}
      className={cn(
        'hover:ring-accent size-2.5 rounded-[3px] transition-shadow hover:ring-2',
        LEVELS[day.level],
      )}
    />
  )
}

/** Escreve o mês só na primeira coluna que entra nele. */
function monthLabel(week: HeatmapDay[], previous?: HeatmapDay[]): string {
  const month = week[0]!.date.slice(5, 7)
  if (previous && previous[0]!.date.slice(5, 7) === month) return ''
  return MONTHS[Number(month) - 1] ?? ''
}

export function HeatmapLegend() {
  return (
    <div className="text-fg-subtle flex items-center gap-1.5 text-[10px]">
      <span>Menos</span>
      {LEVELS.map((level) => (
        <span key={level} className={cn('size-2.5 rounded-[3px]', level)} />
      ))}
      <span>Mais</span>
    </div>
  )
}
