import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  CheckCircle2,
  AlertTriangle,
  Zap,
  TrendingUp,
  Inbox,
  Users,
  Bot,
  ArrowRight,
  RefreshCw,
  Star,
  Smile,
  Meh,
  Frown,
} from 'lucide-react'
import { ticketsApi, chatApi, type DashboardStats } from '../api/client'

interface CSATStats {
  average: number
  total_responses: number
  distribution: Record<number, number>
  satisfaction_rate: number
}

const priorityLabels: Record<string, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критичный',
}

const priorityColors: Record<string, string> = {
  low: 'bg-slate-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
}

const statusColors: Record<string, string> = {
  new: 'bg-blue-500',
  processing: 'bg-yellow-500',
  waiting_response: 'bg-purple-500',
  resolved: 'bg-green-500',
  closed: 'bg-slate-500',
  escalated: 'bg-red-500',
}

function formatMinutes(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '—'
  if (minutes < 60) return `${Math.round(minutes)} мин`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  if (hours < 24) return `${hours}ч ${mins}м`
  const days = Math.floor(hours / 24)
  return `${days}д ${hours % 24}ч`
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const mins = Math.floor(diff / 60000)
  
  if (mins < 1) return 'только что'
  if (mins < 60) return `${mins} мин назад`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}ч назад`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}д назад`
  return date.toLocaleDateString('ru-RU')
}

interface CSATReview {
  escalation_id: string
  rating: number
  feedback: string | null
  submitted_at: string
  summary: string
  department_name: string
  resolved_at: string | null
}

