/**
 * O `[[Título]]` escrito numa anotação formatada vira link na leitura.
 *
 * O link do caderno é um só nos dois editores: o texto `[[Arquitetura]]`. No
 * Markdown sempre foi assim; a anotação formatada guardava uma âncora com o
 * título no `data-nota`, e o resultado era uma rede pela metade — o link até
 * clicava, mas o painel de menções não o enxergava, porque procura por
 * colchetes. Dois formatos para a mesma ideia é onde a divergência começa.
 *
 * A troca acontece na leitura, não no que fica gravado: o que está no banco
 * continua sendo o texto que a pessoa escreveu.
 */

const LINK = /\[\[([^[\]\n]+)\]\]/g

/** Fora destas etiquetas, `[[x]]` é texto do documento e não exemplo de código. */
const PROTEGIDO = /<(code|pre|a)\b[\s\S]*?<\/\1>/gi

export interface OpcoesDoWikilink {
  /** Título que não existe ganha outra cor — é o convite para criar a anotação. */
  existe: (titulo: string) => boolean
}

export function comWikilinks(html: string, { existe }: OpcoesDoWikilink): string {
  const guardados: string[] = []

  // Tira de cena o que não pode virar link: um `[[x]]` dentro de um bloco de
  // código é o exemplo que alguém quis mostrar, e dentro de um `<a>` já é link.
  const semRisco = html.replace(PROTEGIDO, (trecho) => {
    guardados.push(trecho)
    return `\u0000${guardados.length - 1}\u0000`
  })

  const comLinks = semRisco.replace(LINK, (inteiro, titulo: string) => {
    const limpo = titulo.trim()
    if (!limpo) return inteiro
    const classe = existe(limpo) ? 'nota-link' : 'nota-link nota-link-vazio'
    return `<a href="#nota" class="${classe}" data-nota="${escapar(limpo)}">${escapar(limpo)}</a>`
  })

  return comLinks.replace(/\u0000(\d+)\u0000/g, (_, indice: string) => guardados[Number(indice)] ?? '')
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
