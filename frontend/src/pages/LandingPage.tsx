import { Link, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import {
  Bot,
  Zap,
  Clock,
  BarChart3,
  MessageSquare,
  Globe,
  Users,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Headphones,
  Mail,
} from 'lucide-react'

const features = [
  {
    icon: <Bot className="h-6 w-6" />,
    title: 'AI-классификация',
    description:
      'Интеллектуальная маршрутизация обращений. ИИ определяет категорию, приоритет и департамент автоматически.',
    badge: 'AI',
    metrics: ['92% точность', 'Без первой линии', 'Мгновенно'],
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: 'Автоматическое решение',
    description:
      'До 50% типовых обращений закрываются автоматически благодаря базе знаний и умным ответам.',
    badge: 'Auto',
    metrics: ['База знаний', 'Шаблоны ответов', 'FAQ-бот'],
  },
  {
    icon: <Globe className="h-6 w-6" />,
    title: 'Мультиязычность',
    description:
      'Полная поддержка казахского и русского языков. Автоопределение языка и перевод сообщений.',
    badge: 'KZ/RU',
    metrics: ['Қазақша', 'Русский', 'Автоперевод'],
  },
]

const workflow = [
  {
    icon: <Mail className="h-6 w-6" />,
    title: 'Приём обращений',
    description: 'Единый вход для всех каналов: портал, email, чат, Telegram, телефония.',
  },
  {
    icon: <Bot className="h-6 w-6" />,
    title: 'AI-обработка',
    description: 'Мгновенная классификация, определение приоритета и поиск решения в базе знаний.',
  },
  {
    icon: <Headphones className="h-6 w-6" />,
    title: 'Умная маршрутизация',
    description: 'Автоматическое направление в профильный департамент без участия первой линии.',
  },
  {
    icon: <CheckCircle2 className="h-6 w-6" />,
    title: 'Быстрое решение',
    description: 'Операторы получают подсказки AI, резюме переписки и готовые формулировки ответов.',
  },
]

const stats = [
  { value: '0', label: 'FTE на 1-ю линию', icon: <Users className="h-5 w-5" /> },
  { value: '50%', label: 'Авто-решение', icon: <Zap className="h-5 w-5" /> },
  { value: '92%', label: 'Точность AI', icon: <Bot className="h-5 w-5" /> },
  { value: '24/7', label: 'Работа системы', icon: <Clock className="h-5 w-5" /> },
]

const benefits = [
  'Полная автоматизация первичной обработки',
  'Исключение ошибок классификации',
  'Ускорение SLA и улучшение CSAT',
  'Снижение операционных затрат',
  'Эскалация сложных кейсов в 1 клик',
  'Детальная аналитика и мониторинг',
]

const faqs = [
  {
    title: 'Как AI определяет категорию обращения?',
    description:
      'ИИ анализирует тему и описание обращения, сопоставляет с ключевыми словами департаментов и категорий, учитывает контекст и историю похожих тикетов.',
  },
  {
    title: 'Какие языки поддерживаются?',
    description:
      'Система полностью поддерживает казахский и русский языки. AI автоматически определяет язык обращения и генерирует ответы на соответствующем языке.',
  },
  {
    title: 'Можно ли интегрировать с email и Telegram?',
    description:
      'Да, система поддерживает приём обращений из email, чатов, портала, Telegram и телефонии. Все каналы объединены в единый интерфейс.',
  },
  {
    title: 'Как работает автоматическое решение?',
    description:
      'При поступлении обращения AI ищет релевантные статьи в базе знаний. Если найдено точное совпадение с высокой уверенностью, система автоматически отправляет ответ.',
  },
]

export const LandingPage = () => {
  const location = useLocation()

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (location.hash) {
      const section = document.querySelector(location.hash)
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [location])

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-grid-pattern bg-[size:30px_30px] opacity-40 dark:opacity-10" />

      {/* Hero */}
      <section className="relative border-b border-border/20 pb-16 pt-20" id="hero">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-purple-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-purple-600 dark:text-purple-300">
              <Bot className="h-4 w-4" />
              AI Help Desk Service
            </span>
            <h1 className="mt-6 text-4xl font-bold leading-tight text-foreground md:text-5xl">
              Интеллектуальная служба поддержки без первой линии
            </h1>
            <p className="mt-4 text-lg text-muted">
              Полностью автоматизируйте обработку обращений. AI классифицирует, маршрутизирует и решает
              до 50% тикетов без участия операторов. Поддержка казахского и русского языков.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link
                to="/submit"
                className="flex items-center justify-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-500"
              >
                <MessageSquare className="h-4 w-4" />
                Создать обращение
              </Link>
              <Link
                to="/dashboard"
                className="flex items-center justify-center gap-2 rounded-full border border-border/40 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-brand-400"
              >
                <BarChart3 className="h-4 w-4" />
                Панель оператора
              </Link>
            </div>

            {/* Stats */}
            <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="flex items-center justify-center gap-2 text-2xl font-bold text-foreground">
                    {stat.icon}
                    {stat.value}
                  </div>
                  <p className="text-xs text-muted">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Demo Card */}
          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/30 to-brand-700/10 blur-3xl" />
            <div className="relative rounded-3xl border border-border/30 bg-surface/80 p-6 shadow-soft">
              <div className="flex items-center justify-between text-xs font-semibold text-muted">
                <span className="flex items-center gap-2">
                  <Bot className="h-4 w-4 text-purple-500" />
                  AI Help Desk
                </span>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
                  Online
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {/* Incoming Ticket */}
                <div className="rounded-2xl border border-border/30 bg-background/70 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Mail className="h-3 w-3" />
                    Новое обращение
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">
                    Не могу войти в систему, забыл пароль
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-600 dark:text-purple-300">
                      <Sparkles className="mr-1 inline h-3 w-3" />
                      AI анализирует...
                    </span>
                  </div>
                </div>

                {/* AI Classification */}
                <div className="rounded-2xl border border-purple-400/30 bg-purple-500/5 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-medium text-purple-600 dark:text-purple-300">
                      <Bot className="h-3 w-3" />
                      AI-классификация
                    </span>
                    <span className="text-xs text-emerald-500">✓ 95%</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted">Категория</p>
                      <p className="font-medium text-foreground">Сброс пароля</p>
                    </div>
                    <div>
                      <p className="text-muted">Приоритет</p>
                      <p className="font-medium text-amber-500">Средний</p>
                    </div>
                    <div>
                      <p className="text-muted">Департамент</p>
                      <p className="font-medium text-foreground">IT</p>
                    </div>
                  </div>
                </div>

                {/* Auto Response */}
                <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/5 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-300">
                    <CheckCircle2 className="h-3 w-3" />
                    Автоматический ответ отправлен
                  </div>
                  <p className="mt-2 text-xs text-muted">
                    Для сброса пароля перейдите по ссылке...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-border/10 py-16" id="features">
        <div className="mx-auto max-w-6xl px-6">
          <div className="md:text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-500">
              Возможности
            </p>
            <h2 className="mt-3 text-3xl font-bold text-foreground md:text-4xl">
              Полная автоматизация службы поддержки
            </h2>
            <p className="mt-3 text-lg text-muted md:mx-auto md:max-w-3xl">
              AI берёт на себя рутину: классификация, маршрутизация, ответы на типовые вопросы.
              Операторы фокусируются на сложных кейсах.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="rounded-3xl border border-border/30 bg-surface/70 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-soft"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-brand-600 text-white">
                    {feature.icon}
                  </div>
                  <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-brand-600 dark:bg-brand-500/20 dark:text-brand-100">
                    {feature.badge}
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-3 text-sm text-muted">{feature.description}</p>
                <ul className="mt-4 space-y-2 text-sm">
                  {feature.metrics.map((metric) => (
                    <li key={metric} className="flex items-center gap-2 text-muted">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      {metric}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Workflow */}
      <section className="py-16" id="workflow">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-500">
                Как это работает
              </p>
              <h2 className="mt-4 text-3xl font-bold text-foreground">
                От обращения до решения за секунды
              </h2>
              <p className="mt-4 text-lg text-muted">
                Полностью автоматизированный процесс обработки. AI принимает решения, операторы
                подключаются только при необходимости.
              </p>

              <div className="mt-8">
                <h3 className="text-sm font-semibold text-foreground">Преимущества:</h3>
                <ul className="mt-4 space-y-3">
                  {benefits.map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3 text-sm text-muted">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      {benefit}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                to="/submit"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-500"
              >
                Попробовать сейчас
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="space-y-4 rounded-3xl border border-border/20 bg-surface/70 p-6 shadow-soft">
              {workflow.map((step, index) => (
                <div key={step.title} className="flex gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-brand-600 text-lg font-semibold text-white shadow-soft">
                    {step.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-xs font-medium text-brand-600 dark:text-brand-300">
                        Шаг {index + 1}
                      </span>
                    </div>
                    <p className="mt-1 text-lg font-semibold text-foreground">{step.title}</p>
                    <p className="text-sm text-muted">{step.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/10 bg-surface/60 py-16" id="faq">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-500">FAQ</p>
              <h2 className="mt-4 text-3xl font-bold text-foreground">Часто задаваемые вопросы</h2>
              <p className="mt-3 text-lg text-muted">
                Всё, что нужно знать об AI Help Desk Service
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link
                  to="/submit"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-500"
                >
                  <MessageSquare className="h-4 w-4" />
                  Создать обращение
                </Link>
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 rounded-full border border-border/40 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-brand-400"
                >
                  Демо дашборд
                </Link>
              </div>
            </div>
            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <details
                  key={faq.title}
                  className="group rounded-2xl border border-border/30 bg-background/80 p-5 transition hover:border-brand-400"
                  open={index === 0}
                >
                  <summary className="flex cursor-pointer items-center justify-between text-lg font-semibold text-foreground">
                    {faq.title}
                    <span className="text-xl text-brand-500 transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-muted">{faq.description}</p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/10 bg-gradient-to-r from-purple-500/10 via-brand-600/10 to-accent/10 py-16">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-brand-600 text-white shadow-soft">
            <Bot className="h-8 w-8" />
          </div>
          <h3 className="text-3xl font-bold text-foreground">
            Готовы автоматизировать службу поддержки?
          </h3>
          <p className="text-lg text-muted">
            Начните использовать AI Help Desk уже сегодня. Без первой линии, без очередей, без ошибок.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/submit"
              className="rounded-full bg-brand-600 px-8 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-500"
            >
              Создать обращение
            </Link>
            <Link
              to="/dashboard"
              className="rounded-full border border-border/40 px-8 py-3 text-sm font-semibold text-foreground transition hover:border-brand-400"
            >
              Открыть дашборд
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
