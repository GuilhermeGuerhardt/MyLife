import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Uma conta numa lista: fio de cor, nome, uma linha de detalhe e o valor.
 *
 * Nasceu duplicada — a tela de contas e o resumo da visão geral desenhavam a
 * mesma linha com dois punhados de classe parecidos, e o primeiro ajuste de
 * espaçamento já tinha deixado as duas diferentes.
 *
 * O valor fica à direita de propósito: numa coluna, o olho compara as casas
 * decimais sem precisar ler número por número.
 */
export function LinhaDeConta({
  cor,
  nome,
  detalhe,
  valor,
  negativo = false,
  children,
}: {
  cor: string
  nome: string
  detalhe: ReactNode
  valor: string
  /** Pinta o valor de vermelho — saldo no vermelho, não despesa. */
  negativo?: boolean
  /** Ações da linha, à direita do valor. */
  children?: ReactNode
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <span className="h-7 w-[3px] shrink-0 rounded-full" style={{ background: cor }} />

      <div className="min-w-0 flex-1">
        <p className="text-fg truncate text-sm">{nome}</p>
        <p className="text-fg-subtle truncate text-xs">{detalhe}</p>
      </div>

      <span className={cn('text-sm font-medium', negativo ? 'text-negative' : 'text-fg')}>
        {valor}
      </span>

      {children}
    </div>
  )
}
