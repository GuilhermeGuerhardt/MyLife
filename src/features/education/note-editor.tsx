import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/field'
import { Badge } from '@/components/ui/misc'
import type { Note, Program, Track } from '@/data/types'
import { confirmar } from '@/lib/avisos'
import type { Retrolink } from '@/lib/education/links'
import {
  contarPalavras,
  formatoDaNota,
  markdownParaHtml,
  textoPuro,
} from '@/lib/education/formato'
import { alternarTarefa } from '@/lib/education/tarefas'
import { lazyRoute } from '@/lib/lazy-route'
import { cn } from '@/lib/utils'
import { exportarNota } from './exportar-nota'
import { CabecalhoDaNota } from './note/cabecalho-da-nota'
import { DestinoDaNota, SEM_CURSO } from './note/destino-da-nota'
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
      <CabecalhoDaNota
        titulo={form.title}
        onTitulo={(titulo) => set({ title: titulo })}
        mode={mode}
        onModeChange={onModeChange}
        formato={formato}
        fixada={note.pinned}
        naJanela={naJanela}
        onVoltar={onBack}
        onAbrirEmJanela={aoAbrirEmJanela}
        onExportar={(saida) => {
          void exportarNota(form.title || 'Anotação', form.content, formato, saida)
        }}
        onConverter={() => void converterParaFormatado()}
        onFixar={() => onSave({ pinned: !note.pinned })}
        onRemover={onRemove}
      />

      {/* Onde a anotação mora e as etiquetas: decisão que se toma ao lado da
          lista, não no meio de escrever. Na janela, some e vira texto. */}
      {!naJanela && (
        <DestinoDaNota
          onde={ondeAtual}
          onTrocarOnde={mudarOnde}
          academicos={academicos}
          cursos={cursos}
          disciplinas={subjects}
          comDisciplina={form.track === 'academic' && Boolean(form.program_id)}
          disciplina={form.subject_id}
          onDisciplina={(id) => set({ subject_id: id })}
          etiquetas={form.tags}
          onEtiquetas={(texto) => set({ tags: texto })}
        />
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

      <div className="border-border-base text-fg-subtle flex shrink-0 items-center justify-between border-t px-4 py-2 text-xs">
        <span>{words} palavras</span>
        <Badge tone={saved ? 'neutral' : 'accent'}>{saved ? 'Salvo' : 'Salvando...'}</Badge>
      </div>
    </Card>
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
