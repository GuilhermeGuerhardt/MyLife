/**
 * Quem de fato grava a planilha, longe da tela.
 *
 * Um componente sem nada para desenhar, montado pelo provedor enquanto houver
 * pedido. Existe porque gravar precisa dos hooks de dados — e um hook precisa
 * de um componente vivo. Este vive na raiz do app, então a navegação não o
 * alcança.
 */

import { startTransition, useEffect, useRef } from 'react'
import { useAccounts } from '@/data/queries'
import { useRunImport, type ImportPlan, type ImportProgress, type ImportResult } from './use-import'

/**
 * Espaço mínimo entre dois avisos de andamento.
 *
 * A gravação avisa a cada linha — milhares de vezes. Repassar tudo para o
 * estado enche a fila do React de trabalho de prioridade normal e a troca de
 * tela, que o React Router agenda como transição, fica para depois
 * indefinidamente: o endereço muda, a tela não. Era isto que prendia a pessoa
 * na tela de Planilhas.
 *
 * Cinco avisos por segundo é mais do que um olho lê numa barra.
 */
const INTERVALO_DO_AVISO_MS = 200

export function ImportRunner({
  plano,
  aoProgredir,
  aoTerminar,
  aoFalhar,
}: {
  plano: ImportPlan
  aoProgredir: (progresso: ImportProgress) => void
  aoTerminar: (resultado: ImportResult) => void
  aoFalhar: (mensagem: string) => void
}) {
  const runImport = useRunImport()
  // A gravação lê as contas para saber quais são cartão — é o que decide a
  // competência de cada lançamento. Começar antes de a lista chegar jogaria
  // tudo na competência da data. Na prática ela já está em cache quando se
  // clica em Importar; a espera é para o caso de não estar.
  const { isLoading: contasCarregando } = useAccounts()

  const iniciado = useRef(false)
  const ultimoAviso = useRef(0)

  useEffect(() => {
    if (iniciado.current || contasCarregando) return
    iniciado.current = true

    const avisar = (progresso: ImportProgress) => {
      const agora = performance.now()
      const ultimo = progresso.total > 0 && progresso.done >= progresso.total
      if (!ultimo && agora - ultimoAviso.current < INTERVALO_DO_AVISO_MS) return
      ultimoAviso.current = agora
      // Em transição: assim a barra nunca passa na frente de um clique no menu.
      startTransition(() => aoProgredir(progresso))
    }

    void (async () => {
      try {
        aoTerminar(await runImport(plano, avisar))
      } catch (falha) {
        aoFalhar(
          falha instanceof Error && falha.message
            ? falha.message
            : 'Não foi possível concluir a gravação.',
        )
      }
    })()
    // Uma vez por pedido: o provedor troca a `key` a cada importação. As funções
    // de retorno mudam a cada render e não podem reiniciar a gravação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contasCarregando])

  return null
}
