import { ArrowLeft, Eye, Pen, Pin, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input, Select, Textarea } from '@/components/ui/field'
import { Badge, Segmented } from '@/components/ui/misc'
import type { Note, Track } from '@/data/types'
import { confirmar } from '@/lib/avisos'
import { Markdown } from './markdown'

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

export function NoteEditor({
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
    }, AUTOSAVE_MS)
    return () => clearTimeout(timer)
  }, [patch, saved])

  const set = (values: Partial<typeof form>) => {
    setForm((prev) => ({ ...prev, ...values }))
    setSaved(false)
  }

  const words = form.content.trim().split(/\s+/).filter(Boolean).length

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
        <span>{words} palavras</span>
        <Badge tone={saved ? 'neutral' : 'accent'}>{saved ? 'Salvo' : 'Salvando...'}</Badge>
      </div>
    </Card>
  )
}
