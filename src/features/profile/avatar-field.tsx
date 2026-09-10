import { Camera, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Avatar } from '@/components/avatar'
import { Button } from '@/components/ui/button'
import { arquivoParaAvatar, AVATAR_ACCEPT } from '@/lib/avatar'

/**
 * Foto de perfil no formulário.
 *
 * A prévia é o próprio `Avatar` do menu, no tamanho grande: o que se vê aqui é
 * exatamente o recorte que vai aparecer lá em cima, sem surpresa depois de
 * salvar.
 */
export function AvatarField({
  value,
  name,
  onChange,
}: {
  value: string | null
  name: string
  onChange: (value: string | null) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)
    setCarregando(true)
    try {
      onChange(await arquivoParaAvatar(arquivo))
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível usar esta imagem.')
    } finally {
      setCarregando(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar
        url={value}
        name={name}
        className="size-16 rounded-xl"
        textClassName="text-lg"
      />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={carregando}
            onClick={() => input.current?.click()}
          >
            <Camera />
            {carregando ? 'Processando…' : value ? 'Trocar foto' : 'Escolher foto'}
          </Button>
          {value && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setErro(null)
                onChange(null)
              }}
            >
              <X />
              Remover
            </Button>
          )}
        </div>

        <p className="text-fg-subtle text-xs">
          {erro ? (
            <span className="text-negative">{erro}</span>
          ) : value ? (
            'Aparece no topo do menu, ao lado do seu nome.'
          ) : (
            'Sem foto, o menu mostra as iniciais do seu nome. A imagem é recortada em quadrado pelo centro.'
          )}
        </p>
      </div>

      <input
        ref={input}
        type="file"
        accept={AVATAR_ACCEPT}
        className="hidden"
        onChange={(event) => void escolher(event.target.files?.[0])}
      />
    </div>
  )
}
