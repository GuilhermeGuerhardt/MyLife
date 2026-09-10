import { Award, Download, FileText, Upload, X, ZoomIn } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import {
  arquivoParaCertificado,
  bytesDoDataUrl,
  CERTIFICADO_ACCEPT,
  ehImagem,
  ehPdf,
  nomeDoCertificado,
  tamanhoAproximado,
} from '@/lib/education/certificate'
import { CERTIFICADO_PDF, salvarArquivo } from '@/lib/salvar-arquivo'
import { cn } from '@/lib/utils'

const kb = (dataUrl: string) => `${Math.round(tamanhoAproximado(dataUrl) / 1024)} kB`

/**
 * Campo de certificado do formulário de curso.
 *
 * Aceita imagem ou PDF. A imagem é reduzida e vira o próprio certificado; o PDF
 * é guardado inteiro e ganha uma miniatura da primeira página, porque é ele que
 * se reenvia para uma empresa depois. Quem prefere apontar para o certificado
 * hospedado na plataforma continua podendo colar só um endereço no campo Link.
 */
export function CertificateField({
  imagem,
  pdf,
  onChange,
  className,
}: {
  imagem: string | null
  pdf: string | null
  onChange: (valor: { imagem: string | null; pdf: string | null }) => void
  className?: string
}) {
  const input = useRef<HTMLInputElement>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(false)

  const temPdf = ehPdf(pdf)
  const temImagem = ehImagem(imagem)

  async function escolher(arquivo: File | undefined) {
    if (!arquivo) return
    setErro(null)
    setCarregando(true)
    try {
      const certificado = await arquivoParaCertificado(arquivo)
      onChange({ imagem: certificado.imagem, pdf: certificado.pdf })
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível usar este arquivo.')
    } finally {
      setCarregando(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <span className="text-fg-muted block text-xs font-medium">Certificado</span>

      <div className="flex items-start gap-3">
        {temImagem ? (
          <CertificateThumb
            imagem={imagem}
            pdf={pdf}
            title="Certificado"
            className="size-16 shrink-0"
          />
        ) : (
          <div className="bg-surface-2 border-border-base text-fg-subtle flex size-16 shrink-0 items-center justify-center rounded-lg border border-dashed">
            <Award className="size-5" />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={carregando}
              onClick={() => input.current?.click()}
            >
              <Upload />
              {carregando ? 'Processando…' : temImagem ? 'Trocar arquivo' : 'Enviar arquivo'}
            </Button>
            {(temImagem || temPdf) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setErro(null)
                  onChange({ imagem: null, pdf: null })
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
            ) : temPdf ? (
              <>
                PDF guardado ({kb(pdf)}). O cartão do curso mostra a primeira página.
              </>
            ) : temImagem ? (
              <>Imagem guardada ({kb(imagem)}). Aparece no cartão do curso.</>
            ) : (
              'PNG, JPG, WEBP ou PDF. Imagem é reduzida antes de ser guardada; PDF vai inteiro, até 1,5 MB.'
            )}
          </p>
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept={CERTIFICADO_ACCEPT}
        className="hidden"
        onChange={(event) => void escolher(event.target.files?.[0])}
      />
    </div>
  )
}

/**
 * Miniatura clicável do certificado.
 *
 * No cartão ela é pequena de propósito — ali serve de marca de conclusão. O
 * clique abre o documento inteiro: a imagem, ou o PDF no leitor do próprio
 * navegador, com a opção de salvá-lo de volta em disco.
 */
export function CertificateThumb({
  imagem,
  pdf,
  title,
  className,
}: {
  imagem: string
  pdf?: string | null
  title: string
  className?: string
}) {
  const [aberto, setAberto] = useState(false)
  const temPdf = ehPdf(pdf)

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        aria-label={`Ver certificado de ${title}`}
        className={cn(
          'group border-border-base bg-surface-2 relative shrink-0 overflow-hidden rounded-lg border',
          'hover:border-accent focus-visible:border-accent transition-colors',
          className,
        )}
      >
        <img src={imagem} alt="" className="size-full object-cover" />
        {temPdf && (
          <span
            className="bg-surface/85 text-fg-muted absolute right-0 bottom-0 rounded-tl px-1 text-[8px] leading-tight font-semibold"
            aria-hidden
          >
            PDF
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity group-hover:opacity-100">
          <ZoomIn className="size-4 text-white" />
        </span>
      </button>

      {aberto && (
        <CertificateViewer
          imagem={imagem}
          pdf={temPdf ? pdf : null}
          title={title}
          onClose={() => setAberto(false)}
        />
      )}
    </>
  )
}

function CertificateViewer({
  imagem,
  pdf,
  title,
  onClose,
}: {
  imagem: string
  pdf: string | null
  title: string
  onClose: () => void
}) {
  const [salvando, setSalvando] = useState(false)

  /**
   * O PDF é exibido por uma URL de blob, não pela `data:` URL guardada.
   *
   * O leitor embutido do navegador recusa `data:` num quadro — a moldura ficaria
   * cinza e vazia, sem erro nenhum na tela.
   */
  const [endereco, setEndereco] = useState<string | null>(null)

  useEffect(() => {
    if (!pdf) return
    const blob = new Blob([bytesDoDataUrl(pdf) as BlobPart], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    setEndereco(url)
    return () => URL.revokeObjectURL(url)
  }, [pdf])

  async function salvar() {
    if (!pdf) return
    setSalvando(true)
    try {
      await salvarArquivo(nomeDoCertificado(title), bytesDoDataUrl(pdf), CERTIFICADO_PDF)
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Certificado"
      description={title}
      size="wide"
      footer={
        pdf ? (
          <Button variant="secondary" onClick={() => void salvar()} disabled={salvando}>
            <Download />
            {salvando ? 'Salvando…' : 'Salvar PDF'}
          </Button>
        ) : undefined
      }
    >
      {pdf ? (
        endereco ? (
          <iframe
            src={endereco}
            title={`Certificado de ${title}`}
            className="border-border-base h-[70vh] w-full rounded-lg border bg-white"
          />
        ) : (
          <div className="text-fg-subtle flex h-40 items-center justify-center gap-2 text-sm">
            <FileText className="size-4" />
            Abrindo o PDF…
          </div>
        )
      ) : (
        <img src={imagem} alt={`Certificado de ${title}`} className="w-full rounded-lg" />
      )}
    </Modal>
  )
}
