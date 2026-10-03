/**
 * Hooks de dados. Toda tela consome daqui — nenhuma fala com o adaptador direto.
 */

import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { collection, type Collection } from './adapters'
import { ACTIVITY_CATALOG, FOOD_CATALOG } from './seed'
import { CATEGORY_CATALOG } from './seed-finance'
import type {
  Account,
  AccountCheck,
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
  HiddenTask,
  ModuleSetting,
  Task,
  Institution,
  MealLog,
  MealPreset,
  Note,
  Profile,
  Program,
  RecurringTransaction,
  Subject,
  Transaction,
  WorkoutSession,
} from './types'
import { uid } from '@/lib/utils'
import { avisarMudanca } from '@/lib/sincronia'

export const TABLES = {
  profiles: 'profiles',
  activityTypes: 'activity_types',
  sessions: 'workout_sessions',
  measurements: 'body_measurements',
  dailyMetrics: 'health_metrics_daily',
  dietPlans: 'diet_plans',
  foods: 'foods',
  mealLogs: 'meal_logs',
  mealPresets: 'meal_presets',
  institutions: 'institutions',
  programs: 'programs',
  subjects: 'subjects',
  assessments: 'assessments',
  courseLessons: 'course_lessons',
  notes: 'notes',
  deadlines: 'deadlines',
  accounts: 'accounts',
  accountChecks: 'account_checks',
  categories: 'categories',
  transactions: 'transactions',
  budgets: 'budgets',
  goals: 'financial_goals',
  recurring: 'recurring_transactions',
  habits: 'habits',
  habitLogs: 'habit_logs',
  tasks: 'tasks',
  hiddenTasks: 'hidden_tasks',
  widgets: 'dashboard_widgets',
  modules: 'modules',
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
  mealPresets: collection<MealPreset>(TABLES.mealPresets),
  institutions: collection<Institution>(TABLES.institutions),
  programs: collection<Program>(TABLES.programs),
  subjects: collection<Subject>(TABLES.subjects),
  assessments: collection<Assessment>(TABLES.assessments),
  courseLessons: collection<CourseLesson>(TABLES.courseLessons),
  notes: collection<Note>(TABLES.notes),
  deadlines: collection<Deadline>(TABLES.deadlines),
  accounts: collection<Account>(TABLES.accounts),
  accountChecks: collection<AccountCheck>(TABLES.accountChecks),
  categories: collection<Category>(TABLES.categories),
  transactions: collection<Transaction>(TABLES.transactions),
  budgets: collection<Budget>(TABLES.budgets),
  goals: collection<FinancialGoal>(TABLES.goals),
  recurring: collection<RecurringTransaction>(TABLES.recurring),
  habits: collection<Habit>(TABLES.habits),
  habitLogs: collection<HabitLog>(TABLES.habitLogs),
  tasks: collection<Task>(TABLES.tasks),
  hiddenTasks: collection<HiddenTask>(TABLES.hiddenTasks),
  widgets: collection<DashboardWidget>(TABLES.widgets),
  modules: collection<ModuleSetting>(TABLES.modules),
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

/** Quantos registros o financeiro tem hoje, por tipo. */
export interface FinanceCounts {
  accounts: number
  transactions: number
  budgets: number
  goals: number
  recurring: number
  checks: number
}

export function totalFinanceRows(counts: FinanceCounts): number {
  return (
    counts.accounts +
    counts.transactions +
    counts.budgets +
    counts.goals +
    counts.recurring +
    counts.checks
  )
}

async function financeCounts(): Promise<FinanceCounts> {
  const [accounts, transactions, budgets, goals, recurring, checks] = await Promise.all([
    collections.accounts.list(),
    collections.transactions.list(),
    collections.budgets.list(),
    collections.goals.list(),
    collections.recurring.list(),
    collections.accountChecks.list(),
  ])
  return {
    accounts: accounts.length,
    transactions: transactions.length,
    budgets: budgets.length,
    goals: goals.length,
    recurring: recurring.length,
    checks: checks.length,
  }
}

/**
 * Zera o financeiro e devolve as categorias ao catálogo padrão.
 *
 * As categorias não são simplesmente apagadas: sem nenhuma, não há como
 * classificar um lançamento, e `ensureSeed` só repõe na abertura do app — a
 * tela ficaria quebrada até alguém reiniciar. Repor aqui deixa o financeiro no
 * estado de instalação em vez de num estado inválido.
 *
 * Saúde, alimentação, faculdade, cursos, caderno e rotina não são tocados.
 */
export async function resetFinance(): Promise<FinanceCounts> {
  const removed = await financeCounts()

  await collections.transactions.replaceAll([])
  await collections.budgets.replaceAll([])
  await collections.goals.replaceAll([])
  await collections.recurring.replaceAll([])
  // A conferência de extrato vai junto: ela só diz respeito a uma conta, e
  // sobreviver à conta deixaria um carimbo apontando para o que não existe.
  await collections.accountChecks.replaceAll([])
  await collections.accounts.replaceAll([])
  await collections.categories.replaceAll(withMeta(CATEGORY_CATALOG) as Category[])

  return removed
}

/**
 * Devolve o controle ao navegador por um instante.
 *
 * Usa  em vez de : o navegador limita temporizadores
 * a cerca de um por segundo em aba de segundo plano, e uma importação de duas
 * mil linhas que respira a cada 60 ms levaria meia hora se a pessoa minimizasse
 * a janela no meio. A mensagem de canal não sofre esse limite.
 */
function respirar(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof MessageChannel === 'undefined') {
      setTimeout(resolve, 0)
      return
    }
    const canal = new MessageChannel()
    canal.port1.onmessage = () => {
      canal.port1.close()
      resolve()
    }
    canal.port2.postMessage(null)
  })
}

