import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import type { ItemDeTarefa } from '@/lib/routine/tarefas'

/**
 * De onde excluir uma tarefa que veio do caderno.
 *
 * São dois destinos, e só quem escreveu sabe qual quer: a caixinha pode ser
 * lixo de verdade ou pode ser conteúdo da aula que só não devia estar no
 * quadro. Perguntar é mais barato do que apagar texto de alguém por conta
 * própria.
 */
export function ExcluirDeOnde({
  item,
  onFechar,
  onSoDoQuadro,
  onNosDoisLugares,
}: {
  /** Nulo quando não há nada a decidir — é o que mantém o diálogo fechado. */
  item: ItemDeTarefa | null
  onFechar: () => void
  onSoDoQuadro: (item: ItemDeTarefa) => void
  onNosDoisLugares: (item: ItemDeTarefa) => void
}) {
  return (
    <Modal
      open={item !== null}
      onClose={onFechar}
      title="Excluir de onde?"
      description={
        item?.origem.tipo === 'nota'
          ? `“${item.titulo}” está escrita na anotação ${item.origem.titulo || 'sem título'}.`
          : undefined
      }
      footer={
        <Button variant="ghost" onClick={onFechar}>
          Cancelar
        </Button>
      }
    >
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => item && onSoDoQuadro(item)}
          className="border-border-base hover:border-accent w-full rounded-[var(--radius-control)] border p-3 text-left transition-colors"
        >
          <p className="text-fg text-sm font-medium">Só do A fazer</p>
          <p className="text-fg-muted mt-0.5 text-xs">
            O cartão sai do quadro e a caixinha continua escrita na anotação, do jeito que está.
          </p>
        </button>

        <button
          type="button"
          onClick={() => item && onNosDoisLugares(item)}
          className="border-border-base hover:border-negative w-full rounded-[var(--radius-control)] border p-3 text-left transition-colors"
        >
          <p className="text-negative text-sm font-medium">Nos dois lugares</p>
          <p className="text-fg-muted mt-0.5 text-xs">
            Apaga a linha de dentro da anotação também. Isso não tem desfazer.
          </p>
        </button>
      </div>
    </Modal>
  )
}
