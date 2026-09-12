import { isTauri } from '@tauri-apps/api/core'
import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Toggle } from '@/components/ui/misc'
import { buscaAtivada, definirBusca } from './use-updater'

/**
 * O interruptor da busca por atualização.
 *
 * Existe porque o Life promete funcionar offline, e uma consulta à internet a
 * cada abertura merece ser recusável. Desligado, o programa não toca na rede
 * em momento nenhum.
 *
 * Só aparece no programa de desktop: no navegador não há instalação a trocar.
 */
export function UpdatesCard() {
  const [ativa, setAtiva] = useState(buscaAtivada)

  if (!isTauri()) return null

  const alternar = (valor: boolean) => {
    setAtiva(valor)
    definirBusca(valor)
  }

  return (
    <Card>
      <CardHeader
        title="Atualizações"
        description="Vale para este aparelho, como o tema."
      />
      <CardContent>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-fg text-sm font-medium">Buscar versão nova ao abrir</p>
            <p className="text-fg-muted mt-0.5 text-xs leading-relaxed">
              {ativa
                ? 'O Life consulta o GitHub alguns segundos depois de abrir. Só avisa se houver novidade — nada é baixado sem você mandar.'
                : 'O Life não toca na internet. Para atualizar, baixe o instalador novo e execute por cima.'}
            </p>
          </div>
          <Toggle checked={ativa} onChange={alternar} label="Buscar atualizações ao abrir" />
        </div>
      </CardContent>
    </Card>
  )
}
