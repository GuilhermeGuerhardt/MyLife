import { Info, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/** A porta de entrada da importação: arrastar o CSV ou escolher pelo diálogo. */
export function ImportFilePicker({
  onPick,
  error,
}: {
  onPick: (file: File) => void
  error: string | null
}) {
  const input = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <Card>
      <CardContent>
        <div
          onDragOver={(event) => {
            event.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault()
            setDragging(false)
            const file = event.dataTransfer.files[0]
            if (file) onPick(file)
          }}
          className={cn(
            'flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-12 text-center transition-colors',
            dragging ? 'border-accent bg-accent-soft' : 'border-border-base',
          )}
        >
          <Upload className="text-fg-subtle size-6" />
          <p className="text-fg mt-3 text-sm font-medium">Arraste o CSV aqui</p>
          <p className="text-fg-muted mt-1 max-w-md text-xs">
            Exporte o extrato do outro app em CSV. O cabeçalho é reconhecido sozinho — e se o seu
            for diferente, dá para corrigir coluna por coluna na tela seguinte.
          </p>
          <Button className="mt-4" variant="secondary" onClick={() => input.current?.click()}>
            Escolher arquivo
          </Button>
          <input
            ref={input}
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) onPick(file)
              event.target.value = ''
            }}
          />
          {error && <p className="text-negative mt-4 text-xs">{error}</p>}
        </div>

        <div className="text-fg-subtle mt-4 flex items-start gap-2 text-xs">
          <Info className="mt-px size-3.5 shrink-0" />
          <p>
            Valor em reais (<code>R$ 1.130,00</code>), data em ISO ou dd/mm/aaaa, e uma coluna de
            situação como "Já foi pago" / "Falta pagar". Parcela escrita no nome —{' '}
            <code>Geladeira (5/48)</code> — vira parcelamento de verdade no app.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
