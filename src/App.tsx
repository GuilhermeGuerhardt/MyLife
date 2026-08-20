import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, useEffect, useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/app-shell'
import { QuickAdd } from './components/quick-add'
import { ensureSeed } from './data/queries'

// Rotas em lazy: os gráficos (Recharts) só chegam ao navegador na tela que os usa.
const Dashboard = lazy(() => import('./pages/dashboard').then((m) => ({ default: m.Dashboard })))
const HealthOverview = lazy(() =>
  import('./pages/health/overview').then((m) => ({ default: m.HealthOverview })),
)
const ActivitiesPage = lazy(() =>
  import('./pages/health/activities').then((m) => ({ default: m.ActivitiesPage })),
)
const DietPlanPage = lazy(() =>
  import('./pages/health/diet-plan').then((m) => ({ default: m.DietPlanPage })),
)
const NutritionPage = lazy(() =>
  import('./pages/health/nutrition').then((m) => ({ default: m.NutritionPage })),
)
const ProfilePage = lazy(() => import('./pages/profile').then((m) => ({ default: m.ProfilePage })))
const AcademicPrograms = lazy(() =>
  import('./pages/education/programs').then((m) => ({ default: m.AcademicPrograms })),
)
const CoursePrograms = lazy(() =>
  import('./pages/education/programs').then((m) => ({ default: m.CoursePrograms })),
)
const ProgramDetail = lazy(() =>
  import('./pages/education/program-detail').then((m) => ({ default: m.ProgramDetail })),
)
const CourseDetail = lazy(() =>
  import('./pages/education/course-detail').then((m) => ({ default: m.CourseDetail })),
)
const AcademicNotebook = lazy(() =>
  import('./pages/education/notebook').then((m) => ({ default: m.AcademicNotebook })),
)
const CourseNotebook = lazy(() =>
  import('./pages/education/notebook').then((m) => ({ default: m.CourseNotebook })),
)
const FinanceSoon = lazy(() => import('./pages/soon').then((m) => ({ default: m.FinanceSoon })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

export function App() {
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    void ensureSeed()
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
            <Route path="financeiro" element={<FinanceSoon />} />
            <Route path="perfil" element={<ProfilePage />} />
            <Route path="*" element={<Dashboard onOpenPalette={() => setPaletteOpen(true)} />} />
          </Route>
        </Routes>
        <QuickAdd open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
