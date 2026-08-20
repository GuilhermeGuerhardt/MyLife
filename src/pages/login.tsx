import { ArrowLeft, Loader2, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, Input } from '@/components/ui/field'
import { useAuth } from '@/features/auth/auth-context'

type Mode = 'signin' | 'signup' | 'recover'

const TITLES: Record<Mode, { title: string; description: string; submit: string }> = {
  signin: {
    title: 'Entrar',
    description: 'Seus dados ficam no seu banco, protegidos por sessão.',
    submit: 'Entrar',
  },
  signup: {
    title: 'Criar conta',
    description: 'Um e-mail e uma senha bastam. Nada além disso é pedido.',
    submit: 'Criar conta',
  },
  recover: {
    title: 'Recuperar senha',
    description: 'Enviamos um link para você definir uma senha nova.',
    submit: 'Enviar link',
  },
}

export function LoginPage() {
  const { signIn, signUp, resetPassword } = useAuth()

  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const labels = TITLES[mode]

  function switchTo(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)

    try {
      if (mode === 'recover') {
        await resetPassword(email.trim())
        setNotice('Se existe conta com este e-mail, o link acabou de sair. Confira a caixa de entrada.')
      } else if (mode === 'signup') {
        const { needsConfirmation } = await signUp(email.trim(), password)
        if (needsConfirmation) {
          setNotice('Conta criada. Confirme pelo link que enviamos por e-mail para poder entrar.')
          setMode('signin')
        }
        // Sem confirmação por e-mail, a sessão já vem pronta e o app troca de
        // tela sozinho — não há o que fazer aqui.
      } else {
        await signIn(email.trim(), password)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível concluir.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-bg flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2 text-center">
          <div className="bg-accent text-accent-fg mx-auto flex size-11 items-center justify-center rounded-2xl text-xl font-semibold">
            L
          </div>
          <h1 className="text-fg text-xl font-semibold">{labels.title}</h1>
          <p className="text-fg-muted text-sm">{labels.description}</p>
        </div>

        <Card>
          <CardContent>
            <form className="space-y-4" onSubmit={(event) => void handleSubmit(event)}>
              <Field label="E-mail">
                <Input
                  type="email"
                  value={email}
                  autoFocus
                  autoComplete="email"
                  required
                  placeholder="voce@exemplo.com"
                  onChange={(event) => setEmail(event.target.value)}
                />
              </Field>

              {mode !== 'recover' && (
                <Field
                  label="Senha"
                  hint={mode === 'signup' ? 'Pelo menos 6 caracteres.' : undefined}
                >
                  <Input
                    type="password"
                    value={password}
                    required
                    minLength={6}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    placeholder="••••••••"
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </Field>
              )}

              {error && (
                <p className="text-negative bg-negative/10 rounded-lg px-3 py-2 text-xs font-medium">
                  {error}
                </p>
              )}
              {notice && (
                <p className="text-positive bg-positive/10 flex items-start gap-2 rounded-lg px-3 py-2 text-xs font-medium">
                  <Mail className="mt-0.5 size-3.5 shrink-0" />
                  {notice}
                </p>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                {labels.submit}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-2 text-center text-xs">
          {mode === 'signin' && (
            <>
              <p className="text-fg-muted">
                Não tem conta?{' '}
                <button
                  type="button"
                  className="text-accent font-medium"
                  onClick={() => switchTo('signup')}
                >
                  Criar agora
                </button>
              </p>
              <p>
                <button
                  type="button"
                  className="text-fg-subtle hover:text-fg-muted"
                  onClick={() => switchTo('recover')}
                >
                  Esqueci minha senha
                </button>
              </p>
            </>
          )}

          {mode !== 'signin' && (
            <button
              type="button"
              className="text-fg-muted hover:text-fg inline-flex items-center gap-1 font-medium"
              onClick={() => switchTo('signin')}
            >
              <ArrowLeft className="size-3" />
              Voltar para o login
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
