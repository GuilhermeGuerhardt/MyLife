import { isTauri } from '@tauri-apps/api/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/app-shell'
import { QuickAdd } from './components/quick-add'
import { setFolderStore } from './data/adapters'
import { migrarDoLocalStorage } from './data/sqlite-store'
import { restoreFolder } from './data/folder-store'
import { ensureSeed } from './data/queries'
import { UpdateWatcher } from './features/updates/update-watcher'
import { lazyRoute } from './lib/lazy-route'

// Rotas em lazy: os gráficos (Recharts) só chegam ao navegador na tela que os usa.
const Dashboard = lazyRoute(() => import('./pages/dashboard').then((m) => ({ default: m.Dashboard })))
const HealthOverview = lazyRoute(() =>
  import('./pages/health/overview').then((m) => ({ default: m.HealthOverview })),
)
const ActivitiesPage = lazyRoute(() =>
  import('./pages/health/activities').then((m) => ({ default: m.ActivitiesPage })),
)
const DietPlanPage = lazyRoute(() =>
  import('./pages/health/diet-plan').then((m) => ({ default: m.DietPlanPage })),
)
const NutritionPage = lazyRoute(() =>
  import('./pages/health/nutrition').then((m) => ({ default: m.NutritionPage })),
)
const ProfilePage = lazyRoute(() => import('./pages/profile').then((m) => ({ default: m.ProfilePage })))
const AcademicPrograms = lazyRoute(() =>
  import('./pages/education/programs').then((m) => ({ default: m.AcademicPrograms })),
)
const CoursePrograms = lazyRoute(() =>
  import('./pages/education/programs').then((m) => ({ default: m.CoursePrograms })),
)
const ProgramDetail = lazyRoute(() =>
  import('./pages/education/program-detail').then((m) => ({ default: m.ProgramDetail })),
)
const CourseDetail = lazyRoute(() =>
  import('./pages/education/course-detail').then((m) => ({ default: m.CourseDetail })),
)
const AcademicNotebook = lazyRoute(() =>
  import('./pages/education/notebook').then((m) => ({ default: m.AcademicNotebook })),
)
const CourseNotebook = lazyRoute(() =>
  import('./pages/education/notebook').then((m) => ({ default: m.CourseNotebook })),
)
const FinanceOverview = lazyRoute(() =>
  import('./pages/finance/overview').then((m) => ({ default: m.FinanceOverview })),
)
const TransactionsPage = lazyRoute(() =>
  import('./pages/finance/transactions').then((m) => ({ default: m.TransactionsPage })),
)
const AccountsPage = lazyRoute(() =>
  import('./pages/finance/accounts').then((m) => ({ default: m.AccountsPage })),
)
const ImportPage = lazyRoute(() =>
  import('./pages/finance/import').then((m) => ({ default: m.ImportPage })),
)
const BudgetPage = lazyRoute(() =>
  import('./pages/finance/budget').then((m) => ({ default: m.BudgetPage })),
)
const RecurringPage = lazyRoute(() =>
  import('./pages/finance/recurring').then((m) => ({ default: m.RecurringPage })),
)
const CategoriesPage = lazyRoute(() =>
  import('./pages/finance/categories').then((m) => ({ default: m.CategoriesPage })),
)
const HabitsPage = lazyRoute(() =>
  import('./pages/routine/habits').then((m) => ({ default: m.HabitsPage })),
)
const AgendaPage = lazyRoute(() =>
  import('./pages/routine/agenda').then((m) => ({ default: m.AgendaPage })),
)
const InsightsPage = lazyRoute(() =>
  import('./pages/routine/insights').then((m) => ({ default: m.InsightsPage })),
)

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

export function App() {
  return <Boot />
}

function Splash() {
  return <div className="bg-bg min-h-dvh" />
}

function Boot() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void (async () => {
      // A pasta de trabalho precisa ser reconectada antes de qualquer leitura:
      // semear no navegador e só então trocar de destino deixaria a pasta
      // nascer pela metade, sem o catálogo de atividades e alimentos.
      const store = await restoreFolder(false).catch(() => null)
      if (store) setFolderStore(store)

      // Antes da semeadura: quem já usava o Life no navegador tem os registros
      // no localStorage, e semear primeiro criaria catálogos duplicados ao lado
      // dos que vieram de lá.
      if (isTauri()) await migrarDoLocalStorage().catch(() => 0)

      await ensureSeed()
      setReady(true)
    })()
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Tela em branco por uma fração de segundo, em vez de mostrar dados do
  // navegador que serão trocados pelos da pasta no instante seguinte.
  if (!ready) return <Splash />

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<AppShell onOpenPalette={() => setPaletteOpen(true)} />}>
            <Route index element={<Dashboard onOpenPalette={() => setPaletteOpen(true)} />} />
            <Route path="saude" element={<HealthOverview />} />
            <Route path="saude/atividades" element={<ActivitiesPage />} />
            <Route path="saude/plano" element={<DietPlanPage />} />
            <Route path="saude/alimentacao" element={<NutritionPage />} />
            <Route path="faculdade" element={<AcademicPrograms />} />
            <Route path="faculdade/caderno" element={<AcademicNotebook />} />
            <Route path="faculdade/:programId" element={<ProgramDetail />} />
            <Route path="cursos" element={<CoursePrograms />} />
            <Route path="cursos/caderno" element={<CourseNotebook />} />
            <Route path="cursos/:programId" element={<CourseDetail />} />
            <Route path="financeiro" element={<FinanceOverview />} />
            <Route path="financeiro/transacoes" element={<TransactionsPage />} />
            <Route path="financeiro/contas" element={<AccountsPage />} />
            <Route path="financeiro/orcamento" element={<BudgetPage />} />
            <Route path="financeiro/recorrentes" element={<RecurringPage />} />
            <Route path="financeiro/categorias" element={<CategoriesPage />} />
            <Route path="financeiro/importar" element={<ImportPage />} />
            <Route path="rotina" element={<HabitsPage />} />
            <Route path="rotina/agenda" element={<AgendaPage />} />
            <Route path="rotina/insights" element={<InsightsPage />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="*" element={<Dashboard onOpenPalette={() => setPaletteOpen(true)} />} />
          </Route>
        </Routes>
        <QuickAdd open={paletteOpen} onClose={() => setPaletteOpen(false)} />
        <UpdateWatcher />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
