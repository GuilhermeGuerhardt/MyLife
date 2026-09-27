import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/field'

/** O campo de escrever uma tarefa nova, com o prazo opcional ao lado. */
export function NovaTarefa({ onCriar }: { onCriar: (titulo: string, prazo: string) => void }) {
  const [titulo, setTitulo] = useState('')
  const [prazo, setPrazo] = useState('')

  function criar() {
    const texto = titulo.trim()
    if (!texto) return
    onCriar(texto, prazo)
    setTitulo('')
    setPrazo('')
  }

  return (
    <Card className="shrink-0">
      <CardContent className="flex flex-wrap items-center gap-2">
        <Input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') criar()
          }}
          placeholder="O que precisa ser feito?"
          className="min-w-[14rem] flex-1"
        />
        <Input
          type="date"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value)}
          className="w-40"
          aria-label="Prazo (opcional)"
        />
        <Button onClick={criar} disabled={titulo.trim() === ''}>
          <Plus />
          Adicionar
        </Button>
      </CardContent>
    </Card>
  )
}
