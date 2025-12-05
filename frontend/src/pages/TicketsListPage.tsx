import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  Bot,
  ChevronDown,
  Inbox,
  ArrowUpRight,
} from 'lucide-react'
import { ticketsApi, departmentsApi, type TicketListItem, type TicketStatus, type TicketPriority, type Department } from '../api/client'

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

const priorityColors: Record<TicketPriority, string> = {
  low: 'bg-slate-500',
  medium: 'bg-amber-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
}

const statusColors: Record<TicketStatus, string> = {
  new: 'bg-blue-500',
  processing: 'bg-yellow-500',
  waiting_response: 'bg-purple-500',
  resolved: 'bg-green-500',
  closed: 'bg-slate-500',
  escalated: 'bg-red-500',
}

const sourceIcons: Record<string, string> = {
  portal: '🌐',
  email: '📧',
  chat: '💬',
  phone: '📞',
  telegram: '📱',
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
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export const TicketsListPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [tickets, setTickets] = useState<TicketListItem[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [showFilters, setShowFilters] = useState(false)

  const statusFilter = searchParams.get('status') as TicketStatus | null
  const priorityFilter = searchParams.get('priority') as TicketPriority | null
  const departmentFilter = searchParams.get('department') || ''

  const fetchTickets = async () => {
    try {
      setLoading(true)
      const response = await ticketsApi.list({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        department_id: departmentFilter || undefined,
        search: search || undefined,
      })
      setTickets(response.data)
    } catch (err) {
      console.error('Failed to fetch tickets:', err)
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
    fetchDepartments()
  }, [])

  useEffect(() => {
    fetchTickets()
  }, [statusFilter, priorityFilter, departmentFilter])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const params = new URLSearchParams(searchParams)
    if (search) {
      params.set('search', search)
    } else {
      params.delete('search')
    }
    setSearchParams(params)
    fetchTickets()
  }

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value) {
      params.set(key, value)
    } else {
      params.delete(key)
    }
    setSearchParams(params)
  }

  const clearFilters = () => {
    setSearchParams({})
    setSearch('')
  }

  const hasFilters = statusFilter || priorityFilter || departmentFilter || search

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Тикеты</h1>
          <p className="mt-1 text-muted">Управление обращениями в службу поддержки</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchTickets}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-border/50 px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface/80"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Обновить</span>
          </button>
          <Link
            to="/submit"
            className="flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            <Plus className="h-4 w-4" />
            Создать тикет
          </Link>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4 rounded-2xl border border-border/30 bg-surface/70 p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по номеру, теме, email..."
              className="w-full rounded-lg border border-border/50 bg-background/50 py-2 pl-10 pr-4 text-sm text-foreground placeholder-muted transition focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
          </form>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition ${
              showFilters || hasFilters
                ? 'border-brand-400 bg-brand-500/10 text-brand-600'
                : 'border-border/50 text-foreground hover:bg-surface/80'
            }`}
          >
            <Filter className="h-4 w-4" />
            Фильтры
            {hasFilters && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-500 text-xs text-white">
                {[statusFilter, priorityFilter, departmentFilter, search].filter(Boolean).length}
              </span>
            )}
            <ChevronDown className={`h-4 w-4 transition ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="grid gap-4 border-t border-border/20 pt-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Статус</label>
              <select
                value={statusFilter || ''}
                onChange={(e) => updateFilter('status', e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground"
              >
                <option value="">Все статусы</option>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Приоритет</label>
              <select
                value={priorityFilter || ''}
                onChange={(e) => updateFilter('priority', e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground"
              >
                <option value="">Все приоритеты</option>
                {Object.entries(priorityLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted">Департамент</label>
              <select
                value={departmentFilter}
                onChange={(e) => updateFilter('department', e.target.value)}
                className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm text-foreground"
              >
                <option value="">Все департаменты</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>{dept.name}</option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <div className="sm:col-span-3">
                <button
                  onClick={clearFilters}
                  className="text-sm text-brand-500 hover:text-brand-600"
                >
                  Сбросить фильтры
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {loading && tickets.length === 0 ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted" />
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-border/30 bg-surface/70 py-16 text-center shadow-sm">
            <Inbox className="mx-auto h-16 w-16 text-muted/50" />
            <p className="mt-4 text-lg font-medium text-foreground">Тикеты не найдены</p>
            <p className="mt-1 text-sm text-muted">
              {hasFilters ? 'Попробуйте изменить фильтры' : 'Создайте первый тикет'}
            </p>
            {!hasFilters && (
              <Link
                to="/submit"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-600"
              >
                <Plus className="h-4 w-4" />
                Создать тикет
              </Link>
            )}
          </div>
        ) : (
          tickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/tickets/${ticket.id}`}
              className="group flex items-stretch gap-4 rounded-2xl border border-border/30 bg-surface/70 p-4 shadow-sm transition hover:border-brand-400/50 hover:shadow-soft"
            >
              {/* Status indicator */}
              <div className="flex flex-col items-center justify-center">
                <div className={`h-3 w-3 rounded-full ${statusColors[ticket.status]}`} />
                <div className={`mt-1 h-full w-0.5 rounded-full ${statusColors[ticket.status]} opacity-30`} />
              </div>

              {/* Main content */}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted">{ticket.ticket_number}</span>
                  <span className="text-muted">·</span>
                  <span className="text-xs text-muted">{sourceIcons[ticket.source]} {ticket.source}</span>
                  {ticket.ai_classified && (
                    <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-xs text-purple-600 dark:text-purple-300">
                      AI-классификация
                    </span>
                  )}
                  {ticket.ai_auto_resolved && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-300">
                      <Bot className="mr-1 inline h-3 w-3" />
                      Авто-решено
                    </span>
                  )}
                </div>
                <h3 className="mt-1 truncate text-base font-semibold text-foreground group-hover:text-brand-500">
                  {ticket.subject}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                  {ticket.client_name && <span>{ticket.client_name}</span>}
                  {ticket.client_email && <span className="text-brand-500">{ticket.client_email}</span>}
                </div>
              </div>

              {/* Right side */}
              <div className="flex flex-col items-end justify-between">
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs text-white ${priorityColors[ticket.priority]}`}>
                    {priorityLabels[ticket.priority]}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted opacity-0 transition group-hover:opacity-100" />
                </div>
                <div className="text-right">
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
                    {statusLabels[ticket.status]}
                  </span>
                  <p className="mt-1 text-xs text-muted">{formatDate(ticket.created_at)}</p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}

