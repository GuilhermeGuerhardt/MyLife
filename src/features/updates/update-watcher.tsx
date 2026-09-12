/**
 * O aviso de atualização, no canto inferior direito.
 *
 * Montado uma vez na raiz do app. Na maior parte das aberturas não desenha
 * nada — que é o comportamento correto quando já se está na última versão.
 */

import { AlertTriangle, Download, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/misc'
import { Toast, ToastArea } from '@/components/ui/toast'
import { useUpdater } from './use-updater'

export function UpdateWatcher() {
  const { estado, instalar, dispensar } = useUpdater()

  if (estado.kind === 'quieto') return null

  return (
    <ToastArea>
      {estado.kind === 'sem-rede' && (
        <Toast
          icon={<WifiOff className="size-4" />}
          title="Sem conexão"
          description="Não deu para verificar se há atualização."
          onClose={dispensar}
        />
      )}

      {estado.kind === 'disponivel' && (
        <Toast
          tone="accent"
          icon={<Download className="size-4" />}
          title={`Versão ${estado.versao} disponível`}
          description={estado.notas ? <Notas texto={estado.notas} /> : 'Uma atualização do Life está pronta para instalar.'}
          // Fica parado: instalar reinicia o app, e isso não pode acontecer
          // por um aviso que a pessoa não chegou a ler.
          duration={null}
          onClose={dispensar}
          actions={
            <>
              <Button variant="ghost" size="sm" onClick={dispensar}>
                Agora não
              </Button>
              <Button size="sm" onClick={() => void instalar()}>
                Atualizar
              </Button>
            </>
          }
        />
      )}

      {estado.kind === 'baixando' && (
        <Toast
          tone="accent"
          icon={<Download className="size-4" />}
          title="Baixando a atualização"
          description={
            <div className="space-y-1.5 pt-1">
              <Progress value={estado.percent ?? 0} max={100} />
              <p>
                {estado.percent === null
                  ? 'Aguarde…'
                  : `${Math.round(estado.percent)}% — o Life reinicia sozinho ao terminar.`}
              </p>
            </div>
          }
          duration={null}
          onClose={dispensar}
        />
      )}

      {estado.kind === 'erro' && (
        <Toast
          icon={<AlertTriangle className="size-4" />}
          title="A atualização falhou"
          description={`${estado.mensagem} Você pode baixar o instalador novo pelo GitHub.`}
          duration={8000}
          onClose={dispensar}
        />
      )}
    </ToastArea>
  )
}

/** As notas da release em texto corrido, cortadas no que cabe num aviso. */
function Notas({ texto }: { texto: string }) {
  const limpo = texto.trim().split('\n').slice(0, 3).join(' ').slice(0, 160)
  return <>{limpo}</>
}
