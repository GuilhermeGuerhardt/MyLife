import { Card, CardContent } from '@/components/ui/card'
import { Progress, Stat } from '@/components/ui/misc'
import { currency, decimal, duration, longDate, percent, relativeDay } from '@/lib/format'
import { today } from '@/lib/utils'

/**
 * Os quatro números do curso livre: progresso, tempo que falta, ritmo e custo.
 *
 * O ritmo é o único que cobra alguma coisa — ele diz quantas aulas por dia
 * faltam para cumprir o prazo que a pessoa mesma definiu, e fica vermelho
 * quando o número vira fantasia.
 */
export function NumerosDoCursoLivre({
  concluidas,
  total,
  minutosRestantes,
  prazo,
  custo,
}: {
  concluidas: number
  total: number
  minutosRestantes: number
  prazo: string | null
  custo: number | null
}) {
  const pct = total ? (concluidas / total) * 100 : 0
  const ritmo = ritmoNecessario(total - concluidas, prazo)

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardContent>
          <Stat label="Progresso" value={percent(pct, 0)} hint={`${concluidas} de ${total} aulas`} />
          <Progress className="mt-3" value={pct} />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stat
            label="Tempo restante"
            value={minutosRestantes ? duration(minutosRestantes) : '—'}
            hint={minutosRestantes ? 'Somando as aulas que faltam' : 'Nada pendente'}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stat
            label="Ritmo necessário"
            value={ritmo ? decimal(ritmo.perDay, 1) : '—'}
            unit={ritmo ? 'aulas/dia' : undefined}
            hint={
              ritmo && prazo
                ? `Para terminar até ${longDate(prazo)} (${relativeDay(prazo)})`
                : 'Defina um prazo no curso'
            }
            tone={ritmo && ritmo.perDay > 4 ? 'negative' : undefined}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <Stat
            label="Custo"
            value={custo ? currency(custo) : '—'}
            hint={custo ? 'Vai virar despesa no financeiro' : 'Sem custo informado'}
          />
        </CardContent>
      </Card>
    </div>
  )
}

/** Aulas por dia necessárias para terminar até o prazo. */
function ritmoNecessario(restantes: number, prazo: string | null): { perDay: number } | null {
  if (!prazo || restantes <= 0) return null
  const dias = Math.ceil(
    (new Date(`${prazo}T12:00:00`).getTime() - new Date(`${today()}T12:00:00`).getTime()) /
      86_400_000,
  )
  if (dias <= 0) return { perDay: restantes }
  return { perDay: Math.ceil((restantes / dias) * 10) / 10 }
}
