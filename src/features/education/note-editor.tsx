import { ArrowLeft, Download, ExternalLink, Eye, Pen, Pin, Trash2, Type } from 'lucide-react'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Button, buttonStyles } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Badge, Segmented } from '@/components/ui/misc'
import type { Note, Program, Track } from '@/data/types'
import { confirmar } from '@/lib/avisos'
import type { Retrolink } from '@/lib/education/links'
import {
  contarPalavras,
  formatoDaNota,
  markdownParaHtml,
  textoPuro,
  type FormatoDaNota,
} from '@/lib/education/formato'
import { alternarTarefa } from '@/lib/education/tarefas'
import { lazyRoute } from '@/lib/lazy-route'
import { useMenuFlutuante } from '@/components/ui/use-menu-flutuante'
import { cn } from '@/lib/utils'
import {
  exportarNota,
  ROTULOS,
  saidasPossiveis,
  type FormatoDeSaida,
} from './exportar-nota'
import { LinkSuggestions, useLinkAutocomplete } from './link-autocomplete'
import { Markdown } from './markdown'
import { NoteBacklinks } from './note-backlinks'
import { NoteHtml } from './note-html'
/*
  O editor formatado é o pedaço mais pesado do app — ele traz o TipTap inteiro
  junto. Abrir uma anotação para ler não precisa de nada disso, e ler é o que
  mais se faz: agora ele só desce quando a pessoa entra no modo de edição.

  Vai pelo `lazyRoute` e não pelo `lazy` do React para herdar a recuperação de
  chunk que sumiu — depois de uma atualização, a aba antiga pede um arquivo que
  não existe mais, e sem isso o editor abriria em branco.
*/
const RichEditor = lazyRoute(() =>
  import('./rich-editor').then((modulo) => ({ default: modulo.RichEditor })),
)

export type NoteMode = 'edit' | 'preview'

/**
 * O esqueleto de uma anotação nova — a folha em branco trava mais que ajuda.
 *
 * Em HTML, porque anotação nova nasce no editor formatado. Quem prefere
 * Markdown continua trocando anotação por anotação, e as antigas não são
 * tocadas.
 */
export const NOTE_TEMPLATE = `<h2>Resumo</h2><p></p><h2>Pontos principais</h2><ul><li><p></p></li></ul><h2>Dúvidas</h2><ul><li><p></p></li></ul><h2>Para revisar</h2><p></p>`

/** Pausa na digitação antes de gravar sozinho. */
const AUTOSAVE_MS = 800

/** O valor do select "Onde" quando a anotação não pertence a curso nenhum. */
/**
 * Os dois destinos que não são curso.
 *
 * O prefixo esquisito é de propósito: o valor do select ou é um id de curso ou
 * é um destes, e um id nunca começa com underscore.
 */
const SEM_CURSO: Array<{ valor: string; track: Track; rotulo: string }> = [
  { valor: '__estudos__', track: 'free', rotulo: 'Estudo livre' },
  { valor: '__anotacoes__', track: 'personal', rotulo: 'Anotações' },
]

