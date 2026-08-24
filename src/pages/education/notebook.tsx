import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  List,
  NotebookPen,
  Pen,
  Pin,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Badge, EmptyState, Segmented } from '@/components/ui/misc'
import { useNotes, usePrograms, useSubjects } from '@/data/queries'
import type { Note, Track } from '@/data/types'
import { Markdown } from '@/features/education/markdown'
import { confirmar } from '@/lib/avisos'
import {
  allFolderKeys,
  buildNoteTree,
  countTreeNotes,
  type TreeFolder,
} from '@/lib/education/note-tree'
import { normalize } from '@/lib/quick-add/parser'
import { cn } from '@/lib/utils'

export function AcademicNotebook() {
  return <Notebook track="academic" />
}

export function CourseNotebook() {
  return <Notebook track="course" />
}

const TEMPLATE = `## Resumo

## Pontos principais

-

## Dúvidas

-

## Para revisar
`

type NoteMode = 'edit' | 'preview'
type NoteView = 'list' | 'tree'

/** Onde a escolha entre lista corrida e árvore de pastas fica lembrada. */
const VIEW_KEY = 'life:caderno-vista'
/** Pastas fechadas, por trilha — faculdade e cursos têm árvores diferentes. */
const COLLAPSED_KEY = 'life:caderno-pastas-fechadas'

function readCollapsed(track: Track): Set<string> {
  try {
    const raw = localStorage.getItem(`${COLLAPSED_KEY}:${track}`)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed.filter((k) => typeof k === 'string') : [])
  } catch {
    // Preferência corrompida não pode impedir o caderno de abrir: começa tudo
    // aberto, que é o estado padrão.
    return new Set()
  }
}

/**
 * Guarda o que está **fechado**, não o que está aberto.
 *
 * A diferença importa: pasta nova — curso recém-criado, disciplina que ganhou a
 * primeira anotação — nasce aberta, em vez de nascer escondida por não constar
 * de uma lista de abertas gravada antes de ela existir.
 */
function useCollapsedFolders(track: Track): [Set<string>, (next: Set<string>) => void] {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => readCollapsed(track))

  const change = useCallback(
    (next: Set<string>) => {
      setCollapsed(next)
      try {
        localStorage.setItem(`${COLLAPSED_KEY}:${track}`, JSON.stringify([...next]))
      } catch {
        // Sem localStorage vale só nesta sessão.
      }
    },
    [track],
  )

  return [collapsed, change]
}

function readView(): NoteView {
  try {
    return localStorage.getItem(VIEW_KEY) === 'tree' ? 'tree' : 'list'
  } catch {
    return 'list'
  }
}

/** Lista ou pastas é preferência de navegação, e sobrevive a fechar o app. */
function useNoteView(): [NoteView, (view: NoteView) => void] {
  const [view, setView] = useState<NoteView>(readView)

  const change = useCallback((next: NoteView) => {
    setView(next)
    try {
      localStorage.setItem(VIEW_KEY, next)
    } catch {
      // Sem localStorage vale só nesta sessão.
    }
  }, [])

  return [view, change]
}

