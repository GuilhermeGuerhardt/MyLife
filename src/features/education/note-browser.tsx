/** As duas maneiras de percorrer o caderno: lista corrida e árvore de pastas. */

import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen, List, Pin } from 'lucide-react'
import type { Note } from '@/data/types'
import type { TreeFolder } from '@/lib/education/note-tree'
import { cn } from '@/lib/utils'

/** Rótulos do seletor: ícone e palavra, porque só o ícone não diz o que faz. */
export function ListLabel() {
  return (
    <span className="flex items-center justify-center gap-1.5">
      <List className="size-3.5" />
      Lista
    </span>
  )
}

export function TreeLabel() {
  return (
    <span className="flex items-center justify-center gap-1.5">
      <Folder className="size-3.5" />
      Pastas
    </span>
  )
}

export function NoteTree({
  tree,
  isOpen,
  onToggle,
  selectedId,
  onSelect,
}: {
  tree: TreeFolder[]
  isOpen: (key: string) => boolean
  onToggle: (key: string) => void
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="space-y-0.5">
      {tree.map((folder) => (
        <FolderNode
          key={folder.key}
          folder={folder}
          depth={0}
          isOpen={isOpen}
          onToggle={onToggle}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
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

export function NoteList({
  notes,
  selectedId,
  onSelect,
  subtitleOf,
}: {
  notes: Note[]
  selectedId: string | null
  onSelect: (id: string) => void
  /** Curso e disciplina, resolvidos por quem tem as listas em mãos. */
  subtitleOf: (note: Note) => string
}) {
  return (
    <div className="space-y-1.5">
      {notes.map((note) => (
        <button
          key={note.id}
          type="button"
          onClick={() => onSelect(note.id)}
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
          <p className="text-fg-subtle mt-0.5 truncate text-[11px]">{subtitleOf(note)}</p>
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
      ))}
    </div>
  )
}
