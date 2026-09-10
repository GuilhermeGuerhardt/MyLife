/**
 * Foto de perfil.
 *
 * Ela aparece em 24 px no topo do menu, então guardar a foto original seria
 * desperdício puro: 256 px cobrem até uma tela retina com folga, e a imagem
 * inteira cabe em poucos kB dentro do registro do perfil — logo, dentro do
 * backup e da pasta de sincronização.
 *
 * O recorte é quadrado e centralizado, porque é assim que ela é exibida. Cortar
 * na hora de guardar, e não no CSS, evita carregar pixels que nunca aparecem.
 */

import { carregarImagem, comprimirJpeg, ImagemInvalida } from '@/lib/image'

/** Lado do quadrado guardado, em pixels. */
const LADO = 256

/** Teto do `data:` URL. Uma foto de 256 px fica bem abaixo disso. */
export const AVATAR_MAX_BYTES = 120_000

export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp'

export { ImagemInvalida }

/** Converte a imagem escolhida no quadrado que vai para `avatar_url`. */
export async function arquivoParaAvatar(arquivo: File): Promise<string> {
  if (!arquivo.type.startsWith('image/')) {
    throw new ImagemInvalida('Escolha uma imagem (PNG, JPG ou WEBP).')
  }

  const imagem = await carregarImagem(arquivo)

  // O maior quadrado que cabe na foto, tirado do centro: é o enquadramento que
  // acerta num retrato sem pedir para a pessoa recortar antes.
  const lado = Math.min(imagem.width, imagem.height)
  const x = (imagem.width - lado) / 2
  const y = (imagem.height - lado) / 2

  const url = await comprimirJpeg(LADO, LADO, AVATAR_MAX_BYTES, (contexto) => {
    contexto.drawImage(imagem, x, y, lado, lado, 0, 0, LADO, LADO)
  })

  if (!url) throw new ImagemInvalida('Não foi possível reduzir esta imagem. Tente outra.')
  return url
}

/**
 * As iniciais que aparecem enquanto não há foto.
 *
 * Primeiro e último nome, ignorando as partículas: "Guilherme de Souza Lima"
 * vira GL, não GD. Nome de uma palavra só vira uma letra.
 */
export function iniciais(nome: string): string {
  const particulas = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
  const partes = nome
    .trim()
    .split(/\s+/)
    .filter((parte) => parte.length > 0 && !particulas.has(parte.toLowerCase()))

  if (partes.length === 0) return ''
  if (partes.length === 1) return partes[0]!.charAt(0).toUpperCase()
  return (partes[0]!.charAt(0) + partes[partes.length - 1]!.charAt(0)).toUpperCase()
}

/** Só o primeiro nome cabe no menu sem espremer o resto. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? ''
}
