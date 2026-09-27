import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { TUTORIAIS } from './conteudo'
import { aoMudarVisto, lerVisto, zerarVisto } from './visto'

/**
 * Trazer os guias de volta.
 *
 * O cartão de boas-vindas de cada módulo aparece uma vez e some para sempre —
 * mas quem pulou tudo no primeiro dia, ou quem voltou ao app meses depois, não
 * tem como pedir de novo sem um botão. Ele diz de quantos módulos já se
 * dispensou o guia para a escolha não ser às cegas.
 */
export function GuiasCard() {
  const [visto, setVisto] = useState(lerVisto)

  useEffect(() => aoMudarVisto(() => setVisto(lerVisto())), [])

  const lidos = visto.pulado ? TUTORIAIS.length : visto.rotas.length
  const tudo = TUTORIAIS.length

  return (
    <Card>
      <CardHeader
        title="Guias de uso"
        description="Na primeira visita, cada módulo abre com um cartão explicando o que ninguém descobre sozinho."
        action={
          lidos > 0 ? (
            <Button variant="ghost" onClick={zerarVisto}>
              Mostrar de novo
            </Button>
          ) : undefined
        }
      />
      <CardContent>
        <p className="text-fg-muted text-sm">
          {lidos === 0
            ? 'Nenhum foi dispensado ainda: eles vão aparecer conforme você entrar em cada módulo.'
            : `Dispensado em ${lidos} de ${tudo} módulos. O “?” no topo de cada tela reabre o guia dela quando quiser.`}
        </p>
      </CardContent>
    </Card>
  )
}
