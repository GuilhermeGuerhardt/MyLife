/**
 * A anotação formatada, limpa.
 *
 * O conteúdo saiu do editor da própria pessoa, mas passa pelo DOMPurify assim
 * mesmo: colar um trecho de site traz junto o que vier, e "conteúdo próprio"
 * deixa de ser confiável no instante em que se cola algo de fora.
 *
 * Mora fora do componente de leitura porque a impressão precisa exatamente da
 * mesma limpeza: o PDF é montado escrevendo a anotação dentro de um documento
 * que é do próprio app, e mandar o HTML cru para lá seria justamente o caminho
 * que a leitura fecha. Duas listas de permissões acabariam diferentes.
 *
 * O `style` é liberado — sem ele a cor da letra e a do sublinhado, que são o
 * motivo do editor formatado existir, sumiriam.
 */

import DOMPurify from 'dompurify'

const LIMPEZA = {
  USE_PROFILES: { html: true },
  ADD_ATTR: ['style', 'data-nota', 'data-cor', 'data-type', 'data-checked'],
}

export function htmlLimpoDaNota(html: string): string {
  return DOMPurify.sanitize(html ?? '', LIMPEZA)
}
