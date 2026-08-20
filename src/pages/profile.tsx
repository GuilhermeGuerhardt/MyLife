import { Check, Cloud, CloudOff, Download, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useProfile } from '@/data/queries'
import { ACTIVITY_LABELS, type ActivityLevel, type Sex } from '@/lib/health/formulas'
import { isCloudEnabled } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Field, Input, Select } from '@/components/ui/field'
import { Badge, SectionTitle } from '@/components/ui/misc'

export function ProfilePage() {
  const { profile, save, isSaving } = useProfile()
  const [form, setForm] = useState({
    name: '',
    birthdate: '',
    sex: 'male' as Sex,
    height_cm: 175,
    activity_level: 'moderate' as ActivityLevel,
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
    })
  }, [profile])

  async function handleSave() {
    await save({ ...form, birthdate: form.birthdate || null })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function exportData() {
    const data: Record<string, unknown> = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('life:table:')) {
        data[key.replace('life:table:', '')] = JSON.parse(localStorage.getItem(key) ?? '[]')
      }
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `life-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  function resetData() {
    if (!confirm('Isso apaga todos os dados locais deste navegador. Continuar?')) return
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (key?.startsWith('life:table:')) localStorage.removeItem(key)
    }
    location.reload()
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
          <Field label="Nome" className="sm:col-span-2">
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

      <div>
        <SectionTitle>Dados e sincronização</SectionTitle>
        <Card>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-fg text-sm font-medium">
                  {isCloudEnabled ? 'Conectado ao Supabase' : 'Rodando em modo local'}
                </p>
                <p className="text-fg-muted mt-1 text-xs">
                  {isCloudEnabled
                    ? 'Os registros vão para o Postgres e são protegidos por RLS.'
                    : 'Os registros ficam no localStorage deste navegador. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env para sincronizar na nuvem.'}
                </p>
              </div>
              <Badge tone={isCloudEnabled ? 'positive' : 'neutral'}>
                {isCloudEnabled ? <Cloud className="size-3" /> : <CloudOff className="size-3" />}
                {isCloudEnabled ? 'Supabase' : 'Local'}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={exportData}>
                <Download />
                Exportar backup
              </Button>
              <Button variant="ghost" size="sm" onClick={resetData}>
                <Trash2 />
                Apagar dados locais
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
