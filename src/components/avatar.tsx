import { iniciais } from '@/lib/avatar'
import { cn } from '@/lib/utils'

/**
 * Foto da pessoa, com dois recuos quando ela não existe: as iniciais do nome e,
 * sem nome, o quadrado da cor de destaque — que era o que o menu mostrava antes
 * de o perfil existir. Assim o topo do menu nunca fica vazio.
 */
export function Avatar({
  url,
  name,
  className,
  textClassName,
}: {
  url: string | null | undefined
  name: string
  className?: string
  textClassName?: string
}) {
  const letras = iniciais(name)

  if (url) {
    return (
      <img
        src={url}
        alt={name ? `Foto de ${name}` : 'Foto de perfil'}
        className={cn('shrink-0 rounded-md object-cover', className)}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'bg-accent text-accent-fg flex shrink-0 items-center justify-center rounded-md font-semibold',
        className,
      )}
    >
      <span className={textClassName}>{letras}</span>
    </span>
  )
}
