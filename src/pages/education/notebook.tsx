import { ArrowLeft, NotebookPen, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { EmptyState, Segmented } from '@/components/ui/misc'
import { useNotes, usePrograms, useSubjects } from '@/data/queries'
import type { Track } from '@/data/types'
import { ListLabel, NoteList, NoteTree, TreeLabel } from '@/features/education/note-browser'
import { NOTE_TEMPLATE, NoteEditor, type NoteMode } from '@/features/education/note-editor'
import { useCollapsedFolders, useNoteView } from '@/features/education/use-notebook-prefs'
import {
  allFolderKeys,
  allTags,
  buildNoteTree,
  countTreeNotes,
  filterNotes,
} from '@/lib/education/note-tree'
import { cn } from '@/lib/utils'

export function AcademicNotebook() {
  return <Notebook track="academic" />
}

export function CourseNotebook() {
  return <Notebook track="course" />
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
  const tags = useMemo(() => allTags(notes), [notes])

  const filtered = useMemo(
    () => filterNotes(notes, { search, programId: programFilter, tag: tagFilter }),
    [notes, search, programFilter, tagFilter],
  )

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
  const visibleCount = view === 'tree' ? countTreeNotes(tree) : filtered.length

  const selected = notes.find((n) => n.id === selectedId) ?? null

  async function createNote() {
    const note = await create.mutateAsync({
      track,
      program_id: programFilter || null,
      subject_id: null,
      title: 'Nova anotação',
      content: NOTE_TEMPLATE,
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
                    ? 'Crie a primeira anotação. O modelo já vem com resumo, pontos principais, dúvidas e o que revisar.'
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
                return [subject?.name, program?.name].filter(Boolean).join(' · ') || 'Geral'
              }}
            />
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
