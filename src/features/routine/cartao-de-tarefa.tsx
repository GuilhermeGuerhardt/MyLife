import { Check, NotebookPen, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/misc'
import { prazoEmPalavras, type ItemDeTarefa } from '@/lib/routine/tarefas'
import { cn } from '@/lib/utils'

/**
 * O cartão do quadro, arrastável.
 *
 * O arrasto é o do próprio navegador, sem biblioteca: são dois destinos e um
 * estado booleano, e um pacote de drag-and-drop custaria mais peso do que o
 * problema tem. Como arrasto nativo não existe em tela de toque, a caixa de
 * marcar continua aqui — e é também o caminho de quem usa teclado.
 */

/** O que viaja no arrasto: a chave do cartão, única na lista inteira. */
export const FORMATO_DO_ARRASTE = 'text/x-life-tarefa'

export function CartaoDeTarefa({
  item,
  hoje,
  onAlternar,
  onAbrirNota,
  onRemover,
  onRemoverVinculada,
}: {
  item: ItemDeTarefa
  hoje: string
  onAlternar: () => void
  onAbrirNota?: () => void
  onRemover?: () => void
  /** Só na tarefa vinda do caderno, onde excluir tem dois destinos possíveis. */
  onRemoverVinculada?: () => void
}) {
  const [arrastando, setArrastando] = useState(false)
  const atrasada = !item.feita && item.data !== null && item.data < hoje

  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(FORMATO_DO_ARRASTE, item.chave)
        event.dataTransfer.effectAllowed = 'move'
        setArrastando(true)
      }}
      onDragEnd={() => setArrastando(false)}
      className={cn(
        'group bg-surface border-border-base flex cursor-grab items-start gap-2.5 rounded-[var(--radius-card)] border p-3.5 transition-[opacity,transform]',
        'hover:-translate-y-px active:cursor-grabbing',
        arrastando && 'opacity-40',
      )}
    >
      <button
        type="button"
        onClick={onAlternar}
        aria-label={item.feita ? 'Devolver para A fazer' : 'Marcar como feita'}
        aria-pressed={item.feita}
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
          item.feita
            ? 'border-positive bg-positive text-accent-fg'
            : 'border-border-strong hover:border-pending',
        )}
      >
        {item.feita ? <Check className="size-3.5" /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', item.feita ? 'text-fg-subtle line-through' : 'text-fg')}>
          {item.titulo}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {item.data && (
            <Badge tone={atrasada ? 'negative' : 'neutral'}>
              {prazoEmPalavras(item.data, hoje)}
            </Badge>
          )}
          {item.origem.tipo === 'nota' && (
            <button
              type="button"
              onClick={onAbrirNota}
              className="text-fg-subtle hover:text-fg flex items-center gap-1 text-xs transition-colors"
            >
              <NotebookPen className="size-3" />
              {item.origem.titulo || 'Sem título'}
            </button>
          )}
        </div>
      </div>

      {/*
        O desfazer fica só na coluna das feitas: é onde ele resolve alguma
        coisa, e num cartão pendente seria um botão que repete a caixa ao lado.
      */}
      {item.feita && (
        <button
          type="button"
          onClick={onAlternar}
          aria-label="Devolver para A fazer"
          title="Devolver para A fazer"
          className="text-fg-subtle hover:text-fg shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Undo2 className="size-3.5" />
        </button>
      )}

      {onRemoverVinculada && (
        <button
          type="button"
          onClick={onRemoverVinculada}
          aria-label="Excluir tarefa"
          title="Excluir"
          className="text-fg-subtle hover:text-negative shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}

      {onRemover && (
        <button
          type="button"
          onClick={onRemover}
          aria-label="Remover tarefa"
          className="text-fg-subtle hover:text-negative shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  )
}
