/**
 * Checagem de atualização na abertura do app.
 *
 * O Life é um programa offline e quer continuar sendo. Por isso a checagem é
 * silenciosa em todos os casos menos dois — achou versão nova, ou a pessoa
 * está sem rede — e o resultado nunca bloqueia nada: some sozinho ou espera
 * num canto. "Você já está atualizado" não é notícia e não vira aviso.
 *
 * Só roda no programa de desktop. No navegador não existe o que atualizar.
 */

import { isTauri } from '@tauri-apps/api/core'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { useCallback, useEffect, useRef, useState } from 'react'

/** Preferência por aparelho, como o tema — não é dado do perfil. */
const CHAVE = 'life:buscar-atualizacoes'

/** Espera o app terminar de abrir antes de tocar na rede. */
const ATRASO_MS = 4000

export function buscaAtivada(): boolean {
  try {
    // Ausente = ligado: quem nunca mexeu quer receber correção.
    return localStorage.getItem(CHAVE) !== 'nao'
  } catch {
    return true
  }
}

export function definirBusca(ativa: boolean) {
  try {
    localStorage.setItem(CHAVE, ativa ? 'sim' : 'nao')
  } catch {
    // Sem localStorage vale só nesta sessão.
  }
}

export type EstadoUpdate =
  /** Nada a dizer: ainda não checou, ou checou e já está atualizado. */
  | { kind: 'quieto' }
  | { kind: 'sem-rede' }
  | { kind: 'disponivel'; versao: string; notas: string | null }
  /** `percent` é nulo quando o servidor não informa o tamanho total. */
  | { kind: 'baixando'; percent: number | null }
  | { kind: 'erro'; mensagem: string }

export function useUpdater() {
  const [estado, setEstado] = useState<EstadoUpdate>({ kind: 'quieto' })
  // Guardado fora do estado: é um recurso do lado nativo, não algo que a tela
  // desenha, e recriá-lo a cada render perderia o download já feito.
  const pendente = useRef<Update | null>(null)

  useEffect(() => {
    if (!isTauri() || !buscaAtivada()) return

    let cancelado = false
    const timer = setTimeout(async () => {
      try {
        const update = await check()
        if (cancelado || !update) return
        pendente.current = update
        setEstado({ kind: 'disponivel', versao: update.version, notas: update.body ?? null })
      } catch {
        // Qualquer falha aqui é, na prática, "não deu para perguntar": sem
        // rede, GitHub fora do ar, DNS. Não vale distinguir para o usuário.
        if (!cancelado) setEstado({ kind: 'sem-rede' })
      }
    }, ATRASO_MS)

    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [])

  const dispensar = useCallback(() => setEstado({ kind: 'quieto' }), [])

  const instalar = useCallback(async () => {
    const update = pendente.current
    if (!update) return

    setEstado({ kind: 'baixando', percent: null })

    let total = 0
    let baixado = 0
    try {
      await update.downloadAndInstall((evento) => {
        if (evento.event === 'Started') {
          total = evento.data.contentLength ?? 0
        } else if (evento.event === 'Progress') {
          baixado += evento.data.chunkLength
          setEstado({
            kind: 'baixando',
            percent: total > 0 ? Math.min((baixado / total) * 100, 100) : null,
          })
        }
      })
      // No Windows não se chega aqui: o instalador assume e encerra o app.
    } catch (causa) {
      setEstado({
        kind: 'erro',
        mensagem: causa instanceof Error ? causa.message : 'Não foi possível instalar.',
      })
    }
  }, [])

  return { estado, instalar, dispensar }
}
