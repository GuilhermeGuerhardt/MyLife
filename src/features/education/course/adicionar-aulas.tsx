import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/field'
import { Modal } from '@/components/ui/modal'

/**
 * Adiciona várias aulas de uma vez.
 *
 * Copiar o índice do curso e colar aqui é infinitamente mais rápido do que
 * cadastrar aula por aula em formulário — e é assim que a lista chega: numerada,
 * uma por linha.
 */
export function AdicionarAulas({
  startPosition,
  onClose,
  onSave,
}: {
  startPosition: number
  onClose: () => void
  onSave: (moduleName: string, titles: string[], duration: number) => Promise<void>
}) {
  const [moduleName, setModuleName] = useState('')
  const [text, setText] = useState('')
  const [minutes, setMinutes] = useState('10')

  const titles = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    <Modal
      open
      onClose={onClose}
      title="Adicionar aulas"
      description="Uma aula por linha. Numeração no começo da linha é removida automaticamente."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={titles.length === 0}
            onClick={() =>
              void onSave(
                moduleName.trim() || 'Geral',
                titles.map(semNumeracao),
                Number(minutes) || 0,
              )
            }
          >
            Adicionar{' '}
            {titles.length > 0 ? `${titles.length} aula${titles.length > 1 ? 's' : ''}` : ''}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Módulo" hint="Agrupa as aulas na listagem.">
            <Input
              autoFocus
              value={moduleName}
              placeholder="Fundamentos"
              onChange={(e) => setModuleName(e.target.value)}
            />
          </Field>
          <Field label="Duração de cada aula" suffix="min">
            <Input inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </Field>
        </div>

        <Field label="Aulas">
          <Textarea
            className="min-h-48 font-mono text-xs"
            value={text}
            placeholder={'1. Introdução\n2. Instalando o ambiente\n3. Primeiro projeto'}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>

        {titles.length > 0 && (
          <p className="text-fg-subtle text-xs">
            {titles.length} aula{titles.length > 1 ? 's' : ''} a partir da posição{' '}
            {startPosition + 1}.
          </p>
        )}
      </div>
    </Modal>
  )
}

/** "3. Primeiro projeto" vira "Primeiro projeto"; linha sem número fica igual. */
function semNumeracao(line: string): string {
  return line.replace(/^\s*\d+[.)\-–]\s*/, '').trim() || line
}