function Notebook({ track }: { track: Track }) {
  const academic = track === 'academic'
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
  const [collapsed, setCollapsed] = useCollapsedFolders(track)

  /** Todo caminho de abertura passa por aqui, para nenhum deles esquecer o modo. */
  function openNote(id: string) {
    setSelectedId(id)
    setMode('preview')
  }

  function closeNote() {
    setSelectedId(null)
    setMode('preview')
  }

  const trackPrograms = programs.filter((p) => p.track === track)
  const notes = useMemo(() => allNotes.filter((n) => n.track === track), [allNotes, track])

  const tags = useMemo(
    () => [...new Set(notes.flatMap((n) => n.tags))].sort((a, b) => a.localeCompare(b)),
    [notes],
  )

  const filtered = useMemo(() => {
    const term = normalize(search)
    return notes
      .filter((note) => !programFilter || note.program_id === programFilter)
      .filter((note) => !tagFilter || note.tags.includes(tagFilter))
      .filter(
        (note) =>
          !term ||
          normalize(note.title).includes(term) ||
          normalize(note.content).includes(term) ||
          note.tags.some((tag) => normalize(tag).includes(term)),
      )
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return (b.updated_at ?? b.created_at).localeCompare(a.updated_at ?? a.created_at)
      })
  }, [notes, search, programFilter, tagFilter])

  // A árvore é montada sobre `filtered`: busca e etiquetas continuam valendo, e
  // uma pasta sem resultado simplesmente não é desenhada.
  const tree = useMemo(
    () => buildNoteTree(filtered, trackPrograms, subjects),
    [filtered, trackPrograms, subjects],
  )

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

  const selected = notes.find((n) => n.id === selectedId) ?? null

  async function createNote() {
    const note = await create.mutateAsync({
      track,
      program_id: programFilter || null,
      subject_id: null,
      title: 'Nova anotação',
      content: TEMPLATE,
      tags: [],
      pinned: false,
    })
    setSelectedId(note.id)
    // A única exceção à regra da leitura: anotação recém-criada só tem o modelo
    // em branco, e quem clicou em "Nova anotação" quer escrever, não ler.
    setMode('edit')
  }

  const base = academic ? '/faculdade' : '/cursos'

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            to={base}
            className="text-fg-subtle hover:text-fg mb-2 inline-flex items-center gap-1.5 text-xs transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            {academic ? 'Faculdade' : 'Cursos'}
          </Link>
          <h1 className="text-fg text-xl font-semibold">Caderno</h1>
          <p className="text-fg-muted mt-1 max-w-2xl text-sm">
            Anotações e resumos em Markdown, ligados{' '}
            {academic ? 'ao curso e à disciplina' : 'ao curso'}. A busca varre título, conteúdo e
            etiquetas.
          </p>
        </div>
        <Button onClick={() => void createNote()}>
          <Plus />
          Nova anotação
        </Button>
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
                onClick={() =>
                  setCollapsed(allOpen ? new Set(allFolderKeys(tree)) : new Set())
                }
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

          {(view === 'tree' ? countTreeNotes(tree) : filtered.length) === 0 ? (
            <Card>
              <EmptyState
                icon={<NotebookPen className="size-5" />}
                title={notes.length === 0 ? 'Caderno vazio' : 'Nada encontrado'}
                description={
                  notes.length === 0
                    ? 'Crie a primeira anotação. O modelo já vem com resumo, pontos principais, dúvidas e o que revisar.'
                    : 'Ajuste a busca ou os filtros.'
                }
              />
            </Card>
          ) : view === 'tree' ? (
            <div className="space-y-0.5">
              {tree.map((folder) => (
                <FolderNode
                  key={folder.key}
                  folder={folder}
                  depth={0}
                  isOpen={isOpen}
                  onToggle={toggleFolder}
                  selectedId={selectedId}
                  onSelect={openNote}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((note) => {
                const program = programs.find((p) => p.id === note.program_id)
                const subject = subjects.find((s) => s.id === note.subject_id)
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => openNote(note.id)}
                    className={cn(
                      'block w-full rounded-lg border px-3 py-2.5 text-left transition-colors',
                      note.id === selectedId
                        ? 'border-accent bg-accent-soft'
                        : 'border-border-base bg-surface hover:border-border-strong',
                    )}
                  >
                    <div className="flex items-start gap-1.5">
                      {note.pinned && <Pin className="text-accent mt-0.5 size-3 shrink-0" />}
                      <span className="text-fg flex-1 truncate text-sm font-medium">
                        {note.title || 'Sem título'}
                      </span>
                    </div>
                    <p className="text-fg-subtle mt-0.5 truncate text-[11px]">
                      {[subject?.name, program?.name].filter(Boolean).join(' · ') || 'Geral'}
                    </p>
                    {note.tags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {note.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag}
                            className="text-fg-subtle bg-surface-2 rounded px-1.5 py-0.5 text-[10px]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Editor */}
        {selected ? (
          <NoteEditor
            key={selected.id}
            note={selected}
            track={track}
            mode={mode}
            onModeChange={setMode}
            programs={trackPrograms}
            subjects={subjects.filter((s) => s.program_id === selected.program_id)}
            onBack={closeNote}
            onSave={(patch) => update.mutate({ id: selected.id, patch })}
            onRemove={() => {
              remove.mutate(selected.id)
              closeNote()
            }}
          />
        ) : (
          <Card className="hidden lg:block">
            <EmptyState
              icon={<NotebookPen className="size-6" />}
              title="Selecione uma anotação"
              description="Ou crie uma nova. O conteúdo aceita Markdown: títulos, listas, tabelas, código e checkboxes."
            />
          </Card>
        )}
      </div>
    </div>
  )
}

/** Rótulos do seletor: ícone e palavra, porque só o ícone não diz o que faz. */
function ListLabel() {
  return (
    <span className="flex items-center justify-center gap-1.5">
      <List className="size-3.5" />
      Lista
    </span>
  )
}

function TreeLabel() {
  return (
    <span className="flex items-center justify-center gap-1.5">
      <Folder className="size-3.5" />
      Pastas
    </span>
  )
}

/**
 * Uma pasta da árvore e o que há dentro dela.
 *
 * O recuo é calculado a partir da profundidade em vez de aninhar `padding`:
 * assim a linha inteira continua clicável de ponta a ponta, e não só o texto.
 */
function FolderNode({
  folder,
  depth,
  isOpen,
  onToggle,
  selectedId,
  onSelect,
}: {
  folder: TreeFolder
  depth: number
  isOpen: (key: string) => boolean
  onToggle: (key: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const open = isOpen(folder.key)

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(folder.key)}
        aria-expanded={open}
        className="hover:bg-surface-2 flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {open ? (
          <ChevronDown className="text-fg-subtle size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="text-fg-subtle size-3.5 shrink-0" />
        )}
        {open ? (
          <FolderOpen className="text-accent size-3.5 shrink-0" />
        ) : (
          <Folder className="text-accent size-3.5 shrink-0" />
        )}
        <span className="text-fg truncate text-[13px] font-medium">{folder.label}</span>
        <span className="text-fg-subtle ml-auto shrink-0 text-[11px] tabular-nums">
          {folder.count}
        </span>
      </button>

      {open && (
        <>
          {folder.children.map((child) => (
            <FolderNode
              key={child.key}
              folder={child}
              depth={depth + 1}
              isOpen={isOpen}
              onToggle={onToggle}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}

          {folder.notes.map((note) => (
            <button
              key={note.id}
              type="button"
              onClick={() => onSelect(note.id)}
              className={cn(
                'flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left transition-colors',
                note.id === selectedId
                  ? 'bg-accent-soft text-accent'
                  : 'text-fg hover:bg-surface-2',
              )}
              style={{ paddingLeft: `${8 + (depth + 1) * 14 + 14}px` }}
            >
              <FileText className="size-3.5 shrink-0 opacity-60" />
              <span className="truncate text-[13px]">{note.title || 'Sem título'}</span>
              {note.pinned && <Pin className="text-accent ml-auto size-3 shrink-0" />}
            </button>
          ))}
        </>
      )}
    </div>
  )
}

function NoteEditor({
  note,
  track,
  mode,
  onModeChange,
  programs,
  subjects,
  onBack,
  onSave,
  onRemove,
}: {
  note: Note
  track: Track
  /** Vem de fora: o editor remonta a cada troca de anotação, o modo não. */
  mode: NoteMode
  onModeChange: (mode: NoteMode) => void
  programs: Array<{ id: string; name: string }>
  subjects: Array<{ id: string; name: string }>
  onBack: () => void
  onSave: (patch: Partial<Note>) => void
  onRemove: () => void
}) {
  const [form, setForm] = useState({
    title: note.title,
    content: note.content,
    program_id: note.program_id ?? '',
    subject_id: note.subject_id ?? '',
    tags: note.tags.join(', '),
  })
  const [saved, setSaved] = useState(true)

  const patch = useMemo(
    (): Partial<Note> => ({
      title: form.title,
      content: form.content,
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
    }, 800)
    return () => clearTimeout(timer)
  }, [patch, saved])

  const set = (values: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...values }))
    setSaved(false)
  }

  return (
    <Card className="flex min-h-[70vh] flex-col">
      <div className="border-border-base flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="lg:hidden" aria-label="Voltar">
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
        <Field label={track === 'academic' ? 'Curso' : 'Curso livre'}>
          <Select
            value={form.program_id}
            onChange={(e) => set({ program_id: e.target.value, subject_id: '' })}
          >
            <option value="">Geral</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>
                {program.name}
              </option>
            ))}
          </Select>
        </Field>

        {track === 'academic' && (
          <Field label="Disciplina">
            <Select
              value={form.subject_id}
              disabled={!form.program_id}
              onChange={(e) => set({ subject_id: e.target.value })}
            >
              <option value="">Nenhuma</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <Field label="Etiquetas" hint="Separadas por vírgula">
          <Input
            value={form.tags}
            onChange={(e) => set({ tags: e.target.value })}
            placeholder="prova, revisão"
          />
        </Field>
      </div>

      <CardContent className="min-h-0 flex-1 p-0">
        {mode === 'edit' ? (
          <Textarea
            value={form.content}
            onChange={(e) => set({ content: e.target.value })}
            placeholder="Escreva em Markdown..."
            className="h-full min-h-[50vh] resize-none rounded-none border-0 bg-transparent px-5 py-4 font-mono text-[13px] leading-relaxed"
          />
        ) : (
          <div className="px-5 py-4">
            {form.content.trim() ? (
              <Markdown content={form.content} />
            ) : (
              <p className="text-fg-subtle text-sm">Nada escrito ainda.</p>
            )}
          </div>
        )}
      </CardContent>

      <div className="border-border-base text-fg-subtle flex items-center justify-between border-t px-4 py-2 text-[11px]">
        <span>{form.content.trim().split(/\s+/).filter(Boolean).length} palavras</span>
        <Badge tone={saved ? 'neutral' : 'accent'}>{saved ? 'Salvo' : 'Salvando...'}</Badge>
      </div>
    </Card>
  )
}
