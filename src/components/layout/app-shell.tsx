import {
  Command,
  Database,
  FolderSync,
  Globe,
  PanelLeftClose,
  PanelLeftOpen,
  User,
} from 'lucide-react'
import { Suspense, useCallback, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Avatar } from '@/components/avatar'
import { RouteBoundary } from '@/components/route-boundary'
import { storageMode, type StorageMode } from '@/data/adapters'
import { useProfile } from '@/data/queries'
import { primeiroNome } from '@/lib/avatar'
import { cn } from '@/lib/utils'
import { Badge } from '../ui/misc'
import { NAV, accentForPath } from './nav'

/**
 * Os três destinos possíveis de gravação.
 *
 * Numa tabela e não num ternário: quando isto era ternário, uma edição
 * transformou três estados em dois e o app passou a dizer "Banco local"
 * também no navegador, onde os dados vão para o `localStorage`.
 */
const MODE_LABEL: Record<StorageMode, string> = {
  sqlite: 'Banco local',
  folder: 'Pasta',
  local: 'Navegador',
}

/** Onde a largura escolhida para a barra lateral fica lembrada. */
const SIDEBAR_KEY = 'life:menu-recolhido'

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Barra larga ou só de ícones.
 *
 * Some com 176 px de menu, que é o que falta numa tela de 1366 para o caderno
 * caber sem apertar a coluna do texto.
 */
function useCollapsedSidebar(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggle = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0')
      } catch {
        // Sem localStorage a escolha vale só nesta sessão.
      }
      return next
    })
  }, [])

  return [collapsed, toggle]
}

/** Esqueleto exibido enquanto o chunk da rota é baixado. */
function RouteFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="bg-surface-2 h-7 w-48 animate-pulse rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="bg-surface-2 h-24 animate-pulse rounded-[var(--radius-card)]"
          />
        ))}
      </div>
      <div className="bg-surface-2 h-64 animate-pulse rounded-[var(--radius-card)]" />
    </div>
  )
}

function ModeIcon({ mode }: { mode: StorageMode }) {
  if (mode === 'folder') return <FolderSync className="size-3" />
  if (mode === 'sqlite') return <Database className="size-3" />
  return <Globe className="size-3" />
}

