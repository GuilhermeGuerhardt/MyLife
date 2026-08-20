/**
 * Hooks de dados. Toda tela consome daqui — nenhuma fala com o adaptador direto.
 */

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { collection, type Collection } from './adapters'
import { ACTIVITY_CATALOG, FOOD_CATALOG } from './seed'
import { CATEGORY_CATALOG } from './seed-finance'
import type {
  Account,
  ActivityType,
  Assessment,
  BaseRow,
  BodyMeasurement,
  Budget,
  Category,
  CourseLesson,
  DailyMetric,
  DashboardWidget,
  Deadline,
  DietPlanRow,
  FinancialGoal,
  Food,
  Habit,
  HabitLog,
  Institution,
  MealLog,
  Note,
  Profile,
  Program,
  RecurringTransaction,
  Subject,
  Transaction,
  WorkoutSession,
} from './types'
import { uid } from '@/lib/utils'

export const TABLES = {
  profiles: 'profiles',
  activityTypes: 'activity_types',
  sessions: 'workout_sessions',
  measurements: 'body_measurements',
  dailyMetrics: 'health_metrics_daily',
  dietPlans: 'diet_plans',
  foods: 'foods',
  mealLogs: 'meal_logs',
  institutions: 'institutions',
  programs: 'programs',
  subjects: 'subjects',
  assessments: 'assessments',
  courseLessons: 'course_lessons',
  notes: 'notes',
  deadlines: 'deadlines',
  accounts: 'accounts',
  categories: 'categories',
  transactions: 'transactions',
  budgets: 'budgets',
  goals: 'financial_goals',
  recurring: 'recurring_transactions',
  habits: 'habits',
  habitLogs: 'habit_logs',
  widgets: 'dashboard_widgets',
} as const

const collections = {
  profiles: collection<Profile>(TABLES.profiles),
  activityTypes: collection<ActivityType>(TABLES.activityTypes),
  sessions: collection<WorkoutSession>(TABLES.sessions),
  measurements: collection<BodyMeasurement>(TABLES.measurements),
  dailyMetrics: collection<DailyMetric>(TABLES.dailyMetrics),
  dietPlans: collection<DietPlanRow>(TABLES.dietPlans),
  foods: collection<Food>(TABLES.foods),
  mealLogs: collection<MealLog>(TABLES.mealLogs),
  institutions: collection<Institution>(TABLES.institutions),
  programs: collection<Program>(TABLES.programs),
  subjects: collection<Subject>(TABLES.subjects),
  assessments: collection<Assessment>(TABLES.assessments),
  courseLessons: collection<CourseLesson>(TABLES.courseLessons),
  notes: collection<Note>(TABLES.notes),
  deadlines: collection<Deadline>(TABLES.deadlines),
  accounts: collection<Account>(TABLES.accounts),
  categories: collection<Category>(TABLES.categories),
  transactions: collection<Transaction>(TABLES.transactions),
  budgets: collection<Budget>(TABLES.budgets),
  goals: collection<FinancialGoal>(TABLES.goals),
  recurring: collection<RecurringTransaction>(TABLES.recurring),
  habits: collection<Habit>(TABLES.habits),
  habitLogs: collection<HabitLog>(TABLES.habitLogs),
  widgets: collection<DashboardWidget>(TABLES.widgets),
}

type CollectionName = keyof typeof collections

/** Nomes de tabela que o backup sabe restaurar. */
export const BACKUP_TABLES: readonly string[] = Object.values(TABLES)

/**
 * Lê todas as tabelas pelo adaptador ativo — não pelo localStorage direto.
 * É o que faz o backup funcionar igual nos dois modos; a versão anterior lia
 * as chaves do navegador e devolvia um arquivo vazio para quem estava no
 * Supabase, sem avisar.
 */
export async function exportAll(): Promise<Record<string, unknown[]>> {
  const names = Object.keys(collections) as CollectionName[]
  const entries = await Promise.all(
    names.map(async (name) => [TABLES[name], await collections[name].list()] as const),
  )
  return Object.fromEntries(entries)
}

export interface ImportReport {
  restored: Array<{ table: string; count: number }>
  removed: number
}

/**
 * Restaura o backup por cima dos dados atuais.
 *
 * "Restaurar" aqui significa deixar o banco igual ao arquivo: o que está no
 * backup entra, e o que existe hoje e não está lá sai. Um import que só
 * somasse deixaria registros apagados ressuscitarem a cada restauração.
 *
 * A remoção acontece depois da escrita e é feita por id, o que a torna
 * inofensiva no adaptador local (onde `replaceAll` já trocou o conjunto
 * inteiro) e necessária no Supabase (onde `replaceAll` é um upsert e não
 * remove nada sozinho).
 */
