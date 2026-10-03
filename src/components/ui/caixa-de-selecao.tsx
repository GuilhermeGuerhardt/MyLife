import { Check, Minus } from 'lucide-react'
import { useImperativeHandle, useLayoutEffect, useRef, type ReactNode, type Ref } from 'react'
import { cn } from '@/lib/utils'

/**
 * Caixa de seleção do kit.
 *
 * O input é o nativo de verdade, só sem a aparência do sistema: teclado, leitor
 * de tela e o anel de foco do app (`:focus-visible` em `index.css`) vêm de
 * graça. A caixa do sistema não vinha junto porque não acompanha o tema — saía
 * branca e redonda no meio de uma tela escura e de canto reto.
 *
 * O alvo de clique é maior que a caixa e devolve a diferença em margem
 * negativa: o dedo acerta 28 px, e a linha em volta continua medindo o mesmo.
 */
export function CaixaDeSelecao({
  checked,
  indeterminate = false,
  onChange,
  'aria-label': ariaLabel,
  disabled,
  id,
  className,
  children,
  ref,
}: {
  checked: boolean
  /** "Alguns": a caixa de cima de uma lista em que só parte está marcada. */
  indeterminate?: boolean
  onChange: (checked: boolean) => void
  /** Obrigatório: a caixa não tem texto, e sem ele o leitor de tela diz só "caixa". */
  'aria-label': string
  disabled?: boolean
  id?: string
  className?: string
  /**
   * Texto à vista ao lado da caixa. Fica dentro do mesmo `<label>`: texto ao
   * lado de caixa se lê como rótulo dela, e clicar nele tem de marcar.
   */
  children?: ReactNode
  ref?: Ref<HTMLInputElement>
}) {
  const interno = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => interno.current as HTMLInputElement, [])

  // `indeterminate` só existe como propriedade do elemento, nunca como
  // atributo, então o React não tem como escrevê-lo. Roda a cada render de
  // propósito: o clique zera a propriedade no DOM mesmo quando a prop não muda,
  // e um efeito preso à prop deixaria a caixa dizendo "todos" sem ser.
  useLayoutEffect(() => {
    if (interno.current) interno.current.indeterminate = indeterminate
  })

  const cheia = checked || indeterminate
  const Icone = indeterminate ? Minus : Check

  return (
    <label
      className={cn(
        'group inline-flex shrink-0 items-center gap-2',
        disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer',
        className,
      )}
    >
      <span className="relative -m-1.5 inline-flex size-7 shrink-0 items-center justify-center">
        <input
          ref={interno}
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-label={ariaLabel}
          onChange={(event) => onChange(event.target.checked)}
          className={cn(
            'size-4 cursor-[inherit] appearance-none rounded-[min(3px,var(--radius-control))] border transition-colors duration-100',
            cheia
              ? 'bg-accent border-accent'
              : 'bg-surface border-border-strong group-hover:border-fg-subtle',
          )}
        />
        {cheia && (
          <Icone
            aria-hidden
            strokeWidth={3}
            className="text-accent-fg pointer-events-none absolute size-3"
          />
        )}
      </span>
      {children}
    </label>
  )
}
