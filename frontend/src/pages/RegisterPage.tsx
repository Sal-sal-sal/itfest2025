import { useState } from 'react'
import { Link } from 'react-router-dom'

type FormState = {
  fullName: string
  company: string
  email: string
  password: string
  teamSize: string
  plan: string
  agree: boolean
}

const plans = [
  { id: 'starter', title: 'Starter', description: 'Для небольших команд и пилотных запусков', price: '0 ₽' },
  { id: 'scale', title: 'Scale', description: 'Автоматизация и аналитика для растущего бизнеса', price: '14 900 ₽' },
  { id: 'enterprise', title: 'Enterprise', description: 'Глубокая кастомизация и SLA', price: 'Кастом' },
]

const initialState: FormState = {
  fullName: '',
  company: '',
  email: '',
  password: '',
  teamSize: '',
  plan: plans[0].id,
  agree: false,
}

export const RegisterPage = () => {
  const [form, setForm] = useState<FormState>(initialState)
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const updateField = (field: keyof FormState, value: string | boolean) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const validate = () => {
    const nextErrors: Record<string, string> = {}

    if (!form.fullName.trim()) nextErrors.fullName = 'Введите ваше имя'
    if (!form.email.trim() || !form.email.includes('@')) nextErrors.email = 'Укажите корректный email'
    if (form.password.length < 6) nextErrors.password = 'Минимум 6 символов'
    if (!form.agree) nextErrors.agree = 'Необходимо согласиться с условиями'

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) return

    setStatus('loading')
    setTimeout(() => {
      setStatus('success')
    }, 1100)
  }

  return (
    <div className="min-h-screen bg-background py-10">
      <div className="mx-auto grid max-w-6xl gap-10 rounded-[2.5rem] border border-border/20 bg-surface/70 p-6 shadow-soft lg:grid-cols-[1fr_480px]">
        <div className="flex flex-col justify-between rounded-3xl border border-border/20 bg-gradient-to-br from-brand-600/30 via-brand-500/10 to-surface/80 p-8 text-white">
          <div>
            <Link to="/" className="inline-flex items-center text-sm font-semibold text-white/80 hover:text-white">
              ← Вернуться на лендинг
            </Link>
            <p className="mt-8 text-sm uppercase tracking-[0.35em] text-white/70">NovaLanding</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">
              Регистрация команды и моментальный доступ к рабочей среде
            </h1>
            <p className="mt-4 text-base text-white/80">
              После отправки формы вы получите письмо с подтверждением, ссылку на рабочее пространство и приглашение
              для команды.
            </p>
          </div>
          <div className="mt-10 space-y-6 border-t border-white/20 pt-6 text-sm text-white/80">
            <div>
              <p className="text-2xl font-semibold text-white">14 дней</p>
              <p>Полный доступ без карты</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-white">24/7</p>
              <p>Поддержка в чате и Telegram</p>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-border/30 bg-background/80 p-8">
          <div className="mb-6 space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-500">Регистрация</p>
            <h2 className="text-2xl font-semibold text-foreground">Создайте аккаунт</h2>
            <p className="text-sm text-muted">5 шагов · меньше минуты · без привязки карты</p>
            {status === 'success' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-100">
                Готово! Мы отправили ссылку для подтверждения на {form.email || 'ваш email'}.
              </div>
            )}
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-foreground">
                Полное имя
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-border/40 bg-surface/60 px-4 py-3 text-sm text-foreground focus:border-brand-400 focus:outline-none"
                  placeholder="Алексей Иванов"
                  value={form.fullName}
                  onChange={(event) => updateField('fullName', event.target.value)}
                  required
                />
                {errors.fullName && <p className="mt-1 text-xs text-rose-500">{errors.fullName}</p>}
              </label>

              <label className="block text-sm font-medium text-foreground">
                Компания или проект
                <input
                  type="text"
                  className="mt-2 w-full rounded-2xl border border-border/40 bg-surface/60 px-4 py-3 text-sm text-foreground focus:border-brand-400 focus:outline-none"
                  placeholder="Digital Flow"
                  value={form.company}
                  onChange={(event) => updateField('company', event.target.value)}
                />
              </label>

              <label className="block text-sm font-medium text-foreground">
                Рабочий email
                <input
                  type="email"
                  className="mt-2 w-full rounded-2xl border border-border/40 bg-surface/60 px-4 py-3 text-sm text-foreground focus:border-brand-400 focus:outline-none"
                  placeholder="you@company.com"
                  value={form.email}
                  onChange={(event) => updateField('email', event.target.value)}
                  required
                />
                {errors.email && <p className="mt-1 text-xs text-rose-500">{errors.email}</p>}
              </label>

              <label className="block text-sm font-medium text-foreground">
                Пароль
                <input
                  type="password"
                  className="mt-2 w-full rounded-2xl border border-border/40 bg-surface/60 px-4 py-3 text-sm text-foreground focus:border-brand-400 focus:outline-none"
                  placeholder="Минимум 6 символов"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  required
                />
                {errors.password && <p className="mt-1 text-xs text-rose-500">{errors.password}</p>}
              </label>

              <label className="block text-sm font-medium text-foreground">
                Размер команды
                <select
                  className="mt-2 w-full rounded-2xl border border-border/40 bg-surface/60 px-4 py-3 text-sm text-foreground focus:border-brand-400 focus:outline-none"
                  value={form.teamSize}
                  onChange={(event) => updateField('teamSize', event.target.value)}
                >
                  <option value="">Выберите</option>
                  <option value="1-5">1–5 человек</option>
                  <option value="6-20">6–20 человек</option>
                  <option value="21-50">21–50 человек</option>
                  <option value="50+">50+</option>
                </select>
              </label>
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-foreground">Выберите тариф</legend>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {plans.map((plan) => {
                  const isActive = form.plan === plan.id
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => updateField('plan', plan.id)}
                      className={`rounded-2xl border px-4 py-3 text-left text-sm transition ${
                        isActive
                          ? 'border-brand-400 bg-brand-500/10 text-foreground'
                          : 'border-border/30 bg-surface/50 text-muted hover:border-brand-200'
                      }`}
                    >
                      <p className="font-semibold text-foreground">{plan.title}</p>
                      <p className="text-xs text-muted">{plan.description}</p>
                      <p className="mt-2 text-sm font-semibold text-foreground">{plan.price}</p>
                    </button>
                  )
                })}
              </div>
            </fieldset>

            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border/40 bg-surface focus:border-brand-400 focus:outline-none"
                checked={form.agree}
                onChange={(event) => updateField('agree', event.target.checked)}
              />
              Я принимаю{' '}
              <Link to="/#faq" className="font-semibold text-brand-600 hover:underline">
                условия сервиса
              </Link>{' '}
              и политику конфиденциальности
              {errors.agree && <span className="block text-xs text-rose-500">{errors.agree}</span>}
            </label>

            <button
              type="submit"
              disabled={status === 'loading'}
              className="w-full rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-brand-300"
            >
              {status === 'loading' ? 'Создаём рабочий стол...' : 'Создать аккаунт'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

