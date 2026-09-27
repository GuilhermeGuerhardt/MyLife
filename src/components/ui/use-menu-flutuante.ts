/**
 * Fechar o menu ao clicar fora dele.
 *
 * As paletas de cor e o menu de exportar são `<details>`: abrem e fecham pelo
 * teclado, não custam estado no React e não precisam de biblioteca. O que o
 * `<details>` não faz — apesar de ser o que todo menu faz — é fechar quando se
 * clica em outro lugar. Ficavam abertos até alguém clicar de novo no mesmo
 * botão, e a paleta de cor ainda por cima cobre o texto que se estava editando.
 *
 * `mousedown` e não `click`: fecha no mesmo instante em que o dedo desce, antes
 * de o alvo lá fora receber o clique — sem o menu piscando por cima do que a
 * pessoa foi acertar.
 */

import { useEffect, useRef } from 'react'

export function useMenuFlutuante() {
  const referencia = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    const fechar = () => {
      const menu = referencia.current
      if (menu?.open) menu.open = false
    }

    const aoClicar = (evento: MouseEvent) => {
      const menu = referencia.current
      if (menu?.open && !menu.contains(evento.target as Node)) fechar()
    }

    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') fechar()
    }

    document.addEventListener('mousedown', aoClicar)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicar)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [])

  return referencia
}
