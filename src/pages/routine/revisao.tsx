/**
 * A revisão do mês: o fechamento que atravessa os módulos.
 *
 * Esta tela só desenha. A conta mora em `lib/insights/revisao-do-mes`, e é lá
 * que está a decisão mais importante: o mês em andamento é comparado com o
 * mesmo trecho do mês anterior, e não com ele inteiro.
 */

import { ArrowDown, ArrowUp, CalendarCheck, Minus } from 'lucide-react'
import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/misc'
import { PageHeader } from '@/components/ui/page-header'
import { MonthNav } from '@/features/finance/month-nav'
import { useRevisaoDoMes } from '@/features/routine/use-revisao-do-mes'
import { addMonths, competenceLabel, toCompetence } from '@/lib/finance/billing'
import { formatCents } from '@/lib/finance/money'
import { decimal, duration, integer, shortDate } from '@/lib/format'
import type { ItemDaRevisao, SecaoDaRevisao, Unidade } from '@/lib/insights/revisao-do-mes'
import { cn, today } from '@/lib/utils'

const ACENTO: Record<SecaoDaRevisao['area'], string> = {
  finance: 'accent-finance',
  health: 'accent-health',
  education: 'accent-education',
  routine: 'accent-routine',
}

function formatar(valor: number, unidade: Unidade): string {
  switch (unidade) {
    case 'centavos':
      return formatCents(valor)
    case 'minutos':
      return duration(Math.round(valor))
    case 'horas':
      return `${decimal(valor)} h`
    case 'kg':
      return `${valor > 0 ? '+' : valor < 0 ? '−' : ''}${decimal(Math.abs(valor))} kg`
    case 'nota':
      return decimal(valor)
    case 'kcal':
      return `${integer(Math.round(valor))} kcal`
    case 'contagem':
      return integer(valor)
  }
}

/** A diferença, sem sinal: a seta já diz para que lado foi. */
function formatarDiferenca(diferenca: number, unidade: Unidade): string {
  const absoluta = Math.abs(diferenca)
  return unidade === 'kg' ? `${decimal(absoluta)} kg` : formatar(absoluta, unidade)
}

export function RevisaoPage() {
  const [competence, setCompetence] = useState(toCompetence(today()))
  const { periodo, anterior, secoes } = useRevisaoDoMes(competence)
  // Só o nome do mês: "vs setembro de 2026" em cada linha cansava a leitura.
  const mesAnterior = competenceLabel(addMonths(competence, -1)).split(' ')[0]!.toLowerCase()
  const parcial = competence === toCompetence(today())

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revisão do mês"
        description="O mês de cada módulo lado a lado, comparado com o anterior. Só aparece o que tem registro."
        action={<MonthNav competence={competence} onChange={setCompetence} />}
      />

      <p className="text-fg-subtle text-xs">
        {parcial
          ? `De ${shortDate(periodo.de)} a ${shortDate(periodo.ate)}, contra o mesmo trecho de ${mesAnterior} (${shortDate(anterior.de)} a ${shortDate(anterior.ate)}). O mês ainda não acabou.`
          : `${competenceLabel(competence)} inteiro, contra ${mesAnterior}.`}
      </p>

      {secoes.length === 0 ? (
        <Card>
          <EmptyState
            icon={<CalendarCheck className="size-6" />}
            title="Nada registrado neste mês"
            description="Lançamentos, treinos, estudo e hábitos aparecem aqui assim que houver o primeiro registro."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {secoes.map((secao) => (
            <Card key={secao.area} className={ACENTO[secao.area]}>
              <CardHeader title={secao.titulo} />
              <CardContent>
                <ul className="divide-border-base divide-y">
                  {secao.itens.map((item) => (
                    <Linha key={item.id} item={item} mesAnterior={mesAnterior} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function Linha({ item, mesAnterior }: { item: ItemDaRevisao; mesAnterior: string }) {
  const diferenca =
    item.valor !== null && item.anterior !== null ? item.valor - item.anterior : null
  const bom =
    diferenca === null || diferenca === 0 || item.subirEBom === null
      ? null
      : item.subirEBom === diferenca > 0
  const Seta = diferenca === null || diferenca === 0 ? Minus : diferenca > 0 ? ArrowUp : ArrowDown

  return (
    <li className="flex items-baseline justify-between gap-4 py-2.5">
      <span className="text-fg-muted text-sm">{item.rotulo}</span>
      <span className="text-right">
        <span
          className={cn(
            'text-fg block text-sm font-medium tabular-nums',
            item.unidade === 'centavos' && item.valor !== null && item.valor < 0 && 'text-negative',
          )}
        >
          {item.valor === null ? '—' : formatar(item.valor, item.unidade)}
        </span>
        <span
          className={cn(
            'flex items-center justify-end gap-0.5 text-xs',
            bom === null ? 'text-fg-subtle' : bom ? 'text-positive' : 'text-negative',
          )}
        >
          <Seta className="size-3" />
          {diferenca === null
            ? `sem registro em ${mesAnterior}`
            : diferenca === 0
              ? `igual a ${mesAnterior}`
              : `${formatarDiferenca(diferenca, item.unidade)} vs ${mesAnterior}`}
        </span>
      </span>
    </li>
  )
}
