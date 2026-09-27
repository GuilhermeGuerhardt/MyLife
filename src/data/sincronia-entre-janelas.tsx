/**
 * O ouvido de cada janela.
 *
 * Montado uma vez na raiz: quando outra janela avisa que mexeu numa tabela,
 * esta relê aquela tabela e a tela se atualiza sozinha. É o que faz a anotação
 * escrita na janela destacada aparecer na lista da janela principal sem
 * ninguém precisar recarregar nada.
 */

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { ouvirMudancas } from '@/lib/sincronia'

export function SincroniaEntreJanelas() {
  const client = useQueryClient()

  useEffect(
    () => ouvirMudancas((tabela) => void client.invalidateQueries({ queryKey: [tabela] })),
    [client],
  )

  return null
}
