import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/misc'
import { useRecurring } from '@/data/queries'
import { confirmar } from '@/lib/avisos'
import type { RegraQueRepete } from '@/lib/finance/parcelamentos'
import { mesEAno } from './parcelamentos'

/**
 * O aviso das regras que repetem um parcelamento já lançado.
 *
 * Apagar fica com a pessoa, num clique, e com pergunta antes: o app aponta o
 * engano, mas não some com regra nenhuma por conta própria.
 */
export function RegrasRepetidas({ repetidas }: { repetidas: RegraQueRepete[] }) {
  const { remove } = useRecurring()
  const [apagando, setApagando] = useState(false)

  if (repetidas.length === 0) return null

  const nomes = repetidas.map((item) => item.description).join(', ')
  const uma = repetidas.length === 1

  async function apagar() {
    const ok = await confirmar(
      `Apagar ${uma ? 'a regra' : `as ${repetidas.length} regras`} ${nomes}? As parcelas lançadas continuam como estão.`,
      { confirmar: 'Apagar' },
    )
    if (!ok) return
    setApagando(true)
    try {
      for (const item of repetidas) await remove.mutateAsync(item.regraId)
    } finally {
      setApagando(false)
    }
  }

  return (
    <div className="space-y-2">
      <Callout tone="warning" icon={<AlertTriangle className="size-3.5" />}>
        {uma ? 'Esta regra repete' : `${repetidas.length} regras repetem`} um parcelamento que já
        está lançado ({nomes}). {uma ? 'Ela começa' : 'Elas começam'} depois da última parcela e
        não {uma ? 'tem' : 'têm'} fim: continuariam lançando todo mês depois de quitado. Vieram de
        uma importação antiga, que confundia parcela com conta mensal.
      </Callout>
      <Button variant="secondary" size="sm" disabled={apagando} onClick={() => void apagar()}>
        {apagando ? 'Apagando…' : uma ? 'Apagar esta regra' : `Apagar estas ${repetidas.length} regras`}
      </Button>
    </div>
  )
}

/** A linha de apoio de uma regra que repete parcelamento. */
export function apoioDaRepetida(item: RegraQueRepete): string {
  return `repete o parcelamento, que acaba em ${mesEAno(item.ultimaData)}`
}
