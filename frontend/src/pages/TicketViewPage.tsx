import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Bot,
  User,
  Send,
  RefreshCw,
  Sparkles,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  ArrowUpRight,
  Copy,
  Check,
} from 'lucide-react'
import { ticketsApi, departmentsApi, type TicketWithMessages, type TicketStatus, type TicketPriority, type Department } from '../api/client'

const statusLabels: Record<TicketStatus, string> = {
  new: 'Новый',
  processing: 'В работе',
  waiting_response: 'Ожидает ответа',
  resolved: 'Решен',
  closed: 'Закрыт',
  escalated: 'Эскалирован',
}

const priorityLabels: Record<TicketPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критичный',
}


const statusColors: Record<TicketStatus, string> = {
  new: 'text-blue-500',
  processing: 'text-yellow-500',
  waiting_response: 'text-purple-500',
  resolved: 'text-green-500',
  closed: 'text-slate-500',
  escalated: 'text-red-500',
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export const TicketViewPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [ticket, setTicket] = useState<TicketWithMessages | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const [useAi, setUseAi] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchTicket = async () => {
    if (!id) return
    try {
      setLoading(true)
      const response = await ticketsApi.get(id)
      setTicket(response.data)
    } catch (err) {
      console.error('Failed to fetch ticket:', err)
    } finally {
      setLoading(false)
    }
  }

  const fetchDepartments = async () => {
    try {
      const response = await departmentsApi.list()
      setDepartments(response.data)
    } catch (err) {
      console.error('Failed to fetch departments:', err)
    }
  }

  useEffect(() => {
    fetchTicket()
    fetchDepartments()
  }, [id])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !message.trim()) return

    try {
      setSending(true)
      await ticketsApi.addMessage(id, message, false, useAi)
      setMessage('')
      setUseAi(false)
      await fetchTicket()
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
    }
  }

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!id) return
    try {
      await ticketsApi.update(id, { status: newStatus })
      await fetchTicket()
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    if (!id) return
    try {
      await ticketsApi.update(id, { priority: newPriority })
      await fetchTicket()
    } catch (err) {
      console.error('Failed to update priority:', err)
    }
  }

  const handleEscalate = async (departmentId: string) => {
    if (!id) return
    try {
      await ticketsApi.escalate(id, departmentId)
      await fetchTicket()
    } catch (err) {
      console.error('Failed to escalate:', err)
    }
  }

  const handleGenerateSummary = async () => {
    if (!id) return
    try {
      const response = await ticketsApi.summarize(id)
      alert(response.data.summary)
    } catch (err) {
      console.error('Failed to generate summary:', err)
    }
  }

  const handleCopySuggested = () => {
    if (ticket?.ai_suggested_response) {
      navigator.clipboard.writeText(ticket.ai_suggested_response)
      setCopied(true)
      setMessage(ticket.ai_suggested_response)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-muted" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-16 w-16 text-amber-500" />
        <p className="text-lg text-muted">Тикет не найден</p>
        <button
          onClick={() => navigate('/tickets')}
          className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          К списку тикетов
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/tickets')}
            className="mt-1 rounded-lg p-2 text-muted transition hover:bg-surface/80 hover:text-foreground"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm text-muted">{ticket.ticket_number}</span>
              <span className={`font-medium ${statusColors[ticket.status]}`}>
                {statusLabels[ticket.status]}
              </span>
              {ticket.ai_auto_resolved && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-300">
                  <Bot className="h-3 w-3" />
                  Авто-решено AI
                </span>
              )}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-foreground">{ticket.subject}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
              {ticket.client_name && (
                <span className="flex items-center gap-1">
                  <User className="h-4 w-4" />
                  {ticket.client_name}
                </span>
              )}
              {ticket.client_email && (
                <a href={`mailto:${ticket.client_email}`} className="text-brand-500 hover:underline">
                  {ticket.client_email}
                </a>
              )}
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDateTime(ticket.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Globe className="h-4 w-4" />
                {ticket.language === 'kz' ? 'Қазақша' : 'Русский'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchTicket}
            className="rounded-lg border border-border/50 p-2 text-muted transition hover:bg-surface/80 hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Messages */}
        <div className="lg:col-span-2 space-y-4">
          {/* Original description */}
          <div className="rounded-2xl border border-border/30 bg-surface/70 p-6 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted">
              <MessageSquare className="h-4 w-4" />
              Описание обращения
            </div>
            <p className="mt-3 whitespace-pre-wrap text-foreground">{ticket.description}</p>
          </div>

          {/* AI Suggested Response */}
          {ticket.ai_suggested_response && ticket.status !== 'closed' && (
            <div className="rounded-2xl border border-purple-400/30 bg-purple-500/5 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-300">
                  <Sparkles className="h-4 w-4" />
                  AI предлагает ответ
                  {ticket.ai_confidence && (
                    <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs">
                      {(ticket.ai_confidence * 100).toFixed(0)}% уверенность
                    </span>
                  )}
                </div>
                <button
                  onClick={handleCopySuggested}
                  className="flex items-center gap-1 rounded-lg border border-purple-400/50 px-3 py-1 text-xs font-medium text-purple-600 transition hover:bg-purple-500/10 dark:text-purple-300"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Скопировано' : 'Использовать'}
                </button>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/80">
                {ticket.ai_suggested_response}
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="space-y-4">
            {ticket.messages?.slice(1).map((msg) => (
              <div
                key={msg.id}
                className={`rounded-2xl border p-4 ${
                  msg.is_from_client
                    ? 'border-border/30 bg-surface/70'
                    : msg.is_ai_generated
                    ? 'border-purple-400/30 bg-purple-500/5'
                    : 'border-emerald-400/30 bg-emerald-500/5'
                }`}
              >
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {msg.is_from_client ? (
                      <>
                        <User className="h-4 w-4 text-muted" />
                        <span className="text-muted">Клиент</span>
                      </>
                    ) : msg.is_ai_generated ? (
                      <>
                        <Bot className="h-4 w-4 text-purple-500" />
                        <span className="text-purple-600 dark:text-purple-300">AI Ассистент</span>
                      </>
                    ) : (
                      <>
                        <User className="h-4 w-4 text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-300">Оператор</span>
                      </>
                    )}
                    {msg.is_internal_note && (
                      <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
                        Внутренняя заметка
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted">{formatDateTime(msg.created_at)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-foreground">{msg.content}</p>
              </div>
            ))}
          </div>

          {/* Reply form */}
          {ticket.status !== 'closed' && (
            <form onSubmit={handleSendMessage} className="rounded-2xl border border-border/30 bg-surface/70 p-4 shadow-sm">
              <div className="flex items-center justify-between text-sm text-muted">
                <span>Ответить</span>
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useAi}
                    onChange={(e) => setUseAi(e.target.checked)}
                    className="h-4 w-4 rounded border-border/50 text-brand-500 focus:ring-brand-400"
                  />
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Использовать AI
                </label>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Введите ответ..."
                rows={4}
                className="mt-3 w-full resize-none rounded-lg border border-border/50 bg-background/50 px-4 py-3 text-sm text-foreground placeholder-muted focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
              <div className="mt-3 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={handleGenerateSummary}
                  className="flex items-center gap-2 rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface/80 hover:text-foreground"
                >
                  <Sparkles className="h-4 w-4" />
                  Резюме
                </button>
                <button
                  type="submit"
                  disabled={!message.trim() || sending}
                  className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
                >
                  {sending ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Отправить
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Status & Priority */}
          <div className="rounded-2xl border border-border/30 bg-surface/70 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">Статус и приоритет</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-muted">Статус</label>
                <select
                  value={ticket.status}
                  onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                  className="mt-1 w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground"
                >
                  {Object.entries(statusLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted">Приоритет</label>
                <select
                  value={ticket.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                  className="mt-1 w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground"
                >
                  {Object.entries(priorityLabels).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Department & Category */}
          <div className="rounded-2xl border border-border/30 bg-surface/70 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">Маршрутизация</h3>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-muted">Департамент</label>
                <p className="mt-1 text-sm text-foreground">
                  {ticket.department?.name || 'Не назначен'}
                </p>
              </div>
              {ticket.category && (
                <div>
                  <label className="text-xs text-muted">Категория</label>
                  <p className="mt-1 text-sm text-foreground">{ticket.category.name}</p>
                </div>
              )}
              {ticket.ai_classified && (
                <div className="flex items-center gap-2 rounded-lg bg-purple-500/10 px-3 py-2">
                  <Bot className="h-4 w-4 text-purple-500" />
                  <span className="text-xs text-purple-600 dark:text-purple-300">
                    AI-классификация ({((ticket.ai_confidence || 0) * 100).toFixed(0)}%)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Escalate */}
          {ticket.status !== 'closed' && ticket.status !== 'resolved' && (
            <div className="rounded-2xl border border-border/30 bg-surface/70 p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">Эскалация</h3>
              <p className="mt-1 text-xs text-muted">Передать тикет в другой департамент</p>
              <div className="mt-3 space-y-2">
                {departments
                  .filter((d) => d.id !== ticket.department_id)
                  .map((dept) => (
                    <button
                      key={dept.id}
                      onClick={() => handleEscalate(dept.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-border/30 px-3 py-2 text-sm text-foreground transition hover:border-amber-400 hover:bg-amber-500/5"
                    >
                      {dept.name}
                      <ArrowUpRight className="h-4 w-4 text-muted" />
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* AI Summary */}
          {ticket.ai_summary && (
            <div className="rounded-2xl border border-purple-400/30 bg-purple-500/5 p-4">
              <div className="flex items-center gap-2 text-sm text-purple-600 dark:text-purple-300">
                <Sparkles className="h-4 w-4" />
                AI Резюме
              </div>
              <p className="mt-2 text-sm text-foreground/80">{ticket.ai_summary}</p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="rounded-2xl border border-border/30 bg-surface/70 p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-foreground">Быстрые действия</h3>
            <div className="mt-3 space-y-2">
              {ticket.status === 'processing' && (
                <button
                  onClick={() => handleStatusChange('resolved')}
                  className="flex w-full items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-600"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Решено
                </button>
              )}
              {ticket.status === 'resolved' && (
                <button
                  onClick={() => handleStatusChange('closed')}
                  className="flex w-full items-center gap-2 rounded-lg bg-slate-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-600"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Закрыть тикет
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

