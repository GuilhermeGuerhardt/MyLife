import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * O topo de uma tela: o nome, a linha que diz o que ela faz, e os botões dela.
 *
 * Estava copiado em dezoito páginas, e por isso divergia: umas limitavam a
 * largura da descrição e outras deixavam a frase atravessar o monitor inteiro,
 * o espaço entre título e texto ia de 2 a 4 pixels, e metade das telas
 * alinhava os botões pelo topo enquanto a outra metade alinhava pela base.
 * Num lugar só, a diferença some e um ajuste de tipografia vale para o app todo.
 *
 * Os botões alinham pelo topo, junto do título. Pela base eles desciam quando
 * a descrição virava duas linhas, e a mesma tela mudava de desenho conforme o
 * texto crescia.
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h1 className="text-fg text-xl leading-tight font-semibold tracking-[-0.012em]">{title}</h1>
        {/* Medida de leitura limitada: linha que atravessa uma tela de 27
            polegadas faz o olho procurar onde a próxima começa. */}
        {description && (
          <p className="text-fg-muted mt-1.5 max-w-2xl text-sm leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div data-tour="acao">{action}</div>}
    </div>
  )
}
