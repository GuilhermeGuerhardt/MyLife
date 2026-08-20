import { CornerDownLeft, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useAccounts,
  useActivityTypes,
  useCategories,
  useDailyMetrics,
  useMeasurements,
  useSessions,
} from '@/data/queries'
import { guessCategory } from '@/data/seed-finance'
import { useCreateTransaction } from '@/features/finance/actions'
import { sessionCalories } from '@/lib/health/formulas'
import { describeIntent, parseQuickAdd, type QuickIntent } from '@/lib/quick-add/parser'
import { today } from '@/lib/utils'
import { useHealthSummary } from '@/features/health/use-health-summary'
import { Button } from './ui/button'
import { Input } from './ui/field'
import { Modal } from './ui/modal'

const EXAMPLES = [
  'peso 84,2',
  'corri 5km em 28min',
  'futvolei 1h30',
  'dormi 7h30',
  'agua 500ml',
  'gastei 35 no mercado',
]

export function QuickAdd({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const navigate = useNavigate()

  const { data: activities } = useActivityTypes()
  const { create: createMeasurement } = useMeasurements()
  const { create: createSession } = useSessions()
  const { data: metrics, create: createMetric, update: updateMetric } = useDailyMetrics()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const createTransaction = useCreateTransaction()
  const { currentWeight } = useHealthSummary()

  const refs = useMemo(
    () => activities.map((a) => ({ id: a.id, name: a.name })),
    [activities],
  )
  const intent = useMemo(() => parseQuickAdd(text, refs), [text, refs])

  useEffect(() => {
    if (!open) {
      setText('')
      setStatus(null)
    }
  }, [open])

  async function upsertMetric(patch: Record<string, number>) {
    const existing = metrics.find((m) => m.date === today())
    if (existing) {
      await updateMetric.mutateAsync({ id: existing.id, patch })
      return
    }
    await createMetric.mutateAsync({
      date: today(),
      sleep_hours: null,
      sleep_quality: null,
      steps: null,
      water_ml: null,
      mood: null,
      energy: null,
      resting_hr: null,
      ...patch,
    })
  }

  async function commit(value: QuickIntent) {
    switch (value.kind) {
      case 'weight':
        await createMeasurement.mutateAsync({
          date: today(),
          weight_kg: value.weightKg,
          body_fat_pct: null,
          waist_cm: null,
          hip_cm: null,
          arm_cm: null,
          thigh_cm: null,
          chest_cm: null,
          notes: null,
        })
        return 'Pesagem registrada.'

      case 'session': {
        const activity = activities.find((a) => a.id === value.activityId)
        const weight = currentWeight ?? 75
        await createSession.mutateAsync({
          activity_type_id: value.activityId,
          date: today(),
          duration_min: value.durationMin,
          rpe: null,
          calories_estimated: sessionCalories(activity?.met ?? 5, weight, value.durationMin),
          distance_km: value.distanceKm,
          notes: null,
        })
        return 'Treino registrado.'
      }

      case 'water': {
        const existing = metrics.find((m) => m.date === today())
        await upsertMetric({ water_ml: (existing?.water_ml ?? 0) + value.ml })
        return 'Água somada ao dia.'
      }

      case 'sleep':
        await upsertMetric({ sleep_hours: value.hours })
        return 'Sono registrado.'

      case 'steps':
        await upsertMetric({ steps: value.steps })
        return 'Passos registrados.'

      case 'mood':
        await upsertMetric({ mood: value.score })
        return 'Humor registrado.'

      case 'meal':
        navigate(`/saude/alimentacao?buscar=${encodeURIComponent(value.query)}`)
        onClose()
        return null

      case 'expense':
      case 'income': {
        // Sem conta cadastrada não há onde lançar — manda para o financeiro.
        const account = accounts.find((a) => !a.archived && a.kind !== 'credit') ?? accounts[0]
        if (!account) {
          navigate('/financeiro')
          onClose()
          return null
        }
        const kind = value.kind === 'expense' ? 'expense' : 'income'
        const category = guessCategory(value.description, categories, kind)
        await createTransaction({
          account_id: account.id,
          transfer_account_id: null,
          category_id: category?.id ?? null,
          kind,
          amount_cents: Math.round(value.amount * 100),
          date: today(),
          description: value.description || (category?.name ?? ''),
          tags: [],
          paid: true,
          installments: 1,
          notes: null,
        })
        return category
          ? `Lançado em ${category.name} · ${account.name}.`
          : `Lançado em ${account.name}.`
      }

      default:
        return null
    }
  }

  async function handleSubmit() {
    if (intent.kind === 'unknown') return
    const message = await commit(intent)
    if (message) {
      setStatus(message)
      setText('')
      setTimeout(() => setStatus(null), 2200)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar rápido"
      description="Escreva em português. O app entende e grava no módulo certo."
    >
      <div className="space-y-4">
        <Input
          autoFocus
          value={text}
          placeholder="peso 84,2"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void handleSubmit()
            }
          }}
          className="h-11 text-base"
        />

        {text && (
          <div
            className={
              intent.kind === 'unknown'
                ? 'text-fg-muted bg-surface-2 rounded-lg px-3 py-2.5 text-xs'
                : 'text-accent bg-accent-soft flex items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-xs font-medium'
            }
          >
            <span className="flex items-center gap-2">
              {intent.kind !== 'unknown' && <Sparkles className="size-3.5 shrink-0" />}
              {describeIntent(intent)}
            </span>
            {intent.kind !== 'unknown' && (
              <Button size="sm" onClick={() => void handleSubmit()}>
                <CornerDownLeft />
                Enter
              </Button>
            )}
          </div>
        )}

        {status && (
          <p className="text-positive bg-positive/10 rounded-lg px-3 py-2 text-xs font-medium">
            {status}
          </p>
        )}

        <div>
          <p className="text-fg-subtle mb-2 text-[11px] font-medium tracking-wide uppercase">
            Exemplos
          </p>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => setText(example)}
                className="bg-surface-2 text-fg-muted hover:text-fg border-border-base rounded-md border px-2 py-1 text-xs transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