export function AppShell({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { pathname } = useLocation()
  const accent = accentForPath(pathname)
  const mode = storageMode()
  const section = NAV.find((item) => item.to !== '/' && pathname.startsWith(item.to))
  const [collapsed, toggleSidebar] = useCollapsedSidebar()
  const { profile } = useProfile()
  const nome = profile?.name.trim() ?? ''

  return (
    <div className="bg-bg flex min-h-dvh">
      {/* Sidebar — desktop */}
      <aside
        className={cn(
          'border-border-base bg-surface sticky top-0 hidden h-dvh shrink-0 flex-col border-r transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-60',
        )}
      >
        {/*
          Topo do menu: quem está usando o app. Sem perfil preenchido ele volta
          a ser o quadrado da cor de destaque com "Life" ao lado, que era o que
          existia antes — a identidade do app só cede lugar quando há uma pessoa
          para pôr no lugar dela.
        */}
        <div
          className={cn(
            'flex h-14 items-center gap-2',
            collapsed ? 'justify-center px-0' : 'px-5',
          )}
          title={collapsed && nome ? nome : undefined}
        >
          <Avatar
            url={profile?.avatar_url}
            name={nome}
            className="size-6"
            textClassName="text-[10px]"
          />
          {!collapsed && (
            <span className="text-fg truncate text-sm font-semibold tracking-tight">
              {nome ? primeiroNome(nome) : 'Life'}
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {NAV.map((item) => (
            <div key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                // Recolhida, o rótulo vira dica do sistema: sem ele o ícone
                // sozinho obriga a adivinhar para onde cada um leva.
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  cn(
                    'flex items-center rounded-lg py-2 text-sm font-medium transition-colors',
                    collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
                    isActive || (item.to !== '/' && pathname.startsWith(item.to))
                      ? cn(item.accent, 'bg-accent-soft text-accent')
                      : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  )
                }
              >
                <item.icon className="size-4 shrink-0" />
                {!collapsed && item.label}
              </NavLink>

              {!collapsed && item.children && pathname.startsWith(item.to) && (
                <div className="border-border-base mt-0.5 mb-1 ml-5 space-y-0.5 border-l pl-3">
                  {item.children.map((child) => (
                    <NavLink
                      key={child.to}
                      to={child.to}
                      end
                      className={({ isActive }) =>
                        cn(
                          'block rounded-md px-2 py-1.5 text-xs transition-colors',
                          isActive
                            ? 'text-fg font-medium'
                            : 'text-fg-subtle hover:text-fg-muted',
                        )
                      }
                    >
                      {child.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="border-border-base space-y-2 border-t p-3">
          <NavLink
            to="/perfil"
            title={collapsed ? 'Perfil' : undefined}
            className={({ isActive }) =>
              cn(
                'flex items-center rounded-lg py-2 text-sm font-medium transition-colors',
                collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
                isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )
            }
          >
            <User className="size-4 shrink-0" />
            {!collapsed && 'Perfil'}
          </NavLink>

          {/*
            O tema mora só em Perfil > Aparência. Com seis paletas, um botão de
            atalho aqui seria um segundo lugar dizendo a mesma coisa — e dois
            lugares para a mesma escolha é onde a divergência começa.
          */}
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'px-1')}>
            {collapsed ? (
              // Recolhida, sobra espaço para o ícone e não para o texto — o
              // rótulo continua acessível como dica.
              <span
                title={`Gravando em: ${MODE_LABEL[mode]}`}
                className={cn(
                  'flex size-7 items-center justify-center rounded-md',
                  mode === 'local' ? 'text-fg-muted bg-surface-2' : 'text-positive bg-positive/10',
                )}
              >
                <ModeIcon mode={mode} />
              </span>
            ) : (
              <Badge tone={mode === 'local' ? 'neutral' : 'positive'}>
                <ModeIcon mode={mode} />
                {MODE_LABEL[mode]}
              </Badge>
            )}
          </div>

          <button
            type="button"
            onClick={toggleSidebar}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
            title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            className={cn(
              'text-fg-subtle hover:bg-surface-2 hover:text-fg flex w-full items-center rounded-lg py-2 text-xs font-medium transition-colors',
              collapsed ? 'justify-center px-0' : 'gap-2.5 px-2.5',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="size-4 shrink-0" />
                Recolher menu
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className={cn('flex min-w-0 flex-1 flex-col', accent)}>
        <header className="border-border-base bg-bg/80 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur lg:px-8">
          <div className="flex min-w-0 items-center gap-2 lg:hidden">
            <Avatar
              url={profile?.avatar_url}
              name={nome}
              className="size-5 rounded"
              textClassName="text-[9px]"
            />
            <span className="text-fg truncate text-sm font-semibold">
              {nome ? primeiroNome(nome) : 'Life'}
            </span>
          </div>
          <span className="text-fg-muted hidden text-sm font-medium lg:block">
            {section?.label ?? 'Início'}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenPalette}
              className="border-border-base bg-surface text-fg-subtle hover:border-border-strong flex h-9 items-center gap-2 rounded-lg border px-3 text-xs transition-colors"
            >
              <Command className="size-3.5" />
              <span className="hidden sm:inline">Registrar rápido</span>
              <kbd className="bg-surface-2 hidden rounded px-1.5 py-0.5 text-[10px] sm:inline">
                Ctrl K
              </kbd>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-24 lg:px-8 lg:pb-10">
          {/*
            O limite fica por dentro da casca, envolvendo só o miolo: se uma
            página falhar, o menu continua clicável e dá para ir para outra em
            vez de o app inteiro sumir.
          */}
          <RouteBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </RouteBoundary>
        </main>
      </div>

      {/* Navegação inferior — mobile */}
      <nav className="border-border-base bg-surface/95 fixed inset-x-0 bottom-0 z-40 flex border-t backdrop-blur lg:hidden">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors',
                isActive || (item.to !== '/' && pathname.startsWith(item.to))
                  ? cn(item.accent, 'text-accent')
                  : 'text-fg-subtle',
              )
            }
          >
            <item.icon className="size-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
