import { ArrowLeft, NotebookPen, Plus, Search, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { EmptyState, Segmented } from '@/components/ui/misc'
import { useNotes, usePrograms, useSubjects } from '@/data/queries'
import { TRACK_LABELS, TRACK_ORDER, type Note, type ProgramTrack, type Track } from '@/data/types'
import {
  IMPORTACAO_ACCEPT,
  ImportacaoInvalida,
  lerArquivoDeNota,
} from '@/features/education/importar-nota'
import { ListLabel, NoteList, NoteTree, TreeLabel } from '@/features/education/note-browser'
import { NOTE_TEMPLATE, NoteEditor, type NoteMode } from '@/features/education/note-editor'
import { useCollapsedFolders, useNoteView } from '@/features/education/use-notebook-prefs'
import type { FormatoDaNota } from '@/lib/education/formato'
import {
  afetadasPorRenomear,
  chaveTitulo,
  indicePorTitulo,
  retrolinks,
} from '@/lib/education/links'
import {
  allFolderKeys,
  allTags,
  buildNoteTree,
  buildTrackTree,
  countTreeNotes,
  filterNotes,
} from '@/lib/education/note-tree'
import { cn } from '@/lib/utils'

/** O caderno inteiro — faculdade, cursos e estudo livre no mesmo lugar. */
export function Notebook() {
  return <NotebookView track={null} />
}

/** As rotas antigas continuam valendo, agora como um caderno já filtrado. */
export function AcademicNotebook() {
  return <NotebookView track="academic" />
}

export function CourseNotebook() {
  return <NotebookView track="course" />
}

function NotebookView({ track }: { track: ProgramTrack | null }) {
  const { data: allNotes, create, update, remove } = useNotes()
  const { data: programs } = usePrograms()
  const { data: subjects } = useSubjects()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Efêmero e sempre começando na leitura: abrir uma anotação é para ler. A
  // caneta vale enquanto aquela anotação está aberta e não sobrevive à saída —
  // voltar e encontrar o Markdown cru é o que fazia o caderno parecer um editor
  // de texto em vez de um caderno.
  const [mode, setMode] = useState<NoteMode>('preview')
  const [view, setView] = useNoteView()
  const [search, setSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useCollapsedFolders(track ?? 'tudo')
  const arquivo = useRef<HTMLInputElement>(null)
  const [erroDeImportacao, setErroDeImportacao] = useState<string | null>(null)

  /** Todo caminho de abertura passa por aqui, para nenhum deles esquecer o modo. */
  function openNote(id: string) {
    setSelectedId(id)
    setMode('preview')
  }

  function closeNote() {
    setSelectedId(null)
    setMode('preview')
  }

  const trackPrograms = track ? programs.filter((p) => p.track === track) : programs
  const notes = useMemo(
    () => (track ? allNotes.filter((n) => n.track === track) : allNotes),
    [allNotes, track],
  )
  const tags = useMemo(() => allTags(notes), [notes])

  const filtered = useMemo(
    () => filterNotes(notes, { search, programId: programFilter, tag: tagFilter }),
    [notes, search, programFilter, tagFilter],
  )

  // A árvore é montada sobre `filtered`: busca e etiquetas continuam valendo, e
  // uma pasta sem resultado simplesmente não é desenhada.
  const tree = useMemo(() => {
    if (track) return buildNoteTree(filtered, trackPrograms, subjects)
    const ordem = TRACK_ORDER.map((t) => ({ track: t, label: TRACK_LABELS[t] }))
    return buildTrackTree(filtered, programs, subjects, ordem)
  }, [track, filtered, trackPrograms, programs, subjects])

  // Buscando, tudo abre: esconder o resultado atrás de uma pasta fechada faria
  // a busca parecer quebrada.
  const searching = search.trim().length > 0 || tagFilter !== null
  const isOpen = (key: string) => searching || !collapsed.has(key)

  const toggleFolder = (key: string) => {
    const next = new Set(collapsed)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setCollapsed(next)
  }

  const allOpen = tree.length > 0 && allFolderKeys(tree).every((key) => !collapsed.has(key))
  const visibleCount = view === 'tree' ? countTreeNotes(tree) : filtered.length

  const selected = notes.find((n) => n.id === selectedId) ?? null

  // Os links atravessam o caderno todo, mesmo numa rota filtrada: uma anotação
  // de faculdade citando uma de curso é justamente o que a rede serve para ver.
  const porTitulo = useMemo(() => indicePorTitulo(allNotes), [allNotes])
  const existeNota = (titulo: string) => porTitulo.has(chaveTitulo(titulo))
  const backlinks = useMemo(
    () => (selected ? retrolinks(selected, allNotes) : []),
    [selected, allNotes],
  )

  const nomeDoCurso = (note: Note) =>
    programs.find((p) => p.id === note.program_id)?.name ?? null

  async function criarNota(
    titulo: string,
    comoTrack: Track,
    programId: string | null,
    /** Vem preenchido na importação: o arquivo já traz texto e língua. */
    pronta?: { content: string; format: FormatoDaNota },
  ) {
    const note = await create.mutateAsync({
      track: comoTrack,
      program_id: programId,
      subject_id: null,
      title: titulo,
      // Anotação nova nasce no editor formatado; o modelo em branco só entra
      // quando ninguém deu um título, que é o caminho do "Nova anotação".
      content: pronta ? pronta.content : titulo ? '' : NOTE_TEMPLATE,
      format: pronta ? pronta.format : 'html',
      tags: [],
      pinned: false,
    })
    setSelectedId(note.id)
    // A única exceção à regra da leitura: anotação recém-criada só tem o modelo
    // em branco, e quem clicou em "Nova anotação" quer escrever, não ler. O
    // arquivo importado já vem escrito, e abre para ler como qualquer outra.
    setMode(pronta ? 'preview' : 'edit')
    return note
  }

  /**
   * Traz um arquivo para dentro do caderno.
   *
   * A anotação nasce onde a lista está filtrada — mesmo curso, mesmo trilho —,
   * que é onde quem importou estava olhando.
   */
  async function importarArquivo(escolhido: File | undefined) {
    if (!escolhido) return
    setErroDeImportacao(null)
    try {
      const nota = await lerArquivoDeNota(escolhido)
      await criarNota(nota.title, track ?? 'free', programFilter || null, {
        content: nota.content,
        format: nota.format,
      })
    } catch (falha) {
      setErroDeImportacao(
        falha instanceof ImportacaoInvalida
          ? falha.message
          : 'Não foi possível importar este arquivo.',
      )
    } finally {
      // Sem isto, escolher o mesmo arquivo de novo não dispara `change`.
      if (arquivo.current) arquivo.current.value = ''
    }
  }

  /** Clique num `[[link]]`: abre a anotação, ou cria a que ainda não existe. */
  function abrirPorTitulo(titulo: string) {
    const alvo = porTitulo.get(chaveTitulo(titulo))
    if (alvo) {
      openNote(alvo.id)
      return
    }
    // Nasce no mesmo lugar de quem a citou: quem escreveu o link ali é quem
    // mais sabe onde o conceito mora.
    void criarNota(titulo, selected?.track ?? track ?? 'free', selected?.program_id ?? null)
  }

  /**
   * Grava a anotação e, mudando o título, conserta quem apontava para ela.
   *
   * Sem isto o link vira órfão em silêncio — a pior forma de perder informação,
   * porque ninguém percebe.
   */
  function salvar(id: string, patch: Partial<Note>) {
    const antes = allNotes.find((n) => n.id === id)
    update.mutate({ id, patch })

    const tituloNovo = patch.title
    if (!antes || tituloNovo === undefined || !antes.title) return

    for (const { nota, conteudo } of afetadasPorRenomear(allNotes, antes.title, tituloNovo)) {
      if (nota.id === id) continue
      update.mutate({ id: nota.id, patch: { content: conteudo } })
    }
  }

  const base = track === 'academic' ? '/faculdade' : track === 'course' ? '/cursos' : null
  const titulosDisponiveis = useMemo(
    () => allNotes.filter((n) => n.id !== selectedId).map((n) => ({ id: n.id, title: n.title })),
    [allNotes, selectedId],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          {base && (
            <Link
              to={base}
              className="text-fg-subtle hover:text-fg mb-2 inline-flex items-center gap-1.5 text-xs transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              {track === 'academic' ? 'Faculdade' : 'Cursos'}
            </Link>
          )}
          <h1 className="text-fg text-xl font-semibold">Caderno</h1>
          <p className="text-fg-muted mt-1 max-w-2xl text-sm">
            {track
              ? 'Anotações e resumos deste módulo.'
              : 'Anotações e resumos — da faculdade, dos cursos e do que você estuda por conta.'}{' '}
            Nas anotações em Markdown, escreva <code className="text-fg-subtle">[[</code> para
            ligar uma à outra.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <input
              ref={arquivo}
              type="file"
              accept={IMPORTACAO_ACCEPT}
              className="hidden"
              onChange={(e) => void importarArquivo(e.target.files?.[0])}
            />
            <Button variant="secondary" onClick={() => arquivo.current?.click()}>
              <Upload />
              Importar
            </Button>
            <Button onClick={() => void criarNota('', track ?? 'free', programFilter || null)}>
              <Plus />
              Nova anotação
            </Button>
          </div>
          {erroDeImportacao && (
            <p className="text-negative max-w-xs text-right text-xs">{erroDeImportacao}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Lista */}
        <div className={cn('space-y-3', selected && 'hidden lg:block')}>
          <div className="flex items-center gap-2">
            <Segmented
              className="flex-1"
              value={view}
              onChange={setView}
              options={[
                { value: 'list' as const, label: <ListLabel /> },
                { value: 'tree' as const, label: <TreeLabel /> },
              ]}
            />
            {view === 'tree' && tree.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCollapsed(allOpen ? new Set(allFolderKeys(tree)) : new Set())}
              >
                {allOpen ? 'Fechar tudo' : 'Abrir tudo'}
              </Button>
            )}
          </div>

          <Field>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-9"
            />
            <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          </Field>

          {view === 'list' && trackPrograms.length > 0 && (
            <Select
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              aria-label="Filtrar por curso"
            >
              <option value="">Todos os cursos</option>
              {trackPrograms.map((program) => (
                <option key={program.id} value={program.id}>
                  {program.name}
                </option>
              ))}
            </Select>
          )}

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  className={
                    tagFilter === tag
                      ? 'bg-accent-soft text-accent rounded-md px-2 py-0.5 text-[11px] font-medium'
                      : 'bg-surface-2 border-border-base text-fg-muted hover:text-fg rounded-md border px-2 py-0.5 text-[11px]'
                  }
                >
                  #{tag}
                </button>
              ))}
            </div>
          )}

          {visibleCount === 0 ? (
            <Card>
              <EmptyState
                icon={<NotebookPen className="size-5" />}
                title={notes.length === 0 ? 'Caderno vazio' : 'Nada encontrado'}
                description={
                  notes.length === 0
                    ? 'Crie a primeira anotação — o modelo já vem com resumo, pontos principais, dúvidas e o que revisar. Ou importe um arquivo que você já tem.'
                    : 'Ajuste a busca ou os filtros.'
                }
              />
            </Card>
          ) : view === 'tree' ? (
            <NoteTree
              tree={tree}
              isOpen={isOpen}
              onToggle={toggleFolder}
              selectedId={selectedId}
              onSelect={openNote}
            />
          ) : (
            <NoteList
              notes={filtered}
              selectedId={selectedId}
              onSelect={openNote}
              subtitleOf={(note) => {
                const program = programs.find((p) => p.id === note.program_id)
                const subject = subjects.find((s) => s.id === note.subject_id)
                const lugar = [subject?.name, program?.name].filter(Boolean).join(' · ')
                return lugar || TRACK_LABELS[note.track]
              }}
            />
          )}
        </div>

        {/* Editor */}
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            mode={mode}
            onModeChange={setMode}
            programs={programs}
            subjects={subjects.filter((s) => s.program_id === selected.program_id)}
            onBack={closeNote}
            onSave={(patch) => salvar(selected.id, patch)}
            onRemove={() => {
              remove.mutate(selected.id)
              closeNote()
            }}
            backlinks={backlinks}
            onAbrirNota={openNote}
            onAbrirPorTitulo={abrirPorTitulo}
            existeNota={existeNota}
            titulosDisponiveis={titulosDisponiveis}
            nomeDoCurso={nomeDoCurso}
          />
        ) : (
          <Card className="hidden lg:block">
            <EmptyState
              icon={<NotebookPen className="size-6" />}
              title="Selecione uma anotação"
              description="Ou crie uma nova, com formatação como num editor de texto. Também dá para importar .md, .txt, .docx e .pdf."
            />
          </Card>
        )}
      </div>
    </div>
  )
}
