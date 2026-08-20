import { Command, Database, FolderSync, Globe, User } from 'lucide-react'
import { Suspense } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { RouteBoundary } from '@/components/route-boundary'
import { storageMode, type StorageMode } from '@/data/adapters'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '../theme-toggle'
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

export function AppShell({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { pathname } = useLocation()
  const accent = accentForPath(pathname)
  const mode = storageMode()
  const section = NAV.find((item) => item.to !== '/' && pathname.startsWith(item.to))

  return (
    <div className="bg-bg flex min-h-dvh">
      {/* Sidebar — desktop */}
      <aside className="border-border-base bg-surface sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-14 items-center gap-2 px-5">
          <span className="bg-accent size-6 rounded-md" />
          <span className="text-fg text-sm font-semibold tracking-tight">Life</span>
        </div>

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {NAV.map((item) => (
            <div key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                    isActive || (item.to !== '/' && pathname.startsWith(item.to))
                      ? cn(item.accent, 'bg-accent-soft text-accent')
                      : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                  )
                }
              >
                <item.icon className="size-4" />
                {item.label}
              </NavLink>

              {item.children && pathname.startsWith(item.to) && (
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
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-surface-2 text-fg' : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
              )
            }
          >
            <User className="size-4" />
            Perfil
          </NavLink>


          <div className="flex items-center justify-between px-1">
            <Badge tone={mode === 'local' ? 'neutral' : 'positive'}>
              {mode === 'folder' ? (
                <FolderSync className="size-3" />
              ) : mode === 'sqlite' ? (
                <Database className="size-3" />
              ) : (
                <Globe className="size-3" />
              )}
              {MODE_LABEL[mode]}
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      {/* Conteúdo */}
      <div className={cn('flex min-w-0 flex-1 flex-col', accent)}>
        <header className="border-border-base bg-bg/80 sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 backdrop-blur lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            <span className="bg-accent size-5 rounded" />
            <span className="text-fg text-sm font-semibold">Life</span>
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
            <div className="lg:hidden">
              <ThemeToggle />
            </div>
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
