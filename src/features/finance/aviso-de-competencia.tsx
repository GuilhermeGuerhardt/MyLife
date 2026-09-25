/**
 * "Salvei, mas não foi neste mês."
 *
 * Uma compra no cartão feita depois do fechamento entra na fatura do mês
 * seguinte — está certo, e é justamente o que o app existe para acertar. O
 * problema era o silêncio: a tela continuava no mês aberto, o lançamento não
 * aparecia nele, e de fora parecia que o app tinha ignorado a compra. O
 * contrário era verdade.
 *
 * Vale para qualquer lançamento que caia fora do mês que está na tela, não só
 * para cartão: datar uma despesa para o mês que vem tem o mesmo efeito.
 *
 * O aviso não muda o mês sozinho — quem está lançando três compras seguidas não
 * quer a tela pulando entre elas. Ele conta o que houve e oferece a ida.
 */

import { ArrowRight, CalendarCheck } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Toast, ToastArea } from '@/components/ui/toast'
import { competenceLabel, type Competence } from '@/lib/finance/billing'

export function useAvisoDeCompetencia(
  /** O mês que está aberto na tela. */
  visivel: Competence,
  onIr: (competence: Competence) => void,
) {
  const [caiuEm, setCaiuEm] = useState<Competence | null>(null)

  return {
    /** Chame com o que `createTransaction` devolveu. */
    avisar(competence: Competence | null) {
      setCaiuEm(competence && competence !== visivel ? competence : null)
    },

    aviso: caiuEm && (
      <ToastArea>
        <Toast
          tone="accent"
          icon={<CalendarCheck className="size-4" />}
          title={`Lançado em ${competenceLabel(caiuEm)}`}
          description={`Você está vendo ${competenceLabel(visivel)}, então ele não aparece aqui. No cartão, a compra entra na fatura que a inclui.`}
          duration={null}
          onClose={() => setCaiuEm(null)}
          actions={
            <Button
              size="sm"
              onClick={() => {
                onIr(caiuEm)
                setCaiuEm(null)
              }}
            >
              Ver {competenceLabel(caiuEm)}
              <ArrowRight />
            </Button>
          }
        />
      </ToastArea>
    ),
  }
}