export function NoteEditor({
  note,
  mode,
  onModeChange,
  programs,
  subjects,
  onBack,
  onSave,
  onRemove,
  backlinks,
  onAbrirNota,
  onAbrirPorTitulo,
  existeNota,
  titulosDisponiveis,
  nomeDoCurso,
  variante = 'painel',
  aoAbrirEmJanela,
}: {
  note: Note
  /** Vem de fora: o editor remonta a cada troca de anotação, o modo não. */
  mode: NoteMode
  onModeChange: (mode: NoteMode) => void
  /** Todos os cursos, dos dois trilhos — o select agrupa por conta. */
  programs: Program[]
  /** Disciplinas do curso escolhido. */
  subjects: Array<{ id: string; name: string }>
  onBack: () => void
  onSave: (patch: Partial<Note>) => void
  onRemove: () => void
  backlinks: Array<Retrolink<Note>>
  onAbrirNota: (id: string) => void
  onAbrirPorTitulo: (titulo: string) => void
  existeNota: (titulo: string) => boolean
  titulosDisponiveis: Array<{ id: string; title: string }>
  nomeDoCurso: (note: Note) => string | null
  /**
   * `janela` é o mesmo editor sem a mobília que só faz sentido ao lado da
   * lista: voltar, escolher onde a anotação mora, ver quem a menciona. Numa
   * janela só de escrever, cada uma dessas linhas é espaço tirado do texto.
   */
  variante?: 'painel' | 'janela'
  /** Ausente na própria janela — de lá não há o que destacar. */
  aoAbrirEmJanela?: () => void
}) {
  const [form, setForm] = useState({
    title: note.title,
    content: note.content,
    program_id: note.program_id ?? '',
    subject_id: note.subject_id ?? '',
    tags: note.tags.join(', '),
    track: note.track,
    format: formatoDaNota(note),
  })
  const [saved, setSaved] = useState(true)

  const patch = useMemo(
    (): Partial<Note> => ({
      title: form.title,
      content: form.content,
      format: form.format,
      track: form.track,
      program_id: form.program_id || null,
      subject_id: form.subject_id || null,
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim().replace(/^#/, ''))
        .filter(Boolean),
    }),
    [form],
  )

  // `onSave` é recriado a cada render do caderno — trocar de modo, um refetch
  // da lista. Deixá-lo nas dependências do temporizador faria cada um desses
  // renders reiniciar a contagem, e o salvamento ficaria sempre 800 ms adiante.
  const salvar = useRef(onSave)
  useEffect(() => {
    salvar.current = onSave
  }, [onSave])

  // Salva sozinho depois de uma pausa na digitação — anotação perdida por
  // esquecer de salvar é a forma mais rápida de abandonar um caderno.
  useEffect(() => {
    if (saved) return
    const timer = setTimeout(() => {
      salvar.current(patch)
      setSaved(true)
    }, AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [patch, saved])

  const set = (values: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...values }))
    setSaved(false)
  }

  const auto = useLinkAutocomplete({
    value: form.content,
    onChange: (texto) => set({ content: texto }),
    notas: titulosDisponiveis,
  })

  /**
   * Marcar uma tarefa na leitura entra pelo mesmo `set` da digitação: a
   * anotação fica "Salvando..." e é gravada pelo temporizador de sempre. Um
   * segundo caminho de gravação seria um segundo lugar para esquecer de salvar.
   *
   * O modo não muda — quem clicou numa caixa quer riscar o item, não editar.
   */
  const alternarTarefaNoTexto = (ordinal: number, estavaMarcada: boolean) => {
    const novo = alternarTarefa(form.content, ordinal, estavaMarcada)
    // `null` = a contagem não bateu com o texto. Melhor não fazer nada do que
    // marcar a tarefa errada.
    if (novo !== null) set({ content: novo })
  }

  /**
   * Marca a enésima caixa do HTML.
   *
   * O `data-checked` do TipTap acompanha o `checked` do input — os dois
   * precisam concordar, ou o editor reabre a tarefa como estava antes.
   */
  const alternarTarefaNoHtml = (ordinal: number, estavaMarcada: boolean) => {
    const doc = new DOMParser().parseFromString(form.content, 'text/html')
    const caixa = doc.querySelectorAll('input[type="checkbox"]')[ordinal]
    if (!caixa) return

    const agora = !estavaMarcada
    if (agora) caixa.setAttribute('checked', '')
    else caixa.removeAttribute('checked')
    caixa.closest('li')?.setAttribute('data-checked', String(agora))

    set({ content: doc.body.innerHTML })
  }

  /**
   * Passa a anotação de Markdown para o editor formatado.
   *
   * Só acontece a pedido, uma anotação por vez: converter o caderno inteiro de
   * uma vez seria reescrever o texto de alguém em massa, sem volta.
   */
  const converterParaFormatado = async () => {
    const aviso =
      'Esta anotação passa a ser editada com formatação, como num editor de texto.\n\n' +
      'O conteúdo é convertido uma vez e o Markdown deixa de valer nela — as outras anotações não são tocadas.'
    if (!(await confirmar(aviso, { confirmar: 'Converter' }))) return
    set({ content: markdownParaHtml(form.content), format: 'html' })
    onModeChange('edit')
  }

  /** O select "Onde": um curso, estudo livre ou anotação solta. O trilho vem junto. */
  const mudarOnde = (valor: string) => {
    const semCurso = SEM_CURSO.find((opcao) => opcao.valor === valor)
    if (semCurso) {
      set({ track: semCurso.track, program_id: '', subject_id: '' })
      return
    }
    const program = programs.find((p) => p.id === valor)
    if (!program) return
    set({ track: program.track, program_id: program.id, subject_id: '' })
  }

  const formato = form.format
  const academicos = programs.filter((p) => p.track === 'academic')
  const cursos = programs.filter((p) => p.track === 'course')
  const ondeAtual =
    form.program_id || (SEM_CURSO.find((opcao) => opcao.track === form.track)?.valor ?? '')
  const words = contarPalavras(form.content, formato)
  const naJanela = variante === 'janela'

  return (
    <Card
      className={cn(
        'flex flex-col',
        naJanela ? 'h-full min-h-0 rounded-none border-0' : 'min-h-[70vh] lg:h-full lg:min-h-0',
      )}
    >
      <div className="border-border-base flex shrink-0 flex-wrap items-center gap-2 border-b px-4 py-3">
        {!naJanela && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="lg:hidden"
            aria-label="Voltar"
          >
            <ArrowLeft />
          </Button>
        )}
        <Input
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Título da anotação"
          /* Largura mínima para o título não ser espremido a nada: numa janela
             estreita a fila de botões quebra para a linha de baixo, em vez de
             engolir o nome da anotação. */
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
        {aoAbrirEmJanela && (
          <Button
            variant="ghost"
            size="icon"
            onClick={aoAbrirEmJanela}
            aria-label="Abrir em outra janela"
            title="Abrir em outra janela"
          >
            <ExternalLink />
          </Button>
        )}
        <MenuExportar
          formato={formato}
          onEscolher={(saida) => {
            void exportarNota(form.title || 'Anotação', form.content, formato, saida)
          }}
        />
        {/* Só nas anotações que ainda são Markdown: nas formatadas não há
            para onde converter, e o botão viraria enfeite. */}
        {formato === 'markdown' && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => void converterParaFormatado()}
            aria-label="Converter para texto formatado"
            title="Converter para texto formatado"
          >
            <Type />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onSave({ pinned: !note.pinned })}
          aria-label={note.pinned ? 'Desafixar' : 'Fixar no topo'}
          className={note.pinned ? 'text-accent' : undefined}
        >
          <Pin />
        </Button>
        {!naJanela && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              void confirmar('Remover esta anotação?', { confirmar: 'Remover' }).then((ok) => {
                if (ok) onRemove()
              })
            }}
            aria-label="Remover anotação"
          >
            <Trash2 />
          </Button>
        )}
      </div>

      {/* Onde a anotação mora e as etiquetas: decisão que se toma ao lado da
          lista, não no meio de escrever. Na janela, some e vira texto. */}
      {!naJanela && (
      <div className="border-border-base grid shrink-0 gap-3 border-b px-4 py-3 sm:grid-cols-3">
        <Field label="Onde">
          <Select value={ondeAtual} onChange={(e) => mudarOnde(e.target.value)}>
            {SEM_CURSO.map((opcao) => (
              <option key={opcao.valor} value={opcao.valor}>
                {opcao.rotulo}
              </option>
            ))}
            {/* A anotação antiga sem curso guarda o trilho dela: some da lista
                se for editada, mas até lá continua onde estava. */}
            {ondeAtual === '' && <option value="">Sem curso</option>}
            {academicos.length > 0 && (
              <optgroup label="Faculdade">
                {academicos.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </optgroup>
            )}
            {cursos.length > 0 && (
              <optgroup label="Cursos">
                {cursos.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </Field>

        {/* Disciplina só existe na faculdade: no curso livre ela ocupava
            espaço desabilitada, sem nunca ter o que oferecer. */}
        {form.track === 'academic' && form.program_id ? (
          <Field label="Disciplina">
            <Select value={form.subject_id} onChange={(e) => set({ subject_id: e.target.value })}>
              <option value="">Nenhuma</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}

        <Field label="Etiquetas" hint="Separadas por vírgula">
          <Input
            value={form.tags}
            onChange={(e) => set({ tags: e.target.value })}
            placeholder="prova, revisão"
          />
        </Field>
      </div>
      )}

      {/* O único pedaço que rola. A barra de formatação está dentro do editor,
          acima desta área, e por isso fica parada com o texto correndo. */}
      <CardContent className="relative flex min-h-0 flex-1 flex-col overflow-hidden p-0">
        {formato === 'html' ? (
          mode === 'edit' ? (
            <Suspense fallback={<CarregandoEditor />}>
              <RichEditor
                content={form.content}
                onChange={(html) => set({ content: html })}
                notas={titulosDisponiveis}
              />
            </Suspense>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {textoPuro(form.content, 'html').trim() ? (
                <NoteHtml
                  content={form.content}
                  onAbrirNota={onAbrirPorTitulo}
                  onAlternarTarefa={alternarTarefaNoHtml}
                  existeNota={existeNota}
                />
              ) : (
                <p className="text-fg-subtle text-sm">Nada escrito ainda.</p>
              )}
            </div>
          )
        ) : mode === 'edit' ? (
          <>
            <Textarea
              value={form.content}
              onChange={(e) => {
                set({ content: e.target.value })
                auto.sincronizar(e)
              }}
              onKeyDown={(e) => {
                if (auto.teclou(e)) e.preventDefault()
              }}
              onKeyUp={auto.sincronizar}
              onClick={auto.sincronizar}
              onBlur={auto.fechar}
              placeholder="Escreva em Markdown. Use [[ para ligar a outra anotação."
              className="min-h-[50vh] flex-1 resize-none overflow-y-auto rounded-none border-0 bg-transparent px-5 py-4 font-mono text-[13px] leading-relaxed lg:min-h-0"
            />
            {auto.aberto && (
              <LinkSuggestions
                opcoes={auto.opcoes}
                criar={auto.criar}
                termo={auto.termo}
                indice={auto.indice}
                onEscolher={auto.escolher}
              />
            )}
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            {form.content.trim() ? (
              <Markdown
                content={form.content}
                existeNota={existeNota}
                onAbrirNota={onAbrirPorTitulo}
                onAlternarTarefa={alternarTarefaNoTexto}
              />
            ) : (
              <p className="text-fg-subtle text-sm">Nada escrito ainda.</p>
            )}
          </div>
        )}
      </CardContent>

      {!naJanela && (
        <div className="shrink-0">
          <NoteBacklinks itens={backlinks} onAbrir={onAbrirNota} nomeDoCurso={nomeDoCurso} />
        </div>
      )}

      <div className="border-border-base text-fg-subtle flex shrink-0 items-center justify-between border-t px-4 py-2 text-[11px]">
        <span>{words} palavras</span>
        <Badge tone={saved ? 'neutral' : 'accent'}>{saved ? 'Salvo' : 'Salvando...'}</Badge>
      </div>
    </Card>
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

/**
 * O lugar do editor enquanto ele desce.
 *
 * Ocupa a altura da barra de formatação e do texto, para a tela não pular
 * quando ele chega. Sem a palavra "carregando": em disco local isso dura um
 * piscar, e um aviso que aparece e some incomoda mais do que um espaço parado.
 */
function CarregandoEditor() {
  return (
    <div aria-hidden className="flex min-h-0 flex-1 flex-col">
      <div className="border-border-base bg-surface-2 h-16 shrink-0 border-b" />
      <div className="min-h-0 flex-1 px-5 py-4">
        <div className="bg-surface-2 h-3.5 w-2/5 rounded" />
      </div>
    </div>
  )
}

export type { Track }
