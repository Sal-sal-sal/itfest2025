import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  Send,
  RefreshCw,
  Bot,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Globe,
  ArrowLeft,
  HelpCircle,
  Zap,
} from 'lucide-react'
import {
  ticketsApi,
  categoriesApi,
  knowledgeBaseApi,
  type Category,
  type AIClassificationResult,
  type TicketPriority,
  type TicketSource,
} from '../api/client'

const priorityLabels: Record<TicketPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критичный',
}

const priorityColors: Record<TicketPriority, string> = {
  low: 'bg-slate-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
}

interface KBArticle {
  id: string
  question: string
  answer: string
}

export const SubmitTicketPage = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [kbArticles, setKbArticles] = useState<KBArticle[]>([])
  const [classification, setClassification] = useState<AIClassificationResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    client_name: '',
    client_email: '',
    client_phone: '',
    subject: '',
    description: '',
    language: 'ru',
    category_id: '',
    source: 'portal' as TicketSource,
  })

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesApi.list()
        setCategories(response.data)
      } catch (err) {
        console.error('Failed to fetch categories:', err)
      }
    }
    fetchCategories()
  }, [])

  // Search KB when description changes
  useEffect(() => {
    const searchKB = async () => {
      if (form.description.length < 10) {
        setKbArticles([])
        return
      }
      try {
        const response = await knowledgeBaseApi.search(form.description, 3)
        setKbArticles(response.data)
      } catch (err) {
        console.error('Failed to search KB:', err)
      }
    }
    const debounce = setTimeout(searchKB, 500)
    return () => clearTimeout(debounce)
  }, [form.description])

  // Auto AI classification when subject and description are filled
  useEffect(() => {
    const autoClassify = async () => {
      if (form.subject.length >= 5 && form.description.length >= 20) {
        try {
          setLoading(true)
          const response = await ticketsApi.classify(form.subject, form.description, form.language)
          setClassification(response.data)
        } catch (err) {
          console.error('Failed to classify:', err)
        } finally {
          setLoading(false)
        }
      } else {
        setClassification(null)
      }
    }
    const debounce = setTimeout(autoClassify, 800)
    return () => clearTimeout(debounce)
  }, [form.subject, form.description, form.language])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subject || !form.description) {
      setError('Заполните тему и описание')
      return
    }

    try {
      setSubmitting(true)
      setError(null)
      const response = await ticketsApi.create({
        ...form,
        category_id: form.category_id || undefined,
      })
      setSuccess(response.data.ticket_number)
    } catch (err) {
      setError('Не удалось создать тикет. Попробуйте позже.')
      console.error('Failed to submit ticket:', err)
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
        </div>
        <h1 className="text-3xl font-bold text-foreground">Обращение принято!</h1>
        <p className="mt-2 text-lg text-muted">Ваш номер тикета:</p>
        <p className="mt-2 font-mono text-2xl font-bold text-brand-500">{success}</p>
        <p className="mt-4 text-muted">
          Мы уже начали обработку вашего обращения. Ответ поступит на указанную почту.
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <Link
            to="/"
            className="rounded-lg border border-border/50 px-6 py-3 text-sm font-semibold text-foreground transition hover:bg-surface/80"
          >
            На главную
          </Link>
          <button
            onClick={() => {
              setSuccess(null)
              setForm({
                client_name: '',
                client_email: '',
                client_phone: '',
                subject: '',
                description: '',
                language: 'ru',
                category_id: '',
                source: 'portal',
              })
              setClassification(null)
            }}
            className="rounded-lg bg-brand-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Новое обращение
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          На главную
        </Link>
        <h1 className="text-3xl font-bold text-foreground">Создать обращение</h1>
        <p className="mt-2 text-muted">
          Опишите вашу проблему, и наш AI-ассистент автоматически классифицирует и направит обращение
        </p>
      </div>

      {/* AI Panel - Always visible at top */}
      <div className="mb-6 rounded-2xl border border-purple-400/30 bg-gradient-to-r from-purple-500/10 via-brand-500/5 to-purple-500/10 p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-brand-600 text-white shadow-lg">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">AI-ассистент</h2>
            <p className="text-sm text-muted">
              {loading ? 'Анализирую ваше обращение...' : 
               classification ? 'Обращение проанализировано' : 
               'Начните вводить тему и описание для анализа'}
            </p>
          </div>
          {loading && (
            <div className="ml-auto">
              <RefreshCw className="h-5 w-5 animate-spin text-purple-500" />
            </div>
          )}
        </div>

        {/* Classification Results */}
        {classification && (
          <div className="mt-5 grid gap-4 sm:grid-cols-4">
            <div className="rounded-xl bg-white/50 dark:bg-white/5 p-4">
              <p className="text-xs font-medium text-muted mb-1">Приоритет</p>
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold text-white ${priorityColors[classification.priority]}`}>
                {priorityLabels[classification.priority]}
              </span>
            </div>
            <div className="rounded-xl bg-white/50 dark:bg-white/5 p-4">
              <p className="text-xs font-medium text-muted mb-1">Уверенность AI</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-border/30">
                  <div 
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-brand-500 transition-all duration-500"
                    style={{ width: `${classification.confidence * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-foreground">
                  {(classification.confidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="rounded-xl bg-white/50 dark:bg-white/5 p-4">
              <p className="text-xs font-medium text-muted mb-1">Язык</p>
              <span className="text-sm font-semibold text-foreground">
                {classification.detected_language === 'kz' ? '🇰🇿 Қазақша' : '🇷🇺 Русский'}
              </span>
            </div>
            <div className="rounded-xl bg-white/50 dark:bg-white/5 p-4">
              <p className="text-xs font-medium text-muted mb-1">Авто-решение</p>
              {classification.can_auto_resolve ? (
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <Zap className="h-4 w-4" />
                  Возможно
                </span>
              ) : (
                <span className="text-sm text-muted">Требуется оператор</span>
              )}
            </div>
          </div>
        )}

        {/* AI Summary */}
        {classification?.summary && (
          <div className="mt-4 rounded-xl bg-white/50 dark:bg-white/5 p-4">
            <p className="text-xs font-medium text-muted mb-2">
              <Sparkles className="inline h-3 w-3 mr-1" />
              AI-резюме обращения
            </p>
            <p className="text-sm text-foreground">{classification.summary}</p>
          </div>
        )}

        {/* Auto-resolve message */}
        {classification?.can_auto_resolve && classification?.suggested_response && (
          <div className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 mb-2">
              <CheckCircle2 className="h-4 w-4" />
              Найдено готовое решение!
            </div>
            <p className="text-sm text-foreground/80 whitespace-pre-wrap">
              {classification.suggested_response}
            </p>
          </div>
        )}
      </div>

      {/* KB Articles - if found */}
      {kbArticles.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-500/5 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400 mb-3">
            <HelpCircle className="h-5 w-5" />
            Возможно, эти статьи помогут решить вашу проблему
          </div>
          <div className="space-y-2">
            {kbArticles.map((article) => (
              <details key={article.id} className="group rounded-lg bg-white/50 dark:bg-white/5">
                <summary className="cursor-pointer p-3 text-sm font-medium text-foreground hover:text-brand-500 transition">
                  {article.question}
                </summary>
                <div className="px-3 pb-3">
                  <p className="whitespace-pre-wrap text-sm text-muted border-t border-border/20 pt-3">
                    {article.answer}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border/30 bg-surface/70 p-6 shadow-sm">
        {/* Language */}
        <div className="flex items-center gap-4">
          <Globe className="h-5 w-5 text-muted" />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, language: 'ru' })}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                form.language === 'ru'
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface/50 text-muted hover:text-foreground'
              }`}
            >
              🇷🇺 Русский
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, language: 'kz' })}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                form.language === 'kz'
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface/50 text-muted hover:text-foreground'
              }`}
            >
              🇰🇿 Қазақша
            </button>
          </div>
        </div>

        {/* Contact info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Ваше имя
            </label>
            <input
              type="text"
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              placeholder="Иван Петров"
              className="w-full rounded-lg border border-border/50 bg-background/50 px-4 py-2.5 text-sm text-foreground placeholder-muted transition focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={form.client_email}
              onChange={(e) => setForm({ ...form, client_email: e.target.value })}
              placeholder="ivan@company.kz"
              required
              className="w-full rounded-lg border border-border/50 bg-background/50 px-4 py-2.5 text-sm text-foreground placeholder-muted transition focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </div>
        </div>

        {/* Subject */}
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Тема обращения <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Кратко опишите проблему"
            required
            className="w-full rounded-lg border border-border/50 bg-background/50 px-4 py-2.5 text-sm text-foreground placeholder-muted transition focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>

        {/* Category */}
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Категория (необязательно)
          </label>
          <select
            value={form.category_id}
            onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full rounded-lg border border-border/50 bg-background/50 px-4 py-2.5 text-sm text-foreground transition focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          >
            <option value="">AI определит автоматически</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-foreground">
            Подробное описание <span className="text-red-500">*</span>
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder={form.language === 'kz' 
              ? 'Мәселені толық сипаттаңыз...'
              : 'Опишите проблему подробно. Что произошло? Когда это началось? Какие ошибки видите?'
            }
            required
            rows={6}
            className="w-full resize-none rounded-lg border border-border/50 bg-background/50 px-4 py-3 text-sm text-foreground placeholder-muted transition focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting || !form.subject || !form.description || !form.client_email}
            className="flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-8 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Отправить обращение
          </button>
        </div>
      </form>

      {/* Tips */}
      <div className="mt-6 rounded-2xl border border-border/30 bg-surface/50 p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">💡 Советы для быстрого решения</h3>
        <div className="grid gap-3 sm:grid-cols-2 text-xs text-muted">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
            Опишите проблему максимально подробно
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
            Укажите, когда проблема возникла
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
            Приложите скриншоты при необходимости
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-brand-500" />
            AI автоматически найдёт решение или направит к специалисту
          </div>
        </div>
      </div>
    </div>
  )
}
