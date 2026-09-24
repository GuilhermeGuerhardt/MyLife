/**
 * O andamento da importação no canto inferior direito.
 *
 * Mesmo canto e mesmo formato do aviso de atualização, de propósito: é onde o
 * app já fala sem interromper. Com a tela de Planilhas aberta, o andamento e o
 * recibo não aparecem aqui — ela mostra os dois inteiros, e dois lugares
 * dizendo a mesma coisa ao mesmo tempo é ruído. A falha é a exceção: aquela a
 * tela não tem onde contar.
 */

import { AlertTriangle, Check, FileSpreadsheet } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/misc'
import { Toast, ToastArea } from '@/components/ui/toast'
import { descreverResultado } from '@/lib/finance/import-result'
import { useImportRun } from './import-run'

/** A tela que já mostra tudo por conta própria. */
const TELA_DA_IMPORTACAO = '/financeiro/importar'

export function ImportWatcher() {
  const { estado, dispensar } = useImportRun()
  const navigate = useNavigate()
  const naTela = useLocation().pathname === TELA_DA_IMPORTACAO

  if (estado.kind === 'parado') return null
  // A tela de Planilhas mostra o andamento e o recibo por conta própria; o que
  // ela não tem é onde dizer que a gravação parou no meio, então o aviso de
  // falha aparece mesmo ali. Sem isso, o botão "Abrir Planilhas" levava a uma
  // tela que não falava da falha.
  if (naTela && estado.kind !== 'erro') return null
  if (estado.kind === 'rodando' && estado.oculto) return null
  if (estado.kind === 'concluido' && estado.visto) return null

  const recibo = estado.kind === 'concluido' ? descreverResultado(estado.resultado) : null

  return (
    <ToastArea>
      {estado.kind === 'rodando' && (
        <Toast
          tone="accent"
          icon={<FileSpreadsheet className="size-4" />}
          title="Importando a planilha"
          description={
            <div className="space-y-1.5 pt-1">
              <Progress value={estado.progresso.done} max={estado.progresso.total} />
              <p>
                {estado.progresso.total === 0
                  ? `Preparando ${estado.arquivo}…`
                  : `${estado.progresso.done} de ${estado.progresso.total} — pode continuar usando o app.`}
              </p>
            </div>
          }
          // Fica até terminar: é uma barra andando, não um recado. E o "x"
          // fecha o cartão sem parar a gravação.
          duration={null}
          onClose={dispensar}
        />
      )}

      {estado.kind === 'concluido' && recibo && (
        <Toast
          tone="accent"
          icon={<Check className="size-4" />}
          title={recibo.titulo}
          description={recibo.detalhe}
          duration={null}
          onClose={dispensar}
          actions={
            <Button
              size="sm"
              onClick={() => {
                dispensar()
                navigate('/financeiro/transacoes')
              }}
            >
              Ver lançamentos
            </Button>
          }
        />
      )}

      {estado.kind === 'erro' && (
        <Toast
          icon={<AlertTriangle className="size-4" />}
          title="A importação parou no meio"
          description={`${estado.mensagem} O que já foi gravado continua lá.`}
          // Com botão, fica: sumir sozinho seria tirar a saída da mão de quem
          // acabou de ler que algo deu errado.
          duration={null}
          onClose={dispensar}
          actions={
            // Quem já está em Planilhas não precisa de um botão para ir a
            // Planilhas: ali o caminho é trazer o arquivo de novo.
            naTela ? undefined : (
              <Button size="sm" variant="secondary" onClick={() => navigate(TELA_DA_IMPORTACAO)}>
                Abrir Planilhas
              </Button>
            )
          }
        />
      )}
    </ToastArea>
  )
}
