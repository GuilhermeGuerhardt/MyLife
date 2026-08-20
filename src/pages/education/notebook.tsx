import {
  ArrowLeft,
  Eye,
  NotebookPen,
  Pen,
  Pin,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Badge, EmptyState, Segmented } from '@/components/ui/misc'
import { useNotes, usePrograms, useSubjects } from '@/data/queries'
import type { Note, Track } from '@/data/types'
import { Markdown } from '@/features/education/markdown'
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

function Notebook({ track }: { track: Track }) {
  const academic = track === 'academic'
  const { data: allNotes, create, update, remove } = useNotes()
  const { data: programs } = usePrograms()
  const { data: subjects } = useSubjects()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [programFilter, setProgramFilter] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

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

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Lista */}
        <div className={cn('space-y-3', selected && 'hidden lg:block')}>
          <Field>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="pl-9"
            />
            <Search className="text-fg-subtle pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          </Field>

          {trackPrograms.length > 0 && (
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

          {filtered.length === 0 ? (
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
          ) : (
            <div className="space-y-1.5">
              {filtered.map((note) => {
                const program = programs.find((p) => p.id === note.program_id)
                const subject = subjects.find((s) => s.id === note.subject_id)
                return (
                  <button
                    key={note.id}
                    type="button"
                    onClick={() => setSelectedId(note.id)}
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
            programs={trackPrograms}
            subjects={subjects.filter((s) => s.program_id === selected.program_id)}
            onBack={() => setSelectedId(null)}
            onSave={(patch) => update.mutate({ id: selected.id, patch })}
            onRemove={() => {
              remove.mutate(selected.id)
              setSelectedId(null)
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

function NoteEditor({
  note,
  track,
  programs,
  subjects,
  onBack,
  onSave,
  onRemove,
}: {
  note: Note
  track: Track
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
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
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

  // Salva sozinho depois de uma pausa na digitação — anotação perdida por
  // esquecer de salvar é a forma mais rápida de abandonar um caderno.
  useEffect(() => {
    if (saved) return
    const timer = setTimeout(() => {
      onSave(patch)
      setSaved(true)
    }, 800)
    return () => clearTimeout(timer)
  }, [patch, saved, onSave])

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
          onChange={setMode}
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
            if (confirm('Remover esta anotação?')) onRemove()
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
