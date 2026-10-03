import { ArrowLeft, Download, ExternalLink, Eye, Pen, Pin, Trash2, Type } from 'lucide-react'
import { Button, buttonStyles } from '@/components/ui/button'
import { Input } from '@/components/ui/field'
import { Segmented } from '@/components/ui/misc'
import { useMenuFlutuante } from '@/components/ui/use-menu-flutuante'
import { confirmar } from '@/lib/avisos'
import type { FormatoDaNota } from '@/lib/education/formato'
import { cn } from '@/lib/utils'
import { ROTULOS, saidasPossiveis, type FormatoDeSaida } from '../exportar-nota'

/** Editar ou visualizar: o mesmo par de botões do editor do caderno. */
export type NoteMode = 'edit' | 'preview'

/**
 * A barra de cima da anotação: título, modo de leitura e as ações.
 *
 * Numa janela estreita a fila de botões quebra para a linha de baixo em vez de
 * espremer o título — daí a largura mínima no campo.
 */
export function CabecalhoDaNota({
  titulo,
  onTitulo,
  mode,
  onModeChange,
  formato,
  fixada,
  naJanela,
  onVoltar,
  onAbrirEmJanela,
  onExportar,
  onConverter,
  onFixar,
  onRemover,
}: {
  titulo: string
  onTitulo: (titulo: string) => void
  mode: NoteMode
  onModeChange: (mode: NoteMode) => void
  formato: FormatoDaNota
  fixada: boolean
  /** Na janela solta não há para onde voltar, nem o que remover dali. */
  naJanela: boolean
  onVoltar: () => void
  onAbrirEmJanela?: () => void
  onExportar: (saida: FormatoDeSaida) => void
  onConverter: () => void
  onFixar: () => void
  onRemover: () => void
}) {
  return (
    <div className="border-border-base flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
      {!naJanela && (
        <Button variant="ghost" size="icon" onClick={onVoltar} className="lg:hidden" aria-label="Voltar">
          <ArrowLeft />
        </Button>
      )}
      <Input
        value={titulo}
        onChange={(e) => onTitulo(e.target.value)}
        placeholder="Título da anotação"
        className="h-9 min-w-40 flex-1 border-transparent bg-transparent px-0 text-base font-semibold"
      />
      <Segmented
        value={mode}
        onChange={onModeChange}
        options={[
          { value: 'edit', label: <Pen className="size-3.5" />, ariaLabel: 'Editar' },
          { value: 'preview', label: <Eye className="size-3.5" />, ariaLabel: 'Visualizar' },
        ]}
      />
      {onAbrirEmJanela && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onAbrirEmJanela}
          aria-label="Abrir em outra janela"
          title="Abrir em outra janela"
        >
          <ExternalLink />
        </Button>
      )}
      <MenuExportar formato={formato} onEscolher={onExportar} />
      {/* Só nas anotações que ainda são Markdown: nas formatadas não há para
          onde converter, e o botão viraria enfeite. */}
      {formato === 'markdown' && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onConverter}
          aria-label="Converter para texto formatado"
          title="Converter para texto formatado"
        >
          <Type />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        onClick={onFixar}
        aria-label={fixada ? 'Desafixar' : 'Fixar no topo'}
        className={fixada ? 'text-accent' : undefined}
      >
        <Pin />
      </Button>
      {!naJanela && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            void confirmar('Remover esta anotação?', { confirmar: 'Remover' }).then((ok) => {
              if (ok) onRemover()
            })
          }}
          aria-label="Remover anotação"
        >
          <Trash2 />
        </Button>
      )}
    </div>
  )
}

/**
 * O menu de exportação, com o que aquele formato sabe entregar.
 *
 * `<details>` pelo mesmo motivo das paletas do editor: anda pelo teclado e não
 * pede estado no React. Fechar ao clicar fora vem de `useMenuFlutuante`.
 */
function MenuExportar({
  formato,
  onEscolher,
}: {
  formato: FormatoDaNota
  onEscolher: (saida: FormatoDeSaida) => void
}) {
  const menu = useMenuFlutuante()

  return (
    <details ref={menu} className="relative">
      <summary
        title="Exportar"
        aria-label="Exportar"
        className={cn(
          buttonStyles({ variant: 'ghost', size: 'icon' }),
          'cursor-pointer list-none [&::-webkit-details-marker]:hidden',
        )}
      >
        <Download />
      </summary>
      <div className="border-border-base bg-surface absolute top-10 right-0 z-20 w-48 rounded-lg border p-1 shadow-lg">
        {saidasPossiveis(formato).map((saida) => (
          <button
            key={saida}
            type="button"
            onClick={(e) => {
              e.currentTarget.closest('details')?.removeAttribute('open')
              onEscolher(saida)
            }}
            className="text-fg hover:bg-surface-2 block w-full rounded px-2 py-1.5 text-left text-xs"
          >
            {ROTULOS[saida]}
          </button>
        ))}
      </div>
    </details>
  )
}
