import { ArrowLeft, Eye, Pen, Pin, Trash2, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Badge, Segmented } from '@/components/ui/misc'
import type { Note, Program, Track } from '@/data/types'
import { confirmar } from '@/lib/avisos'
import type { Retrolink } from '@/lib/education/links'
import { contarPalavras, formatoDaNota, markdownParaHtml, textoPuro } from '@/lib/education/formato'
import { alternarTarefa } from '@/lib/education/tarefas'
import { LinkSuggestions, useLinkAutocomplete } from './link-autocomplete'
import { Markdown } from './markdown'
import { NoteBacklinks } from './note-backlinks'
import { NoteHtml } from './note-html'
import { RichEditor } from './rich-editor'

export type NoteMode = 'edit' | 'preview'

/** O esqueleto de uma anotação nova — a folha em branco trava mais que ajuda. */
export const NOTE_TEMPLATE = `## Resumo

## Pontos principais

-

## Dúvidas

-

## Para revisar
`

/** Pausa na digitação antes de gravar sozinho. */
const AUTOSAVE_MS = 800

/** O valor do select "Onde" quando a anotação não pertence a curso nenhum. */
const LIVRE = '__livre__'

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

  /** O select "Onde": um curso, ou estudo livre. O trilho vem junto. */
  const mudarOnde = (valor: string) => {
    if (valor === LIVRE) {
      set({ track: 'free', program_id: '', subject_id: '' })
      return
    }
    const program = programs.find((p) => p.id === valor)
    if (!program) return
    set({ track: program.track, program_id: program.id, subject_id: '' })
  }

  const formato = form.format
  const academicos = programs.filter((p) => p.track === 'academic')
  const cursos = programs.filter((p) => p.track === 'course')
  const ondeAtual = form.program_id || (form.track === 'free' ? LIVRE : '')
  const words = contarPalavras(form.content, formato)

  return (
    <Card className="flex min-h-[70vh] flex-col">
      <div className="border-border-base flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="lg:hidden"
          aria-label="Voltar"
        >
          <ArrowLeft />
        </Button>
        <Input
          value={form.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Título da anotação"
          className="h-9 flex-1 border-transparent bg-transparent px-0 text-base font-semibold"
        />
        <Segmented
          value={mode}
          onChange={onModeChange}
          options={[
            { value: 'edit', label: <Pen className="size-3.5" />, ariaLabel: 'Editar' },
            { value: 'preview', label: <Eye className="size-3.5" />, ariaLabel: 'Visualizar' },
          ]}
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
      </div>

      <div className="border-border-base grid gap-3 border-b px-4 py-3 sm:grid-cols-3">
        <Field label="Onde" hint="Sem curso, vai para Estudos">
          <Select value={ondeAtual} onChange={(e) => mudarOnde(e.target.value)}>
            <option value={LIVRE}>Estudo livre</option>
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

      <CardContent className="relative flex min-h-0 flex-1 flex-col p-0">
        {formato === 'html' ? (
          mode === 'edit' ? (
            <RichEditor content={form.content} onChange={(html) => set({ content: html })} />
          ) : (
            <div className="px-5 py-4">
              {textoPuro(form.content, 'html').trim() ? (
                <NoteHtml
                  content={form.content}
                  onAbrirNota={onAbrirPorTitulo}
                  onAlternarTarefa={alternarTarefaNoHtml}
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
              className="h-full min-h-[50vh] resize-none rounded-none border-0 bg-transparent px-5 py-4 font-mono text-[13px] leading-relaxed"
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
          <div className="px-5 py-4">
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

      <NoteBacklinks itens={backlinks} onAbrir={onAbrirNota} nomeDoCurso={nomeDoCurso} />

      <div className="border-border-base text-fg-subtle flex items-center justify-between border-t px-4 py-2 text-[11px]">
        <span>{words} palavras</span>
        <Badge tone={saved ? 'neutral' : 'accent'}>{saved ? 'Salvo' : 'Salvando...'}</Badge>
      </div>
    </Card>
  )
}

export type { Track }
