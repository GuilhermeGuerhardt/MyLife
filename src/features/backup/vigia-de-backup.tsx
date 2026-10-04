/**
 * Faz o backup automático do dia, sem ninguém pedir.
 *
 * Olha na abertura e de hora em hora: quem deixa o Life aberto por dias
 * seguidos também ganha a cópia de cada dia, e não só quem fecha e abre.
 * Montado uma vez na raiz, não desenha nada.
 */

import { useEffect } from 'react'
import { ehJanelaSecundaria } from '@/components/layout/janela-solta'
import {
  EVENTO_BACKUP,
  backupAutomaticoDisponivel,
  executarBackupAutomatico,
  lerConfigDoBackup,
} from '@/data/backup-automatico'
import { precisaDeBackup } from '@/lib/backup/automatico'
import { today } from '@/lib/utils'

const INTERVALO = 60 * 60_000

/** Uma tentativa por vez: a do relógio e a da abertura podiam se cruzar. */
let rodando = false

async function talvezFazer(): Promise<void> {
  const config = lerConfigDoBackup()
  if (rodando || !config.pasta || !precisaDeBackup(config.ultimo, today())) return
  rodando = true
  try {
    await executarBackupAutomatico(today())
  } finally {
    rodando = false
  }
}

export function VigiaDeBackup() {
  useEffect(() => {
    // A janela de escrever anotação também monta a raiz: duas gravando o mesmo
    // arquivo ao mesmo tempo é o que a fila de escrita existe para evitar.
    if (!backupAutomaticoDisponivel() || ehJanelaSecundaria()) return

    void talvezFazer()
    const relogio = window.setInterval(() => void talvezFazer(), INTERVALO)
    const aoMudar = () => void talvezFazer()
    window.addEventListener(EVENTO_BACKUP, aoMudar)
    return () => {
      window.clearInterval(relogio)
      window.removeEventListener(EVENTO_BACKUP, aoMudar)
    }
  }, [])

  return null
}
