/**
 * De texto de arquivo para matriz de células.
 *
 * A primeira etapa da importação, e a única que não sabe nada de finanças: aqui
 * o CSV é só um retângulo de strings. Separado do resto porque a regra do
 * RFC 4180 não muda quando muda o extrato, e porque é o pedaço que precisa
 * aguentar o caso chato — a vírgula dentro das aspas de `"R$ 1.130,00"`.
 */

/**
 * Descobre o separador contando ocorrências fora de aspas na primeira linha.
 *
 * Testar `,` e `;` importa no Brasil: o Excel em português exporta com ponto e
 * vírgula justamente porque a vírgula já é o separador decimal.
 */
export function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? ''
  const candidates = [',', ';', '\t', '|']

  let best = ','
  let bestCount = 0
  for (const candidate of candidates) {
    let count = 0
    let quoted = false
    for (const char of firstLine) {
      if (char === '"') quoted = !quoted
      else if (char === candidate && !quoted) count++
    }
    if (count > bestCount) {
      best = candidate
      bestCount = count
    }
  }
  return best
}

/**
 * CSV para matriz de strings.
 *
 * Implementado à mão em vez de com uma dependência: a regra do RFC 4180 cabe
 * em trinta linhas, e o parser precisa aguentar exatamente um caso que um
 * `split(',')` erraria — o valor `"R$ 1.130,00"`, com vírgula dentro das
 * aspas. Aspas duplicadas (`""`) viram uma aspa literal.
 */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  // O BOM do Excel entraria como parte do nome da primeira coluna e estragaria
  // a detecção do cabeçalho.
  const input = text.replace(/^﻿/, '')

  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < input.length; index++) {
    const char = input[index]

    if (quoted) {
      if (char === '"') {
        if (input[index + 1] === '"') {
          field += '"'
          index++
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else if (char !== '\r') {
      field += char
    }
  }

  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Linha em branco no fim do arquivo é regra, não exceção.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

/**
 * Lê o arquivo como texto.
 *
 * Tenta UTF-8 e cai para Windows-1252 quando aparece o caractere de
 * substituição: o Excel em português ainda exporta assim, e sem essa segunda
 * tentativa "Alimentação" chegaria cheia de losangos de interrogação.
 */
export async function readText(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer()
  const utf8 = new TextDecoder('utf-8').decode(buffer)
  if (!utf8.includes('\uFFFD')) return utf8
  return new TextDecoder('windows-1252').decode(buffer)
}
