/**
 * A fazer: a tarefa avulsa e a que estava perdida no caderno.
 *
 * Mora em Rotina porque é a mesma pergunta que os hábitos respondem, "o que eu
 * tenho que fazer", só que uma vez em vez de toda semana. E porque a Agenda,
 * que é a vizinha, é onde o prazo aparece.
 *
 * A lista mistura de propósito o que se escreve aqui e o `- [ ]` escrito no
 * meio de uma anotação de aula. Marcar aqui marca lá: são a mesma tarefa vista
 * de dois lugares, não duas.
 *
 * O quadro tem duas colunas e o cartão vai de uma para a outra arrastado. O
 * arrasto é o do próprio navegador, sem biblioteca: são dois destinos e um
 * estado booleano, e um pacote de drag-and-drop custaria mais peso do que o
 * problema tem. Como o arrasto nativo não existe em tela de toque, cada cartão
 * mantém a caixa clicável, que também é o caminho de quem usa teclado.
 */

import { Check, ListTodo, NotebookPen, Plus, Trash2, Undo2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/field'
import { Badge, EmptyState, Stat } from '@/components/ui/misc'
import { Modal } from '@/components/ui/modal'
import { PageHeader } from '@/components/ui/page-header'
import { useHiddenTasks, useNotes, useTasks } from '@/data/queries'
import { formatoDaNota } from '@/lib/education/formato'
import {
  alternarTarefaDaNota,
  removerTarefaDaNota,
  tarefasDe,
} from '@/lib/education/tarefas-da-nota'
import {
  montarLista,
  mudaDeColuna,
  prazoEmPalavras,
  resumir,
  semAsOcultas,
  separarEmColunas,
  type ColunaDeTarefa,
  type ItemDeTarefa,
} from '@/lib/routine/tarefas'
import { today } from '@/lib/dates'
import { cn } from '@/lib/utils'

/** O que viaja no arrasto: a chave do cartão, que é única na lista inteira. */
const FORMATO = 'text/x-life-tarefa'

export function TarefasPage() {
  const { data: tasks, create, update, remove } = useTasks()
  const { data: notes, update: updateNote } = useNotes()
  const { data: ocultas, create: ocultar } = useHiddenTasks()
  const navigate = useNavigate()

  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')
  /** Coluna sob o cartão que está sendo arrastado, para ela se acender. */
  const [alvo, setAlvo] = useState<ColunaDeTarefa | null>(null)
  /** Cartão do caderno esperando a resposta de "excluir de onde?". */
  const [excluindo, setExcluindo] = useState<ItemDeTarefa | null>(null)

  const hoje = today()

  const lista = useMemo(
    () =>
      montarLista(
        tasks,
        notes.map((nota) => ({ id: nota.id, title: nota.title, tarefas: tarefasDe(nota) })),
      ),
    [tasks, notes],
  )

  const noQuadro = semAsOcultas(lista, ocultas)
  const resumo = resumir(noQuadro, hoje)
  const quadro = separarEmColunas(noQuadro)

  function criar() {
    const texto = titulo.trim()
    if (!texto) return
    create.mutate({ title: texto, done: false, date: prazo || null, notes: null })
    setTitulo('')
    setPrazo('')
  }

  /**
   * Marcar, venha de onde vier.
   *
   * Na tarefa do caderno, o que muda é o texto da anotação, e por posição,
   * nunca por nome. Divergindo a contagem, nada é escrito: a anotação pode ter
   * sido editada entre ver a lista e clicar nela, e marcar a tarefa errada em
   * silêncio é pior do que o clique não funcionar.
   */
  function alternar(item: ItemDeTarefa) {
    if (item.origem.tipo === 'propria') {
      update.mutate({ id: item.origem.id, patch: { done: !item.feita } })
      return
    }

    const nota = notes.find((n) => n.id === item.origem.id)
    if (!nota) return

    const conteudo = alternarTarefaDaNota(
      nota.content,
      formatoDaNota(nota),
      item.origem.ordinal,
      item.feita,
    )
    if (conteudo !== null) updateNote.mutate({ id: nota.id, patch: { content: conteudo } })
  }

  /**
   * Tira do quadro, sem tocar na anotação.
   *
   * Só vale para a tarefa que veio do caderno. A escrita aqui na tela existe
   * só no quadro, então para ela não há dois lugares de onde excluir.
   */
  function tirarDoQuadro(item: ItemDeTarefa) {
    if (item.origem.tipo !== 'nota') return
    ocultar.mutate({ nota: item.origem.id, texto: item.titulo })
    setExcluindo(null)
  }

  /**
   * Apaga a caixinha de dentro da anotação, e com ela o cartão.
   *
   * A trava é o texto: a anotação pode ter sido editada entre a tela listar a
   * tarefa e a pessoa confirmar aqui, e apagar a linha errada de um caderno não
   * tem desfazer. Não batendo, nada é escrito e o aviso fica.
   */
  function apagarDosDoisLugares(item: ItemDeTarefa) {
    if (item.origem.tipo !== 'nota') return
    const nota = notes.find((n) => n.id === item.origem.id)
    if (!nota) return

    const conteudo = removerTarefaDaNota(
      nota.content,
      formatoDaNota(nota),
      item.origem.ordinal,
      item.titulo,
    )
    if (conteudo === null) return

    updateNote.mutate({ id: nota.id, patch: { content: conteudo } })
    setExcluindo(null)
  }

  function soltar(chave: string, coluna: ColunaDeTarefa) {
    setAlvo(null)
    const item = noQuadro.find((candidato) => candidato.chave === chave)
    if (item && mudaDeColuna(item, coluna)) alternar(item)
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
        <Stat label="Pendentes" value={String(resumo.pendentes)} />
        <Stat
          label="Atrasadas"
          value={String(resumo.atrasadas)}
          tone={resumo.atrasadas > 0 ? 'negative' : undefined}
        />
        <Stat label="Vindas do caderno" value={String(resumo.doCaderno)} />
      </div>

      <Card className="shrink-0">
        <CardContent className="flex flex-wrap items-center gap-2">
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') criar()
            }}
            placeholder="O que precisa ser feito?"
            className="min-w-[14rem] flex-1"
          />
          <Input
            type="date"
            value={prazo}
            onChange={(e) => setPrazo(e.target.value)}
            className="w-40"
            aria-label="Prazo (opcional)"
          />
          <Button onClick={criar} disabled={titulo.trim() === ''}>
            <Plus />
            Adicionar
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-2">
        <Coluna
          coluna="pendentes"
          titulo="A fazer"
          itens={quadro.pendentes}
          hoje={hoje}
          aceso={alvo === 'pendentes'}
          onEntrar={setAlvo}
          onSair={() => setAlvo(null)}
          onSoltar={soltar}
          onAlternar={alternar}
          onAbrirNota={(id) => navigate(`/caderno?nota=${id}`)}
          onRemover={(id) => remove.mutate(id)}
          onExcluirVinculada={setExcluindo}
          vazio="Nada pendente. Escreva acima o que precisa ser feito."
        />
        <Coluna
          coluna="feitas"
          titulo="Feitas"
          itens={quadro.feitas}
          hoje={hoje}
          aceso={alvo === 'feitas'}
          onEntrar={setAlvo}
          onSair={() => setAlvo(null)}
          onSoltar={soltar}
          onAlternar={alternar}
          onAbrirNota={(id) => navigate(`/caderno?nota=${id}`)}
          onRemover={(id) => remove.mutate(id)}
          onExcluirVinculada={setExcluindo}
          vazio="Arraste um cartão para cá quando terminar."
        />
      </div>

      {/*
        Excluir uma tarefa do caderno tem dois destinos, e só quem escreveu sabe
        qual quer: a caixinha pode ser lixo de verdade ou pode ser conteúdo da
        aula que só não devia estar no quadro. Perguntar é mais barato do que
        apagar texto de alguém por conta própria.
      */}
      <Modal
        open={excluindo !== null}
        onClose={() => setExcluindo(null)}
        title="Excluir de onde?"
        description={
          excluindo?.origem.tipo === 'nota'
            ? `“${excluindo.titulo}” está escrita na anotação ${excluindo.origem.titulo || 'sem título'}.`
            : undefined
        }
        footer={
          <Button variant="ghost" onClick={() => setExcluindo(null)}>
            Cancelar
          </Button>
        }
      >
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => excluindo && tirarDoQuadro(excluindo)}
            className="border-border-base hover:border-accent w-full rounded-[var(--radius-control)] border p-3 text-left transition-colors"
          >
            <p className="text-fg text-sm font-medium">Só do A fazer</p>
            <p className="text-fg-muted mt-0.5 text-xs">
              O cartão sai do quadro e a caixinha continua escrita na anotação, do jeito que está.
              Dá para devolver depois.
            </p>
          </button>

          <button
            type="button"
            onClick={() => excluindo && apagarDosDoisLugares(excluindo)}
            className="border-border-base hover:border-negative w-full rounded-[var(--radius-control)] border p-3 text-left transition-colors"
          >
            <p className="text-negative text-sm font-medium">Nos dois lugares</p>
            <p className="text-fg-muted mt-0.5 text-xs">
              Apaga a linha de dentro da anotação também. Isso não tem desfazer.
            </p>
          </button>
        </div>
      </Modal>

    </div>
  )
}

