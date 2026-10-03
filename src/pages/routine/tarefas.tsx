/**
 * A fazer: a tarefa avulsa e a que estava perdida no caderno.
 *
 * Mora em Rotina porque é a mesma pergunta que os hábitos respondem, "o que eu
 * tenho que fazer", só que uma vez em vez de toda semana. E porque a Agenda,
 * que é a vizinha, é onde o prazo aparece.
 *
 * O quadro mistura de propósito o que se escreve aqui e o `- [ ]` escrito no
 * meio de uma anotação de aula. Marcar aqui marca lá: são a mesma tarefa vista
 * de dois lugares, não duas.
 *
 * Esta tela compõe; quem sabe das tarefas é `use-quadro-de-tarefas`, e o cartão,
 * a coluna e o diálogo de exclusão moram em `features/routine`.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Stat } from '@/components/ui/misc'
import { PageHeader } from '@/components/ui/page-header'
import { ColunaDoQuadro } from '@/features/routine/coluna-de-tarefas'
import { ExcluirDeOnde } from '@/features/routine/excluir-de-onde'
import { NovaTarefa } from '@/features/routine/nova-tarefa'
import { useQuadroDeTarefas } from '@/features/routine/use-quadro-de-tarefas'
import type { ColunaDeTarefa } from '@/lib/routine/tarefas'

export function TarefasPage() {
  const quadro = useQuadroDeTarefas()
  const navigate = useNavigate()

  /** Coluna sob o cartão que está sendo arrastado, para ela se acender. */
  const [alvo, setAlvo] = useState<ColunaDeTarefa | null>(null)

  const comum = {
    hoje: quadro.hoje,
    onEntrar: setAlvo,
    onSair: () => setAlvo(null),
    onSoltar: quadro.soltar,
    onAlternar: quadro.alternar,
    onAbrirNota: (id: string) => navigate(`/caderno?nota=${id}`),
    onRemover: quadro.remover,
    onExcluirVinculada: quadro.pedirExclusao,
  }

  return (
    /*
      Cabeçalho, números e o campo de escrever ficam parados; rolam só as
      colunas, cada uma por conta própria. Numa lista de quarenta tarefas, o
      campo de adicionar saía da tela e escrever a próxima virava rolar de volta
      até o topo. A altura fixa vale do desktop para cima: no celular a tela
      inteira rola, que é o que se espera lá.
    */
    <div className="flex flex-col gap-5 lg:h-[calc(100dvh-7.5rem)]">
      <PageHeader
        title="A fazer"
        description="O que precisa ser feito uma vez, mais as caixinhas que você escreveu dentro das anotações. Arraste o cartão de um lado para o outro, ou clique na caixa."
      />

      <div className="grid shrink-0 gap-3 sm:grid-cols-3">
        <Stat label="Pendentes" value={String(quadro.resumo.pendentes)} />
        <Stat
          label="Atrasadas"
          value={String(quadro.resumo.atrasadas)}
          tone={quadro.resumo.atrasadas > 0 ? 'negative' : undefined}
        />
        <Stat label="Vindas do caderno" value={String(quadro.resumo.doCaderno)} />
      </div>

      <NovaTarefa onCriar={quadro.criar} />

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-2">
        <ColunaDoQuadro
          {...comum}
          coluna="pendentes"
          titulo="A fazer"
          itens={quadro.quadro.pendentes}
          aceso={alvo === 'pendentes'}
          vazio="Nada pendente. Escreva acima o que precisa ser feito."
        />
        <ColunaDoQuadro
          {...comum}
          coluna="feitas"
          titulo="Feitas"
          itens={quadro.quadro.feitas}
          aceso={alvo === 'feitas'}
          vazio="Arraste um cartão para cá quando terminar."
        />
      </div>

      <ExcluirDeOnde
        item={quadro.excluindo}
        onFechar={quadro.cancelarExclusao}
        onSoDoQuadro={quadro.tirarDoQuadro}
        onNosDoisLugares={quadro.apagarDosDoisLugares}
      />
    </div>
  )
}
