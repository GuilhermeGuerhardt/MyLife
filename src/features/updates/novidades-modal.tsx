import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { marcarVersaoVista, novidadesDesde, versaoVista, type Novidade } from './novidades'

/**
 * O que mudou, na primeira abertura depois de atualizar.
 *
 * Quem instalou agora não vê nada: para essa pessoa o app inteiro é novo, e uma
 * lista de mudanças em relação a uma versão que ela nunca usou seria conversa
 * sobre um passado alheio. A primeira abertura só anota em que versão ela
 * entrou, e a partir da próxima atualização a lista faz sentido.
 */
export function useNovidades() {
  const [pendentes, setPendentes] = useState<Novidade[]>(() => {
    const vista = versaoVista()
    if (vista === null) {
      marcarVersaoVista(__VERSAO__)
      return []
    }
    return novidadesDesde(vista, __VERSAO__)
  })

  const fechar = () => {
    marcarVersaoVista(__VERSAO__)
    setPendentes([])
  }

  return { pendentes, fechar }
}

export function NovidadesModal({
  novidades,
  onFechar,
}: {
  novidades: Novidade[]
  onFechar: () => void
}) {
  const uma = novidades.length === 1

  return (
    <Modal
      open={novidades.length > 0}
      onClose={onFechar}
      title={uma ? `Novidades da ${novidades[0]!.versao}` : 'O que mudou desde a sua versão'}
      description={uma ? novidades[0]!.titulo : undefined}
      footer={<Button onClick={onFechar}>Entendi</Button>}
    >
      <div className="space-y-5">
        {novidades.map((novidade) => (
          <section key={novidade.versao}>
            {!uma && (
              <div className="mb-2 flex items-baseline gap-2">
                <h3 className="text-fg text-sm font-semibold">{novidade.versao}</h3>
                <span className="text-fg-subtle text-xs">{novidade.titulo}</span>
              </div>
            )}
            <ul className="space-y-2">
              {novidade.itens.map((item) => (
                <li key={item} className="flex gap-2.5">
                  <Sparkles className="text-accent mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span className="text-fg-muted text-sm leading-relaxed">{item}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  )
}
