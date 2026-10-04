/**
 * Onde as escolhas de aviso moram: no armazenamento desta máquina.
 *
 * Não vai para o banco de propósito. Aviso é coisa do aparelho: quem usa o Life
 * no notebook e no PC de casa, pela mesma pasta, não quer o mesmo balão saindo
 * nos dois ao mesmo tempo. E a permissão do sistema já é por máquina.
 */

import { TIPOS_DE_LEMBRETE, type Enviados, type TipoDeLembrete } from '@/lib/lembretes/lembretes'

export interface PreferenciasDeAviso {
  ligado: boolean
  tipos: TipoDeLembrete[]
}

const CHAVE = 'life:avisos'
const CHAVE_ENVIADOS = 'life:avisos-enviados'
export const EVENTO_AVISOS = 'life:avisos-mudou'

const TODOS: TipoDeLembrete[] = TIPOS_DE_LEMBRETE.map((tipo) => tipo.id)

/** Desligado até a pessoa ligar: aviso que aparece sem ter sido pedido é spam. */
export const PADRAO: PreferenciasDeAviso = { ligado: false, tipos: TODOS }

/** Lê tolerando lixo: valor corrompido volta ao padrão, nunca trava a tela. */
export function interpretarPreferencias(cru: string | null): PreferenciasDeAviso {
  if (!cru) return PADRAO
  try {
    const dado: unknown = JSON.parse(cru)
    if (typeof dado !== 'object' || dado === null) return PADRAO
    const { ligado, tipos } = dado as Partial<PreferenciasDeAviso>
    return {
      ligado: ligado === true,
      tipos: Array.isArray(tipos)
        ? TODOS.filter((tipo) => tipos.includes(tipo))
        : TODOS,
    }
  } catch {
    return PADRAO
  }
}

export function lerPreferencias(): PreferenciasDeAviso {
  try {
    return interpretarPreferencias(localStorage.getItem(CHAVE))
  } catch {
    return PADRAO
  }
}

export function gravarPreferencias(preferencias: PreferenciasDeAviso): void {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(preferencias))
  } catch {
    // Sem armazenamento, a escolha vale só até fechar o app.
  }
  window.dispatchEvent(new Event(EVENTO_AVISOS))
}

export function lerEnviados(): Enviados {
  try {
    const dado: unknown = JSON.parse(localStorage.getItem(CHAVE_ENVIADOS) ?? '{}')
    if (typeof dado !== 'object' || dado === null || Array.isArray(dado)) return {}
    return Object.fromEntries(
      Object.entries(dado).filter((par): par is [string, string] => typeof par[1] === 'string'),
    )
  } catch {
    return {}
  }
}

export function gravarEnviados(enviados: Enviados): void {
  try {
    localStorage.setItem(CHAVE_ENVIADOS, JSON.stringify(enviados))
  } catch {
    // Sem armazenamento, o pior caso é o mesmo aviso sair de novo amanhã.
  }
}
