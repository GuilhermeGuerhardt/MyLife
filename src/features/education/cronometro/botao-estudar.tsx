import { Play, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { AlvoDoEstudo } from '@/lib/education/cronometro'
import { useCronometro } from './use-cronometro'

/**
 * Começa o cronômetro para uma disciplina ou um curso.
 *
 * Quando o cronômetro já é deste alvo, o botão diz isso em vez de recomeçar: um
 * segundo clique zerando a contagem apagaria o estudo que estava correndo.
 */
export function BotaoEstudar({
  alvo,
  size = 'sm',
  variant = 'secondary',
}: {
  alvo: AlvoDoEstudo
  size?: 'sm' | 'md'
  variant?: 'secondary' | 'ghost'
}) {
  const { estado, comecar } = useCronometro()
  const esteAlvo =
    estado !== null &&
    estado.program_id === alvo.program_id &&
    estado.subject_id === alvo.subject_id

  if (esteAlvo) {
    return (
      <Button variant={variant} size={size} disabled>
        <Timer />
        Estudando
      </Button>
    )
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={() => void comecar(alvo)}
      title={estado ? `Encerra ${estado.rotulo} e começa ${alvo.rotulo}` : undefined}
    >
      <Play />
      Estudar
    </Button>
  )
}