/**
 * Gravação em lote que parou no meio.
 *
 * Carrega quantos já tinham ido: sem isso a tela só saberia dizer "deu erro",
 * e quem mandou apagar dez não saberia se sumiram zero, quatro ou nove.
 */
export class LoteInterrompido extends Error {
  readonly feitos: number
  readonly total: number

  constructor(feitos: number, total: number, causa: unknown) {
    super(`Gravação interrompida: ${feitos} de ${total} feitos`, { cause: causa })
    this.name = 'LoteInterrompido'
    this.feitos = feitos
    this.total = total
  }
}

function useCollection<T extends BaseRow>(name: CollectionName, key: QueryKey = [name]) {
  const client = useQueryClient()
  const store = collections[name] as unknown as Collection<T>

  const query = useQuery({ queryKey: key, queryFn: () => store.list() })

  // Relê aqui e conta para as outras janelas relerem também: o banco é
  // compartilhado, o cache de cada janela não.
  const invalidate = () => {
    avisarMudanca(name)
    return client.invalidateQueries({ queryKey: key })
  }

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

  /**
   * Insere vários de uma vez, invalidando o cache uma única vez no fim.
   *
   * `create` invalida a cada inserção, e a invalidação relê a coleção inteira:
   * numa importação de 400 linhas isso são 400 releituras de uma lista que
   * cresce a cada volta, e o custo sobe com o quadrado do tamanho do arquivo.
   * Aqui a leitura acontece uma vez só, no fim.
   *
   * `onProgress` recebe quantos já foram — é o que alimenta a barra.
   */
  async function createMany(
    items: Array<Parameters<Collection<T>['insert']>[0]>,
    onProgress?: (done: number) => void,
  ): Promise<T[]> {
    const created: T[] = []
    let ultimoRespiro = performance.now()

    for (const item of items) {
      created.push(await store.insert(item))
      onProgress?.(created.length)

      // Sem devolver o controle ao navegador, as gravações rodam numa tacada só
      // e a barra fica parada no zero até o fim. O respiro é por tempo, não por
      // contagem: assim se ajusta sozinho a um destino lento (banco) e quase
      // não custa num rápido (navegador).
      if (performance.now() - ultimoRespiro > 60) {
        await respirar()
        ultimoRespiro = performance.now()
      }
    }

    await invalidate()
    return created
  }

  /**
   * Altera vários de uma vez, relendo a coleção uma vez só — o mesmo motivo de
   * `createMany`.
   *
   * A releitura fica no `finally`: se a gravação parar no meio, o que já foi
   * gravado precisa aparecer na tela. Sem isso a lista mostraria o estado de
   * antes, e repetir a ação daria a impressão de que nada tinha acontecido.
   */
  async function updateMany(items: Array<{ id: string; patch: Partial<T> }>): Promise<void> {
    await emLote(items, ({ id, patch }) => store.update(id, patch))
  }

  /** Remove vários de uma vez, nas mesmas condições de `updateMany`. */
  async function removeMany(ids: string[]): Promise<void> {
    await emLote(ids, (id) => store.remove(id))
  }

  async function emLote<I>(items: I[], gravar: (item: I) => Promise<unknown>): Promise<void> {
    if (items.length === 0) return
    let feitos = 0
    try {
      for (const item of items) {
        await gravar(item)
        feitos++
      }
    } catch (causa) {
      throw new LoteInterrompido(feitos, items.length, causa)
    } finally {
      await invalidate()
    }
  }

  return {
    data: (query.data ?? []) as T[],
    isLoading: query.isLoading,
    error: query.error,
    create,
    createMany,
    update,
    updateMany,
    remove,
    removeMany,
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

export function useMealPresets() {
  return useCollection<MealPreset>('mealPresets')
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

export function useModules() {
  return useCollection<ModuleSetting>('modules')
}

export function useHiddenTasks() {
  return useCollection<HiddenTask>('hiddenTasks')
}

export function useTasks() {
  return useCollection<Task>('tasks')
}

export function useDeadlines() {
  return useCollection<Deadline>('deadlines')
}

export function useAccounts() {
  return useCollection<Account>('accounts')
}

export function useAccountChecks() {
  return useCollection<AccountCheck>('accountChecks')
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
  avatar_url: null,
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
