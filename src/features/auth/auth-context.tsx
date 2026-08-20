/**
 * Sessão do usuário.
 *
 * O login só existe quando há Supabase configurado — é lá que mora o servidor
 * capaz de verificar uma senha. Nos modos local e pasta, os dados estão no
 * disco do próprio usuário e quem os protege é o sistema operacional; uma
 * senha guardada no navegador seria apenas encenação, contornável por qualquer
 * um que abrisse o console.
 *
 * Por isso `required` é falso fora do modo Supabase, e a interface diz
 * exatamente isso em vez de fingir uma proteção que não existe.
 */

import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { isCloudEnabled, supabase } from '@/lib/supabase'

export interface AuthState {
  /** Se o app exige login para ser usado. */
  required: boolean
  loading: boolean
  session: Session | null
  user: User | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>
  resetPassword: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  // Sem Supabase não há o que carregar: o app já pode ser desenhado.
  const [loading, setLoading] = useState(isCloudEnabled)

  useEffect(() => {
    if (!supabase) return

    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    // Cobre login, logout, expiração e renovação do token — inclusive quando
    // acontecem em outra aba.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      required: isCloudEnabled,
      loading,
      session,
      user: session?.user ?? null,

      async signIn(email, password) {
        const { error } = await supabase!.auth.signInWithPassword({ email, password })
        if (error) throw new Error(translateAuthError(error.message))
      },

      async signUp(email, password) {
        const { data, error } = await supabase!.auth.signUp({ email, password })
        if (error) throw new Error(translateAuthError(error.message))
        // Com confirmação de e-mail ligada no projeto, o Supabase devolve o
        // usuário mas nenhuma sessão: a conta existe e ainda não vale.
        return { needsConfirmation: data.session === null }
      },

      async resetPassword(email) {
        const { error } = await supabase!.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/perfil`,
        })
        if (error) throw new Error(translateAuthError(error.message))
      },

      async signOut() {
        await supabase!.auth.signOut()
      },
    }),
    [loading, session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>')
  return context
}

/**
 * As mensagens do Supabase chegam em inglês e às vezes cruas demais.
 * Traduzir aqui evita espalhar `if` de string pelas telas.
 */
export function translateAuthError(message: string): string {
  const text = message.toLowerCase()

  if (text.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (text.includes('email not confirmed')) {
    return 'Confirme o e-mail pelo link que enviamos antes de entrar.'
  }
  if (text.includes('user already registered') || text.includes('already been registered')) {
    return 'Já existe uma conta com este e-mail.'
  }
  if (text.includes('password should be at least')) {
    return 'A senha precisa ter pelo menos 6 caracteres.'
  }
  if (text.includes('unable to validate email') || text.includes('invalid email')) {
    return 'E-mail inválido.'
  }
  if (text.includes('rate limit') || text.includes('too many requests')) {
    return 'Muitas tentativas seguidas. Espere um minuto e tente de novo.'
  }
  if (text.includes('failed to fetch') || text.includes('network')) {
    return 'Sem conexão com o servidor. Verifique a internet.'
  }

  return message
}
