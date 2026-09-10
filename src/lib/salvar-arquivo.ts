/**
 * Entregar um arquivo pronto à pessoa.
 *
 * No navegador, um link com `download` e uma URL de blob — o jeito de sempre.
 * Dentro da janela nativa isso simplesmente não acontece: o WebView2 não tem
 * pasta de downloads própria e o clique no link não produz nada, nem erro. O
 * backup e o `.ics` sumiriam em silêncio, que é a pior forma de quebrar.
 *
 * No desktop, então, o caminho é o seletor nativo de "salvar como" e a mesma
 * gravação em Rust que a pasta de trabalho usa.
 */

import { isTauri } from '@tauri-apps/api/core'
import { invoke } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'

export interface TipoArquivo {
  /** Rótulo mostrado no seletor, ex.: "Backup do Life". */
  nome: string
  /** Extensões sem ponto, ex.: `['json']`. */
  extensoes: string[]
  /** MIME usado só no caminho do navegador. */
  mime: string
}

export const BACKUP_JSON: TipoArquivo = {
  nome: 'Backup do Life',
  extensoes: ['json'],
  mime: 'application/json',
}

export const CALENDARIO_ICS: TipoArquivo = {
  nome: 'Calendário',
  extensoes: ['ics'],
  mime: 'text/calendar;charset=utf-8',
}

export const PLANILHA_CSV: TipoArquivo = {
  nome: 'Planilha CSV',
  extensoes: ['csv'],
  mime: 'text/csv;charset=utf-8',
}

export const CERTIFICADO_PDF: TipoArquivo = {
  nome: 'Certificado em PDF',
  extensoes: ['pdf'],
  mime: 'application/pdf',
}

/**
 * Salva o conteúdo com o nome sugerido.
 *
 * Devolve `false` quando a pessoa fecha o seletor sem escolher — cancelar não é
 * erro, e a tela não deve mostrar nada nesse caso.
 */
export async function salvarArquivo(
  nomeSugerido: string,
  conteudo: string | Uint8Array,
  tipo: TipoArquivo,
): Promise<boolean> {
  if (isTauri()) {
    const caminho = await save({
      defaultPath: nomeSugerido,
      filters: [{ name: tipo.nome, extensions: tipo.extensoes }],
    })
    if (!caminho) return false

    // Binário vai por um comando próprio: uma `String` no meio do caminho
    // reinterpretaria os bytes do PDF e o arquivo salvo não abriria.
    if (typeof conteudo === 'string') await invoke('gravar_texto', { caminho, conteudo })
    else await invoke('gravar_bytes', { caminho, dados: [...conteudo] })
    return true
  }

  const blob = new Blob([conteudo as BlobPart], { type: tipo.mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = nomeSugerido

  // A âncora precisa estar no documento: o Firefox ignora o clique numa que
  // está solta na memória, e o download não acontece nem dá erro.
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()

  // O `revoke` só depois de o navegador ter começado a baixar. Feito na linha
  // seguinte ao clique — como estava — ele derruba a URL antes da leitura e o
  // arquivo chega vazio ou nem chega.
  setTimeout(() => {
    URL.revokeObjectURL(url)
    anchor.remove()
  }, 0)

  return true
}