export async function importAll(tables: Record<string, unknown[]>): Promise<ImportReport> {
  const names = Object.keys(collections) as CollectionName[]
  const report: ImportReport = { restored: [], removed: 0 }

  for (const name of names) {
    const table = TABLES[name]
    const rows = tables[table]
    if (!rows) continue

    const store = collections[name] as unknown as Collection<BaseRow>
    const existing = await store.list()

    await store.replaceAll(rows as BaseRow[])

    const incoming = new Set((rows as BaseRow[]).map((row) => row.id))
    for (const row of existing) {
      if (incoming.has(row.id)) continue
      await store.remove(row.id)
      report.removed++
    }

    report.restored.push({ table, count: rows.length })
  }

  return report
}

function withMeta<T>(items: T[]): Array<T & BaseRow> {
  const now = new Date().toISOString()
  return items.map((item) => ({ ...item, id: uid(), created_at: now, updated_at: now })) as Array<
    T & BaseRow
  >
}

/** Popula atividades, alimentos e categorias financeiras na primeira execução. */
export async function ensureSeed(): Promise<void> {
  const [activities, foods, categories] = await Promise.all([
    collections.activityTypes.list(),
    collections.foods.list(),
    collections.categories.list(),
  ])
  if (activities.length === 0) {
    await collections.activityTypes.replaceAll(withMeta(ACTIVITY_CATALOG) as ActivityType[])
  }
  if (foods.length === 0) {
    await collections.foods.replaceAll(withMeta(FOOD_CATALOG) as Food[])
  }
  if (categories.length === 0) {
    await collections.categories.replaceAll(withMeta(CATEGORY_CATALOG) as Category[])
  }
}

function useCollection<T extends BaseRow>(name: CollectionName, key: QueryKey = [name]) {
  const client = useQueryClient()
  const store = collections[name] as unknown as Collection<T>

  const query = useQuery({ queryKey: key, queryFn: () => store.list() })

  const invalidate = () => client.invalidateQueries({ queryKey: key })

  const create = useMutation({
    mutationFn: (item: Parameters<Collection<T>['insert']>[0]) => store.insert(item),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<T> }) => store.update(id, patch),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => store.remove(id),
    onSuccess: invalidate,
  })

  return {
    data: (query.data ?? []) as T[],
    isLoading: query.isLoading,
    error: query.error,
    create,
    update,
    remove,
  }
}

export function useActivityTypes() {
  return useCollection<ActivityType>('activityTypes')
}

export function useSessions() {
  return useCollection<WorkoutSession>('sessions')
}

export function useMeasurements() {
  return useCollection<BodyMeasurement>('measurements')
}

export function useDailyMetrics() {
  return useCollection<DailyMetric>('dailyMetrics')
}

export function useDietPlans() {
  return useCollection<DietPlanRow>('dietPlans')
}

export function useFoods() {
  return useCollection<Food>('foods')
}

export function useMealLogs() {
  return useCollection<MealLog>('mealLogs')
}

export function useInstitutions() {
  return useCollection<Institution>('institutions')
}

export function usePrograms() {
  return useCollection<Program>('programs')
}

export function useSubjects() {
  return useCollection<Subject>('subjects')
}

export function useAssessments() {
  return useCollection<Assessment>('assessments')
}

export function useCourseLessons() {
  return useCollection<CourseLesson>('courseLessons')
}

export function useNotes() {
  return useCollection<Note>('notes')
}

export function useDeadlines() {
  return useCollection<Deadline>('deadlines')
}

export function useAccounts() {
  return useCollection<Account>('accounts')
}

export function useCategories() {
  return useCollection<Category>('categories')
}

export function useTransactions() {
  return useCollection<Transaction>('transactions')
}

export function useBudgets() {
  return useCollection<Budget>('budgets')
}

export function useGoals() {
  return useCollection<FinancialGoal>('goals')
}

export function useRecurring() {
  return useCollection<RecurringTransaction>('recurring')
}

export function useHabits() {
  return useCollection<Habit>('habits')
}

export function useHabitLogs() {
  return useCollection<HabitLog>('habitLogs')
}

export function useWidgets() {
  return useCollection<DashboardWidget>('widgets')
}

const DEFAULT_PROFILE: Omit<Profile, keyof BaseRow> = {
  name: '',
  birthdate: null,
  sex: 'male',
  height_cm: 175,
  activity_level: 'moderate',
}

/** O perfil é um registro único — o hook esconde essa particularidade. */
export function useProfile() {
  const { data, create, update, isLoading } = useCollection<Profile>('profiles')
  const profile = data[0] ?? null

  const save = async (patch: Partial<Profile>) => {
    if (profile) return update.mutateAsync({ id: profile.id, patch })
    return create.mutateAsync({ ...DEFAULT_PROFILE, ...patch })
  }

  return { profile, save, isLoading, isSaving: create.isPending || update.isPending }
}
