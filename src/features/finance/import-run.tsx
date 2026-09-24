/**
 * A importação que não depende da tela estar aberta.
 *
 * Antes a gravação vivia dentro da página de Planilhas: sair dali no meio — até
 * para conferir um lançamento na tela do lado — desmontava justamente quem
 * segurava o andamento e o resultado, e a pessoa ficava sem saber se o arquivo
 * entrou inteiro. Numa planilha de duas mil linhas isso é mais de um minuto
 * preso numa tela só.
 *
 * Agora quem segura o pedido é este provedor, montado na raiz do app. A tela
 * manda importar e vai embora se quiser; o que estiver acontecendo aparece num
 * cartão no canto inferior direito, o mesmo canto do aviso de atualização.
 *
 * Aqui mora só a ligação com o React: as transições estão em
 * `import-run-state.ts`, testadas, e quem sabe gravar é o executor — que entra
 * por `lazy()` e só desce quando alguém importa de verdade, senão o código de
 * finanças iria no pacote inicial de todas as telas.
 */

import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import { PARADO, reduzir, type EstadoDaImportacao } from './import-run-state'
import type { ImportPlan } from './use-import'

export type { EstadoDaImportacao }

export interface ImportacaoEmCurso {
  estado: EstadoDaImportacao
  /** Põe o pedido para rodar. Ignorado se já houver um em andamento. */
  importar: (plano: ImportPlan, arquivo: string) => void
  /** O "x" do cartão: encerra o recibo, ou só esconde o andamento. */
  dispensar: () => void
  marcarVisto: () => void
}

const Contexto = createContext<ImportacaoEmCurso | null>(null)

const Executor = lazy(() =>
  import('./import-runner').then((modulo) => ({ default: modulo.ImportRunner })),
)

export function ImportRunProvider({ children }: { children: ReactNode }) {
  const [estado, despachar] = useReducer(reduzir, PARADO)

  // As ações nascem uma vez só. Identidade estável importa: a tela de Planilhas
  // tem um efeito que depende de `marcarVisto`, e uma função nova a cada render
  // faria esse efeito disparar a cada render — que foi exatamente o laço que
  // este arquivo já teve.
  const acoes = useMemo(
    () => ({
      importar: (plano: ImportPlan, arquivo: string) =>
        despachar({ tipo: 'comecar', plano, arquivo }),
      dispensar: () => despachar({ tipo: 'fechar' }),
      marcarVisto: () => despachar({ tipo: 'marcar-visto' }),
    }),
    [],
  )

  const valor = useMemo<ImportacaoEmCurso>(() => ({ estado, ...acoes }), [estado, acoes])

  return (
    <Contexto.Provider value={valor}>
      {children}
      {/* O executor existe enquanto — e só enquanto — há o que gravar. Sai da
          árvore no fim, e a importação seguinte monta um novo, zerado. */}
      {estado.kind === 'rodando' && (
        <Suspense fallback={null}>
          <Executor
            plano={estado.plano}
            aoProgredir={(progresso) => despachar({ tipo: 'progresso', progresso })}
            aoTerminar={(resultado) => despachar({ tipo: 'concluir', resultado })}
            aoFalhar={(mensagem) => despachar({ tipo: 'falhar', mensagem })}
          />
        </Suspense>
      )}
    </Contexto.Provider>
  )
}

export function useImportRun(): ImportacaoEmCurso {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useImportRun precisa do ImportRunProvider acima na árvore.')
  return valor
}
