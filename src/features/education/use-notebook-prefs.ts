/**
 * Preferências de navegação do caderno, lembradas entre sessões.
 *
 * Nada aqui é dado do usuário — é só onde ele parou de olhar. Por isso mora no
 * `localStorage` e não no banco: perder isso não perde nada, e um `localStorage`
 * indisponível não pode impedir o caderno de abrir.
 */

import { useCallback, useState } from 'react'

export type NoteView = 'list' | 'tree'

/** Onde a escolha entre lista corrida e árvore de pastas fica lembrada. */
const VIEW_KEY = 'life:caderno-vista'

/** Pastas fechadas, por trilha — faculdade e cursos têm árvores diferentes. */
const COLLAPSED_KEY = 'life:caderno-pastas-fechadas'

function readCollapsed(track: string): Set<string> {
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

/** Grava sem deixar um `localStorage` cheio ou bloqueado derrubar a tela. */
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Sem localStorage vale só nesta sessão.
  }
}

/**
 * Guarda o que está **fechado**, não o que está aberto.
 *
 * A diferença importa: pasta nova — curso recém-criado, disciplina que ganhou a
 * primeira anotação — nasce aberta, em vez de nascer escondida por não constar
 * de uma lista de abertas gravada antes de ela existir.
 */
export function useCollapsedFolders(track: string): [Set<string>, (next: Set<string>) => void] {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => readCollapsed(track))

  const change = useCallback(
    (next: Set<string>) => {
      setCollapsed(next)
      write(`${COLLAPSED_KEY}:${track}`, JSON.stringify([...next]))
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
export function useNoteView(): [NoteView, (view: NoteView) => void] {
  const [view, setView] = useState<NoteView>(readView)

  const change = useCallback((next: NoteView) => {
    setView(next)
    write(VIEW_KEY, next)
  }, [])

  return [view, change]
}
