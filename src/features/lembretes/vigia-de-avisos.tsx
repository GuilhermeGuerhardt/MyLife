/**
 * Manda os avisos do sistema enquanto o Life está aberto, mesmo minimizado.
 *
 * Montado uma vez na raiz, como o aviso de atualização, e não desenha nada.
 * Olha na abertura e a cada 15 minutos. Não olha a cada mudança nos dados de
 * propósito: quem acabou de lançar a conta de amanhã não precisa de um balão
 * dizendo que ela vence amanhã.
 */

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ehJanelaSecundaria } from '@/components/layout/janela-solta'
import {
  useAccountChecks,
  useAccounts,
  useDeadlines,
  useHabitLogs,
  useHabits,
  useRecurring,
  useTasks,
  useTransactions,
} from '@/data/queries'
import {
  agruparEnvios,
  anotarEnviados,
  lembretesDeAgora,
  naoEnviados,
  type DadosDosLembretes,
} from '@/lib/lembretes/lembretes'
import { notificar, permissaoDeAviso } from '@/lib/notificacao'
import { today } from '@/lib/utils'
import {
  EVENTO_AVISOS,
  gravarEnviados,
  lerEnviados,
  lerPreferencias,
} from './preferencias'

const INTERVALO = 15 * 60_000

export function VigiaDeAvisos() {
  const navigate = useNavigate()
  const contas = useAccounts()
  const lancamentos = useTransactions()
  const conferencias = useAccountChecks()
  const recorrentes = useRecurring()
  const prazos = useDeadlines()
  const tarefas = useTasks()
  const habitos = useHabits()
  const registros = useHabitLogs()

  const [preferencias, setPreferencias] = useState(lerPreferencias)
  const [tique, setTique] = useState(0)

  const carregando = [
    contas,
    lancamentos,
    conferencias,
    recorrentes,
    prazos,
    tarefas,
    habitos,
    registros,
  ].some((colecao) => colecao.isLoading)

  // Os dados entram por ref: como dependência do efeito, cada lançamento novo
  // dispararia uma checagem, que é justamente o que não se quer.
  const dados = useRef<Omit<DadosDosLembretes, 'hoje' | 'hora'> | null>(null)
  dados.current = {
    contas: contas.data,
    lancamentos: lancamentos.data,
    conferencias: conferencias.data,
    recorrentes: recorrentes.data,
    prazos: prazos.data,
    tarefas: tarefas.data,
    habitos: habitos.data,
    registrosDeHabito: registros.data,
  }

  useEffect(() => {
    const aoMudar = () => {
      setPreferencias(lerPreferencias())
      setTique((valor) => valor + 1)
    }
    const relogio = window.setInterval(() => setTique((valor) => valor + 1), INTERVALO)
    window.addEventListener(EVENTO_AVISOS, aoMudar)
    return () => {
      window.clearInterval(relogio)
      window.removeEventListener(EVENTO_AVISOS, aoMudar)
    }
  }, [])

  useEffect(() => {
    // A janela de escrever anotação também monta a raiz do app. Se ela avisasse
    // junto, cada balão sairia duas vezes.
    if (!preferencias.ligado || carregando || !dados.current || ehJanelaSecundaria()) return

    let cancelado = false
    void (async () => {
      if ((await permissaoDeAviso()) !== 'concedida' || cancelado || !dados.current) return

      const hoje = today()
      const agora = lembretesDeAgora(
        { ...dados.current, hoje, hora: new Date().getHours() },
        new Set(preferencias.tipos),
      )
      const enviados = lerEnviados()
      const novos = naoEnviados(agora, enviados)
      if (novos.length === 0) return

      // Anota antes de mandar: se a tela recarregar no meio, o pior caso é um
      // aviso perdido, e não o mesmo aviso duas vezes.
      gravarEnviados(anotarEnviados(enviados, novos.map((lembrete) => lembrete.id), hoje))
      for (const envio of agruparEnvios(novos)) {
        await notificar(envio.titulo, envio.corpo, () => navigate(envio.rota))
      }
    })()

    return () => {
      cancelado = true
    }
  }, [preferencias, carregando, tique, navigate])

  return null
}
