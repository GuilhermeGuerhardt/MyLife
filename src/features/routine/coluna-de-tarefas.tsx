import { ListTodo } from 'lucide-react'
import { EmptyState } from '@/components/ui/misc'
import type { ColunaDeTarefa, ItemDeTarefa } from '@/lib/routine/tarefas'
import { cn } from '@/lib/utils'
import { CartaoDeTarefa, FORMATO_DO_ARRASTE } from './cartao-de-tarefa'

/**
 * Uma coluna do quadro, que recebe cartões soltos.
 *
 * A cor sai da coluna, não do módulo. O accent da Rotina é vermelho, e pintar a
 * coluna do que falta fazer de vermelho dizia "isto está errado" sobre uma
 * tarefa que só não chegou a vez. Azul para o que está em aberto, verde para o
 * que saiu, e a área de solta se acende na cor da coluna em que o cartão vai
 * cair — antes as duas acendiam no mesmo vermelho e não davam pista nenhuma.
 */
export function ColunaDoQuadro({
  coluna,
  titulo,
  itens,
  hoje,
  aceso,
  onEntrar,
  onSair,
  onSoltar,
  onAlternar,
  onAbrirNota,
  onRemover,
  onExcluirVinculada,
  vazio,
}: {
  coluna: ColunaDeTarefa
  titulo: string
  itens: ItemDeTarefa[]
  hoje: string
  /** Verdadeiro enquanto um cartão paira sobre esta coluna. */
  aceso: boolean
  onEntrar: (coluna: ColunaDeTarefa) => void
  onSair: () => void
  onSoltar: (chave: string, coluna: ColunaDeTarefa) => void
  onAlternar: (item: ItemDeTarefa) => void
  onAbrirNota: (id: string) => void
  onRemover: (id: string) => void
  onExcluirVinculada: (item: ItemDeTarefa) => void
  vazio: string
}) {
  const feita = coluna === 'feitas'
  const cor = feita
    ? {
        trilho: 'border-positive/60',
        etiqueta: 'bg-positive/15 text-positive',
        solta: 'bg-positive/10',
      }
    : {
        trilho: 'border-pending/60',
        etiqueta: 'bg-pending/15 text-pending',
        solta: 'bg-pending/10',
      }

  return (
    <section
      onDragOver={(event) => {
        // Sem o preventDefault o navegador recusa a solta e o cartão volta.
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        if (!aceso) onEntrar(coluna)
      }}
      onDragLeave={(event) => {
        // Sair para um filho ainda é estar dentro da coluna.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onSair()
      }}
      onDrop={(event) => {
        event.preventDefault()
        const chave = event.dataTransfer.getData(FORMATO_DO_ARRASTE)
        if (chave) {
          onSair()
          onSoltar(chave, coluna)
        }
      }}
      /*
        A coluna não é uma caixa. O trilho colorido embaixo do título é o que
        marca o território, e a área de solta só se pinta enquanto um cartão
        paira sobre ela: fora disso não há moldura nenhuma disputando atenção
        com os cartões, que são o conteúdo de verdade.
      */
      className={cn(
        'flex flex-col rounded-[var(--radius-card)] p-2 transition-colors lg:min-h-0',
        aceso ? cor.solta : 'bg-transparent',
      )}
    >
      <header
        className={cn('mb-3 flex shrink-0 items-baseline gap-2 border-b-2 px-1 pb-2', cor.trilho)}
      >
        <h2 className="text-fg text-sm font-semibold tracking-[-0.008em]">{titulo}</h2>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium tabular-nums',
            cor.etiqueta,
          )}
        >
          {itens.length}
        </span>
      </header>

      {itens.length === 0 ? (
        <div className="px-1 pb-2">
          <EmptyState icon={<ListTodo className="size-5" />} title="Vazio" description={vazio} />
        </div>
      ) : (
        <ul className="space-y-2.5 overflow-y-auto pr-1 lg:min-h-0 lg:flex-1">
          {itens.map((item) => (
            <CartaoDeTarefa
              key={item.chave}
              item={item}
              hoje={hoje}
              onAlternar={() => onAlternar(item)}
              onAbrirNota={
                item.origem.tipo === 'nota' ? () => onAbrirNota(item.origem.id) : undefined
              }
              onRemover={
                item.origem.tipo === 'propria' ? () => onRemover(item.origem.id) : undefined
              }
              onRemoverVinculada={
                item.origem.tipo === 'nota' ? () => onExcluirVinculada(item) : undefined
              }
            />
          ))}
        </ul>
      )}
    </section>
  )
}