function Coluna({
  coluna,
  titulo,
  itens,
  hoje,
  aceso,
  onEntrar,
  onSair,
  onSoltar,
  onAlternar,
  onAbrirNota,
  onRemover,
  onExcluirVinculada,
  vazio,
}: {
  coluna: ColunaDeTarefa
  titulo: string
  itens: ItemDeTarefa[]
  hoje: string
  /** Verdadeiro enquanto um cartão paira sobre esta coluna. */
  aceso: boolean
  onEntrar: (coluna: ColunaDeTarefa) => void
  onSair: () => void
  onSoltar: (chave: string, coluna: ColunaDeTarefa) => void
  onAlternar: (item: ItemDeTarefa) => void
  onAbrirNota: (id: string) => void
  onRemover: (id: string) => void
  onExcluirVinculada: (item: ItemDeTarefa) => void
  vazio: string
}) {
  /*
    A cor sai da coluna, não do módulo. O accent da Rotina é vermelho, e pintar
    a coluna do que falta fazer de vermelho dizia "isto está errado" sobre uma
    tarefa que só não chegou a vez. Azul para o que está em aberto, verde para o
    que saiu, e a área de solta se acende na cor da coluna em que o cartão vai
    cair — antes as duas acendiam no mesmo vermelho e não davam pista nenhuma.
  */
  const feita = coluna === 'feitas'
  const cor = feita
    ? { trilho: 'border-positive/60', etiqueta: 'bg-positive/15 text-positive', solta: 'bg-positive/10' }
    : { trilho: 'border-pending/60', etiqueta: 'bg-pending/15 text-pending', solta: 'bg-pending/10' }

  return (
    <section
      onDragOver={(event) => {
        // Sem o preventDefault o navegador recusa a solta e o cartão volta.
        event.preventDefault()
        event.dataTransfer.dropEffect = 'move'
        if (!aceso) onEntrar(coluna)
      }}
      onDragLeave={(event) => {
        // Sair para um filho ainda é estar dentro da coluna.
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onSair()
      }}
      onDrop={(event) => {
        event.preventDefault()
        const chave = event.dataTransfer.getData(FORMATO)
        if (chave) onSoltar(chave, coluna)
      }}
      /*
        A coluna não é uma caixa. O trilho colorido embaixo do título é o que
        marca o território, e a área de solta só se pinta enquanto um cartão
        paira sobre ela: fora disso não há moldura nenhuma disputando atenção
        com os cartões, que são o conteúdo de verdade.
      */
      className={cn(
        'flex flex-col rounded-[var(--radius-card)] p-2 transition-colors lg:min-h-0',
        aceso ? cor.solta : 'bg-transparent',
      )}
    >
      <header
        className={cn(
          'mb-3 flex shrink-0 items-baseline gap-2 border-b-2 px-1 pb-2',
          cor.trilho,
        )}
      >
        <h2 className="text-fg text-sm font-semibold tracking-[-0.008em]">{titulo}</h2>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
            cor.etiqueta,
          )}
        >
          {itens.length}
        </span>
      </header>

      {itens.length === 0 ? (
        <div className="px-1 pb-2">
          <EmptyState icon={<ListTodo className="size-5" />} title="Vazio" description={vazio} />
        </div>
      ) : (
        <ul className="space-y-2.5 overflow-y-auto pr-1 lg:min-h-0 lg:flex-1">
          {itens.map((item) => (
            <Cartao
              key={item.chave}
              item={item}
              hoje={hoje}
              onAlternar={() => onAlternar(item)}
              onAbrirNota={
                item.origem.tipo === 'nota' ? () => onAbrirNota(item.origem.id) : undefined
              }
              onRemover={
                item.origem.tipo === 'propria'
                  ? () => onRemover((item.origem as { id: string }).id)
                  : undefined
              }
              onRemoverVinculada={
                item.origem.tipo === 'nota' ? () => onExcluirVinculada(item) : undefined
              }
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function Cartao({
  item,
  hoje,
  onAlternar,
  onAbrirNota,
  onRemover,
  onRemoverVinculada,
}: {
  item: ItemDeTarefa
  hoje: string
  onAlternar: () => void
  onAbrirNota?: () => void
  onRemover?: () => void
  /** Só na tarefa vinda do caderno, onde excluir tem dois destinos possíveis. */
  onRemoverVinculada?: () => void
}) {
  const [arrastando, setArrastando] = useState(false)
  const atrasada = !item.feita && item.data !== null && item.data < hoje

  return (
    <li
      draggable
      onDragStart={(event) => {
        event.dataTransfer.setData(FORMATO, item.chave)
        event.dataTransfer.effectAllowed = 'move'
        setArrastando(true)
      }}
      onDragEnd={() => setArrastando(false)}
      className={cn(
        'group bg-surface flex cursor-grab items-start gap-2.5 rounded-[var(--radius-card)] p-3.5 shadow-[var(--shadow-card)] transition-[opacity,transform]',
        'hover:-translate-y-px active:cursor-grabbing',
        arrastando && 'opacity-40',
      )}
    >
      <button
        type="button"
        onClick={onAlternar}
        aria-label={item.feita ? 'Devolver para A fazer' : 'Marcar como feita'}
        aria-pressed={item.feita}
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border transition-colors',
          item.feita
            ? 'border-positive bg-positive text-accent-fg'
            : 'border-border-strong hover:border-pending',
        )}
      >
        {item.feita ? <Check className="size-3.5" /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn('text-sm', item.feita ? 'text-fg-subtle line-through' : 'text-fg')}>
          {item.titulo}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {item.data && (
            <Badge tone={atrasada ? 'negative' : 'neutral'}>
              {prazoEmPalavras(item.data, hoje)}
            </Badge>
          )}
          {item.origem.tipo === 'nota' && (
            <button
              type="button"
              onClick={onAbrirNota}
              className="text-fg-subtle hover:text-fg flex items-center gap-1 text-[11px] transition-colors"
            >
              <NotebookPen className="size-3" />
              {item.origem.titulo || 'Sem título'}
            </button>
          )}
        </div>
      </div>

      {/*
        O desfazer fica só na coluna das feitas: é onde ele resolve alguma
        coisa, e num cartão pendente seria um botão que repete a caixa ao lado.
      */}
      {item.feita && (
        <button
          type="button"
          onClick={onAlternar}
          aria-label="Devolver para A fazer"
          title="Devolver para A fazer"
          className="text-fg-subtle hover:text-fg shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Undo2 className="size-3.5" />
        </button>
      )}

      {onRemoverVinculada && (
        <button
          type="button"
          onClick={onRemoverVinculada}
          aria-label="Excluir tarefa"
          title="Excluir"
          className="text-fg-subtle hover:text-negative shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}

      {onRemover && (
        <button
          type="button"
          onClick={onRemover}
          aria-label="Remover tarefa"
          className="text-fg-subtle hover:text-negative shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </button>
      )}
    </li>
  )
}
