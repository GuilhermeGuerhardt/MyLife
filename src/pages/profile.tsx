import { Check } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useProfile } from '@/data/queries'
import { AvatarField } from '@/features/profile/avatar-field'
import { BackupCard } from '@/features/profile/backup-card'
import { ThemeCard } from '@/features/profile/theme-card'
import { WorkspaceCard } from '@/features/profile/workspace-card'
import { ACTIVITY_LABELS, type ActivityLevel, type Sex } from '@/lib/health/formulas'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { SectionTitle } from '@/components/ui/misc'

export function ProfilePage() {
  const { profile, save, isSaving } = useProfile()
  const [form, setForm] = useState({
    name: '',
    birthdate: '',
    sex: 'male' as Sex,
    height_cm: 175,
    activity_level: 'moderate' as ActivityLevel,
    avatar_url: null as string | null,
  })
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!profile) return
    setForm({
      name: profile.name,
      birthdate: profile.birthdate ?? '',
      sex: profile.sex,
      height_cm: profile.height_cm,
      activity_level: profile.activity_level,
      avatar_url: profile.avatar_url ?? null,
    })
  }, [profile])

  async function handleSave() {
    await save({ ...form, birthdate: form.birthdate || null })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-fg text-xl font-semibold">Perfil</h1>
        <p className="text-fg-muted mt-1 text-sm">
          Estes dados alimentam os cálculos de TMB, TDEE e do plano de emagrecimento.
        </p>
      </div>

      <Card>
        <CardHeader title="Dados pessoais" />
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <AvatarField
              value={form.avatar_url}
              name={form.name}
              onChange={(avatar_url) => setForm({ ...form, avatar_url })}
            />
          </div>

          <Field
            label="Nome"
            className="sm:col-span-2"
            hint="Aparece no topo do menu, no lugar de “Life”."
          >
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Como quer ser chamado"
            />
          </Field>

          <Field label="Data de nascimento" hint="Usada para calcular a idade na fórmula da TMB.">
            <Input
              type="date"
              value={form.birthdate}
              onChange={(e) => setForm({ ...form, birthdate: e.target.value })}
            />
          </Field>

          <Field label="Sexo biológico" hint="A equação de Mifflin-St Jeor tem constantes distintas.">
            <Select
              value={form.sex}
              onChange={(e) => setForm({ ...form, sex: e.target.value as Sex })}
            >
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
            </Select>
          </Field>

          <Field label="Altura" suffix="cm">
            <Input
              type="number"
              value={form.height_cm}
              onChange={(e) => setForm({ ...form, height_cm: Number(e.target.value) })}
            />
          </Field>

          <Field
            label="Nível de atividade"
            hint="Usado só enquanto não há treinos registrados na semana."
          >
            <Select
              value={form.activity_level}
              onChange={(e) =>
                setForm({ ...form, activity_level: e.target.value as ActivityLevel })
              }
            >
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((level) => (
                <option key={level} value={level}>
                  {ACTIVITY_LABELS[level]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex items-center gap-3 sm:col-span-2">
            <Button onClick={() => void handleSave()} disabled={isSaving}>
              Salvar
            </Button>
            {saved && (
              <span className="text-positive flex items-center gap-1 text-xs font-medium">
                <Check className="size-3.5" /> Salvo
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <SectionTitle>Aparência</SectionTitle>
        <ThemeCard />
      </div>

      <div className="space-y-4">
        <SectionTitle>Dados e sincronização</SectionTitle>
        <WorkspaceCard />
        <BackupCard />
      </div>
    </div>
  )
}