export const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [csatStats, setCSATStats] = useState<CSATStats | null>(null)
  const [csatReviews, setCSATReviews] = useState<CSATReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = async () => {
    try {
      setLoading(true)
      const [statsRes, csatRes, reviewsRes] = await Promise.all([
        ticketsApi.getDashboardStats(),
        chatApi.getCSATStats(),
        chatApi.getCSATReviews(),
      ])
      setStats(statsRes.data)
      setCSATStats(csatRes.data)
      setCSATReviews(reviewsRes.data)
      setError(null)
    } catch (err) {
      setError('Не удалось загрузить статистику')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Обновление каждые 30 сек
    return () => clearInterval(interval)
  }, [])

  if (loading && !stats) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex items-center gap-3 text-muted">
          <RefreshCw className="h-5 w-5 animate-spin" />
          <span>Загрузка данных...</span>
        </div>
      </div>
    )
  }

  if (error && !stats) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
        <p className="text-lg text-muted">{error}</p>
        <button
          onClick={fetchStats}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
        >
          Попробовать снова
        </button>
      </div>
    )
  }

  const ticketStats = stats?.ticket_stats
  const priorityDist = stats?.priority_distribution
  const sourceDist = stats?.source_distribution

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Панель мониторинга</h1>
          <p className="mt-1 text-muted">Аналитика Help Desk в реальном времени</p>
        </div>
        <button
          onClick={fetchStats}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface/80"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={<Inbox className="h-6 w-6" />}
          label="Всего тикетов"
          value={ticketStats?.total_tickets ?? 0}
          color="bg-blue-500"
        />
        <MetricCard
          icon={<AlertTriangle className="h-6 w-6" />}
          label="Новых"
          value={ticketStats?.new_tickets ?? 0}
          color="bg-amber-500"
          badge={ticketStats?.new_tickets ? 'Требуют внимания' : undefined}
        />
        <MetricCard
          icon={<CheckCircle2 className="h-6 w-6" />}
          label="Решено"
          value={ticketStats?.resolved_tickets ?? 0}
          color="bg-emerald-500"
        />
        <MetricCard
          icon={<Bot className="h-6 w-6" />}
          label="Авто-решено AI"
          value={ticketStats?.auto_resolved_tickets ?? 0}
          color="bg-purple-500"
          badge={`${((ticketStats?.auto_resolution_rate ?? 0) * 100).toFixed(0)}%`}
        />
      </div>

      {/* AI & SLA Metrics */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-border/30 bg-surface/70 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted">Точность AI классификации</p>
              <p className="text-2xl font-bold text-foreground">
                {((ticketStats?.classification_accuracy ?? 0) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
          <div className="mt-4 h-2 rounded-full bg-border/30">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all"
              style={{ width: `${(ticketStats?.classification_accuracy ?? 0) * 100}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-border/30 bg-surface/70 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
              <Clock className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted">Среднее время ответа</p>
              <p className="text-2xl font-bold text-foreground">
                {formatMinutes(ticketStats?.avg_response_time_minutes ?? null)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-border/30 bg-surface/70 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted">Среднее время решения</p>
              <p className="text-2xl font-bold text-foreground">
                {formatMinutes(ticketStats?.avg_resolution_time_minutes ?? null)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Priority Distribution */}
        <div className="rounded-2xl border border-border/30 bg-surface/70 p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Распределение по приоритету</h3>
          <div className="space-y-3">
            {priorityDist && Object.entries(priorityDist).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-24 text-sm text-muted">{priorityLabels[key]}</span>
                <div className="flex-1 h-6 rounded-full bg-border/20 overflow-hidden">
                  <div
                    className={`h-full ${priorityColors[key]} transition-all`}
                    style={{
                      width: `${ticketStats?.total_tickets ? (value / ticketStats.total_tickets) * 100 : 0}%`,
                    }}
                  />
                </div>
                <span className="w-10 text-right text-sm font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Source Distribution */}
        <div className="rounded-2xl border border-border/30 bg-surface/70 p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-foreground">Источники обращений</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {sourceDist && [
              { key: 'portal', label: 'Портал', icon: '🌐' },
              { key: 'email', label: 'Email', icon: '📧' },
              { key: 'chat', label: 'Чат', icon: '💬' },
              { key: 'phone', label: 'Телефон', icon: '📞' },
              { key: 'telegram', label: 'Telegram', icon: '📱' },
            ].map(({ key, label, icon }) => (
              <div
                key={key}
                className="flex flex-col items-center rounded-xl border border-border/20 bg-background/50 p-4"
              >
                <span className="text-2xl">{icon}</span>
                <span className="mt-2 text-2xl font-bold text-foreground">
                  {sourceDist[key as keyof typeof sourceDist]}
                </span>
                <span className="text-xs text-muted">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CSAT Widget */}
      <div className="rounded-2xl border border-border/30 bg-gradient-to-br from-amber-500/5 to-yellow-500/5 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-yellow-500 text-white">
              <Star className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">CSAT - Удовлетворённость клиентов</h3>
              <p className="text-sm text-muted">Customer Satisfaction Score</p>
            </div>
          </div>
          {csatStats && csatStats.satisfaction_rate > 0 && (
            <div className="flex items-center gap-2">
              {csatStats.satisfaction_rate >= 0.8 ? (
                <Smile className="h-8 w-8 text-emerald-500" />
              ) : csatStats.satisfaction_rate >= 0.5 ? (
                <Meh className="h-8 w-8 text-amber-500" />
              ) : (
                <Frown className="h-8 w-8 text-red-500" />
              )}
            </div>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Average Score */}
          <div className="rounded-xl bg-surface/70 p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-5 w-5 ${
                    star <= Math.round(csatStats?.average ?? 0)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                />
              ))}
            </div>
            <p className="text-3xl font-bold text-foreground">
              {(csatStats?.average ?? 0).toFixed(1)}
            </p>
            <p className="text-sm text-muted">Средняя оценка</p>
          </div>

          {/* Satisfaction Rate */}
          <div className="rounded-xl bg-surface/70 p-4 text-center">
            <p className="text-3xl font-bold text-emerald-500">
              {((csatStats?.satisfaction_rate ?? 0) * 100).toFixed(0)}%
            </p>
            <p className="text-sm text-muted">Довольных клиентов</p>
            <p className="text-xs text-muted mt-1">(оценка 4-5 ⭐)</p>
          </div>

          {/* Total Responses */}
          <div className="rounded-xl bg-surface/70 p-4 text-center">
            <p className="text-3xl font-bold text-foreground">
              {csatStats?.total_responses ?? 0}
            </p>
            <p className="text-sm text-muted">Всего оценок</p>
          </div>
        </div>

        {/* Distribution */}
        {csatStats && csatStats.total_responses > 0 && (
          <div className="mt-6">
            <p className="text-sm text-muted mb-3">Распределение оценок:</p>
            <div className="flex items-end justify-between gap-2 h-24">
              {[1, 2, 3, 4, 5].map((rating) => {
                const count = csatStats.distribution[rating] ?? 0
                const percentage = csatStats.total_responses > 0 
                  ? (count / csatStats.total_responses) * 100 
                  : 0
                return (
                  <div key={rating} className="flex-1 flex flex-col items-center gap-1">
                    <div 
                      className={`w-full rounded-t-lg transition-all ${
                        rating >= 4 ? 'bg-emerald-500' : rating >= 3 ? 'bg-amber-500' : 'bg-red-500'
                      }`}
                      style={{ height: `${Math.max(percentage, 5)}%` }}
                    />
                    <span className="text-xs font-medium text-foreground">{rating}⭐</span>
                    <span className="text-xs text-muted">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* CSAT Reviews / Comments */}
        {csatReviews.length > 0 && (
          <div className="mt-6 border-t border-border/20 pt-6">
            <p className="text-sm font-medium text-foreground mb-4">💬 Последние отзывы клиентов:</p>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {csatReviews.slice(0, 10).map((review) => (
                <div 
                  key={review.escalation_id} 
                  className="rounded-xl bg-surface/50 p-4 border border-border/20"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {/* Stars */}
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted">
                          {review.submitted_at ? formatDate(review.submitted_at) : ''}
                        </span>
                      </div>
                      
                      {/* Feedback comment */}
                      {review.feedback ? (
                        <p className="text-sm text-foreground italic">"{review.feedback}"</p>
                      ) : (
                        <p className="text-sm text-muted italic">Без комментария</p>
                      )}
                      
                      {/* Summary of the issue */}
                      <p className="text-xs text-muted mt-2">
                        📋 {review.summary}
                      </p>
                      <p className="text-xs text-muted">
                        🏢 {review.department_name}
                      </p>
                    </div>
                    
                    {/* Sentiment icon */}
                    <div className="flex-shrink-0">
                      {review.rating >= 4 ? (
                        <Smile className="h-6 w-6 text-emerald-500" />
                      ) : review.rating >= 3 ? (
                        <Meh className="h-6 w-6 text-amber-500" />
                      ) : (
                        <Frown className="h-6 w-6 text-red-500" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {csatReviews.length > 10 && (
              <p className="text-xs text-muted text-center mt-3">
                Показано 10 из {csatReviews.length} отзывов
              </p>
            )}
          </div>
        )}
      </div>

      {/* Department Stats */}
      {stats?.department_stats && stats.department_stats.length > 0 && (
        <div className="rounded-2xl border border-border/30 bg-surface/70 p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">Статистика по департаментам</h3>
            <Link
              to="/departments"
              className="flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600"
            >
              Управление <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/20 text-left text-sm text-muted">
                  <th className="pb-3 font-medium">Департамент</th>
                  <th className="pb-3 text-center font-medium">Тикетов</th>
                  <th className="pb-3 text-right font-medium">Ср. время решения</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {stats.department_stats.map((dept) => (
                  <tr key={dept.department_id} className="text-sm">
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-muted" />
                        <span className="font-medium text-foreground">{dept.department_name}</span>
                      </div>
                    </td>
                    <td className="py-3 text-center">
                      <span className="rounded-full bg-brand-500/10 px-3 py-1 text-brand-600 dark:text-brand-300">
                        {dept.ticket_count}
                      </span>
                    </td>
                    <td className="py-3 text-right text-muted">
                      {formatMinutes(dept.avg_resolution_time_minutes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Tickets */}
      <div className="rounded-2xl border border-border/30 bg-surface/70 p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Последние тикеты</h3>
          <Link
            to="/tickets"
            className="flex items-center gap-1 text-sm text-brand-500 hover:text-brand-600"
          >
            Все тикеты <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="space-y-2">
          {stats?.recent_tickets?.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/tickets/${ticket.id}`}
              className="flex items-center gap-4 rounded-lg border border-border/20 bg-background/50 p-4 transition hover:border-brand-400/50"
            >
              <div className={`h-3 w-3 rounded-full ${statusColors[ticket.status]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted">{ticket.ticket_number}</span>
                  {ticket.ai_auto_resolved && (
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-600 dark:text-purple-300">
                      <Bot className="inline h-3 w-3 mr-1" />
                      AI
                    </span>
                  )}
                </div>
                <p className="truncate text-sm font-medium text-foreground">{ticket.subject}</p>
              </div>
              <div className="text-right">
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${priorityColors[ticket.priority]} text-white`}>
                  {priorityLabels[ticket.priority]}
                </span>
                <p className="mt-1 text-xs text-muted">{formatDate(ticket.created_at)}</p>
              </div>
            </Link>
          ))}
          {(!stats?.recent_tickets || stats.recent_tickets.length === 0) && (
            <div className="py-8 text-center text-muted">
              <Inbox className="mx-auto h-12 w-12 opacity-50" />
              <p className="mt-2">Нет тикетов</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: number
  color: string
  badge?: string
}

const MetricCard = ({ icon, label, value, color, badge }: MetricCardProps) => (
  <div className="rounded-2xl border border-border/30 bg-surface/70 p-6 shadow-sm transition hover:shadow-soft">
    <div className="flex items-start justify-between">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${color} text-white`}>
        {icon}
      </div>
      {badge && (
        <span className="rounded-full bg-brand-500/10 px-2 py-1 text-xs font-medium text-brand-600 dark:text-brand-300">
          {badge}
        </span>
      )}
    </div>
    <p className="mt-4 text-3xl font-bold text-foreground">{value}</p>
    <p className="text-sm text-muted">{label}</p>
  </div>
)

