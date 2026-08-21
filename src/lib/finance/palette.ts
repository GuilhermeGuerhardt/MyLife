/**
 * Cores dos gráficos por categoria.
 *
 * Um gráfico de pizza só comunica se cada fatia tiver uma cor própria — duas
 * fatias iguais viram uma mancha só, e a legenda deixa de servir para localizar
 * qual pedaço é qual. Só que a cor mora na categoria, e nem toda categoria tem
 * uma boa: as criadas pela importação de planilha nasciam todas com o mesmo
 * cinza, e despesa sem categoria nenhuma não tem cor alguma.
 *
 * Daí a regra aqui ser em duas camadas: a cor escolhida para a categoria manda
 * (Mercado continua verde em todo gráfico do app, o que é metade do valor de
 * ter cor), e só quando ela falta — ou repetiria uma fatia anterior — é que a
 * paleta de reserva entra, sempre no próximo tom ainda não usado.
 */

/**
 * Tons de reserva, em ordem de uso.
 *
 * Escolhidos para se distinguirem lado a lado e para funcionar nos dois temas:
 * são as mesmas famílias já usadas no catálogo de categorias, sem os tons
 * escuros demais para o fundo preto nem claros demais para o branco.
 */
export const CHART_PALETTE = [
  '#3b82f6', // azul
  '#22c55e', // verde
  '#f97316', // laranja
  '#a855f7', // roxo
  '#ef4444', // vermelho
  '#14b8a6', // turquesa
  '#eab308', // amarelo
  '#ec4899', // rosa
  '#8b5cf6', // violeta
  '#84cc16', // limão
] as const

/** Cor de quem não tem categoria — neutra de propósito, para não competir. */
export const NO_CATEGORY_COLOR = '#71717a'

/**
 * Tons oferecidos ao escolher a cor de uma categoria.
 *
 * Superconjunto da paleta do gráfico, porque o catálogo que vem pronto já gasta
 * quase vinte tons: com só os dez da reserva, toda cor apareceria como "já
 * usada" e a escolha viraria uma decisão sem opções. Aqui a lista é larga o
 * bastante para uma categoria nova ainda encontrar cor só dela.
 */
export const PICKER_COLORS = [
  '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981',
  '#22c55e', '#84cc16', '#eab308', '#f59e0b', '#f97316',
  '#ef4444', '#f43f5e', '#ec4899', '#a855f7', '#8b5cf6',
  '#6366f1', '#64748b', '#71717a',
] as const

/**
 * Garante uma cor distinta por item, preservando a da categoria quando dá.
 *
 * `color` nulo (ou repetido) é substituído pelo próximo tom livre da paleta.
 * A ordem importa: quem vem primeiro fica com a própria cor, e é por isso que
 * a lista deve chegar aqui já ordenada por valor — a fatia maior é a que mais
 * merece manter a identidade visual dela.
 */
/*
 * `Omit` e não `T & { color: string }`: a interseção vira `never` quando o
 * chamador passa um objeto cujo `color` é literalmente `null`, que é
 * exatamente o caso que esta função existe para resolver.
 */
export function resolveSliceColors<T extends { color: string | null }>(
  items: T[],
): Array<Omit<T, 'color'> & { color: string }> {
  /*
   * Toda cor própria é reservada antes de distribuir qualquer reserva.
   *
   * Sem esta primeira passada, uma categoria sem cor que aparecesse antes do
   * Mercado levaria o verde da paleta, e o Mercado — que é verde de verdade —
   * acabaria laranja. A cor escolhida tem que ganhar da cor sorteada, mesmo
   * quando o dono dela está no fim da lista.
   */
  const reservadas = new Set(items.map((item) => item.color).filter(Boolean) as string[])
  const usadas = new Set<string>()

  const proximaLivre = (): string => {
    // Primeira escolha: tom que ninguém usa nem reservou.
    const livre = CHART_PALETTE.find((cor) => !usadas.has(cor) && !reservadas.has(cor))
    if (livre) return livre
    // Todas reservadas: aceita repetir uma reserva, desde que não repita uma
    // fatia já desenhada — é o que ainda mantém o gráfico legível.
    return CHART_PALETTE.find((cor) => !usadas.has(cor)) ?? NO_CATEGORY_COLOR
  }

  return items.map((item) => {
    const color = !item.color || usadas.has(item.color) ? proximaLivre() : item.color
    usadas.add(color)
    return { ...item, color }
  })
}
