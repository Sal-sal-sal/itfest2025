import { useState, useEffect, useCallback } from 'react'
import {
  MessageSquare,
  Plus,
  Send,
  BookOpen,
  CheckCircle2,
  Clock,
  Brain,
  Sparkles,
  ChevronRight,
  Search,
  RefreshCw,
  X,
} from 'lucide-react'
import { chatApi, type Escalation } from '../api/client'

interface KBArticle {
  category_key: string
  subcategory_key: string
  question: string
  answer: string
  question_kz?: string
  answer_kz?: string
  can_auto_resolve: boolean
  priority: string
}


// Categories for KB
const kbCategories = [
  {
    key: 'it_support',
    name: 'IT Поддержка',
    subcategories: [
      { key: 'passwords', name: 'Пароли и доступ' },
      { key: 'vpn', name: 'VPN и удалённый доступ' },
      { key: 'hardware', name: 'Оборудование' },
      { key: 'software', name: 'Программное обеспечение' },
    ],
  },
  {
    key: 'hr',
    name: 'HR / Кадры',
    subcategories: [
      { key: 'vacation', name: 'Отпуска' },
      { key: 'documents', name: 'Документы' },
      { key: 'benefits', name: 'Льготы' },
    ],
  },
  {
    key: 'finance',
    name: 'Финансы',
    subcategories: [
      { key: 'salary', name: 'Зарплата' },
      { key: 'expenses', name: 'Расходы' },
      { key: 'invoices', name: 'Счета' },
    ],
  },
  {
    key: 'facilities',
    name: 'АХО',
    subcategories: [
      { key: 'office', name: 'Офис' },
      { key: 'supplies', name: 'Канцтовары' },
      { key: 'parking', name: 'Парковка' },
    ],
  },
]

const priorityColors = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  medium: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  critical: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300',
}

const statusColors = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300',
}

export const OperatorPage = () => {
  const [activeTab, setActiveTab] = useState<'tickets' | 'knowledge'>('tickets')
  const [tickets, setTickets] = useState<Escalation[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Escalation | null>(null)
  const [response, setResponse] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Knowledge Base state
  const [newArticle, setNewArticle] = useState<KBArticle>({
    category_key: '',
    subcategory_key: '',
    question: '',
    answer: '',
    question_kz: '',
    answer_kz: '',
    can_auto_resolve: true,
    priority: 'medium',
  })
  const [isAddingArticle, setIsAddingArticle] = useState(false)
  const [addArticleSuccess, setAddArticleSuccess] = useState(false)

  // Load escalations from API
  const loadEscalations = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await chatApi.getEscalations()
      setTickets(res.data)
    } catch (error) {
      console.error('Error loading escalations:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load on mount and set up polling
  useEffect(() => {
    loadEscalations()
    
    // Poll every 10 seconds for new escalations
    const interval = setInterval(loadEscalations, 10000)
    return () => clearInterval(interval)
  }, [loadEscalations])

  // Filter tickets
  const filteredTickets = tickets.filter((ticket) => {
    if (filterStatus !== 'all' && ticket.status !== filterStatus) return false
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        ticket.escalation_id.toLowerCase().includes(query) ||
        ticket.summary.toLowerCase().includes(query) ||
        ticket.client_message.toLowerCase().includes(query)
      )
    }
    return true
  })

  // Handle ticket response
  const handleSendResponse = async () => {
    if (!selectedTicket || !response.trim()) return

    setIsSubmitting(true)

    try {
      // Call API to update escalation
      await chatApi.updateEscalation(selectedTicket.escalation_id, {
        status: 'resolved',
        operator_response: response,
      })

      // Reload escalations
      await loadEscalations()

      setResponse('')
      setSelectedTicket(null)
    } catch (error) {
      console.error('Error sending response:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Take ticket (mark as in_progress)
  const handleTakeTicket = async (ticket: Escalation) => {
    try {
      await chatApi.updateEscalation(ticket.escalation_id, {
        status: 'in_progress',
      })
      await loadEscalations()
      setSelectedTicket({ ...ticket, status: 'in_progress' })
    } catch (error) {
      console.error('Error taking ticket:', error)
    }
  }

  // Change ticket status
  const handleStatusChange = async (newStatus: 'pending' | 'in_progress' | 'resolved') => {
    if (!selectedTicket) return

    try {
      await chatApi.updateEscalation(selectedTicket.escalation_id, {
        status: newStatus,
      })
      await loadEscalations()
      setSelectedTicket({ ...selectedTicket, status: newStatus })
    } catch (error) {
      console.error('Error changing status:', error)
    }
  }

  // Handle add article to KB
  const handleAddArticle = async () => {
    if (!newArticle.category_key || !newArticle.subcategory_key || !newArticle.question || !newArticle.answer) {
      return
    }

    setIsAddingArticle(true)

    try {
      await chatApi.addArticle(newArticle)
      setAddArticleSuccess(true)
      setNewArticle({
        category_key: '',
        subcategory_key: '',
        question: '',
        answer: '',
        question_kz: '',
        answer_kz: '',
        can_auto_resolve: true,
        priority: 'medium',
      })

      setTimeout(() => setAddArticleSuccess(false), 3000)
    } catch (error) {
      console.error('Error adding article:', error)
    } finally {
      setIsAddingArticle(false)
    }
  }

  // Get subcategories for selected category
  const selectedCategory = kbCategories.find((c) => c.key === newArticle.category_key)

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/30 bg-surface/50 backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Панель оператора</h1>
              <p className="mt-1 text-sm text-muted">
                Обработка обращений и управление базой знаний
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  Онлайн
                </span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex gap-4">
            <button
              onClick={() => setActiveTab('tickets')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === 'tickets'
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface text-muted hover:bg-surface/80 hover:text-foreground'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Обращения
              {tickets.filter((t) => t.status === 'pending').length > 0 && (
                <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-xs">
                  {tickets.filter((t) => t.status === 'pending').length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('knowledge')}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeTab === 'knowledge'
                  ? 'bg-brand-500 text-white'
                  : 'bg-surface text-muted hover:bg-surface/80 hover:text-foreground'
              }`}
            >
              <Brain className="h-4 w-4" />
              База знаний AI
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Tickets Tab */}
        {activeTab === 'tickets' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Tickets List */}
            <div className="rounded-2xl border border-border/30 bg-surface p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-foreground">Эскалированные обращения</h2>
                <button
                  onClick={loadEscalations}
                  disabled={isLoading}
                  className="rounded-lg p-2 text-muted transition hover:bg-background hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {/* Filters */}
              <div className="mb-4 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    type="text"
                    placeholder="Поиск по номеру или тексту..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-border/30 bg-background py-2 pl-10 pr-4 text-sm text-foreground placeholder-muted focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-lg border border-border/30 bg-background px-3 py-2 text-sm text-foreground focus:border-brand-500 focus:outline-none"
                >
                  <option value="all">Все</option>
                  <option value="pending">Ожидают</option>
                  <option value="in_progress">В работе</option>
                  <option value="resolved">Решены</option>
                </select>
              </div>

              {/* Tickets */}
              <div className="space-y-3 max-h-[600px] overflow-y-auto">
                {filteredTickets.length === 0 ? (
                  <div className="py-12 text-center">
                    <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                    <p className="mt-2 text-sm text-muted">Нет обращений</p>
                  </div>
                ) : (
                  filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => setSelectedTicket(ticket)}
                      className={`cursor-pointer rounded-xl border p-4 transition ${
                        selectedTicket?.id === ticket.id
                          ? 'border-brand-500 bg-brand-500/5'
                          : 'border-border/30 bg-background hover:border-brand-400/50'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs text-muted">
                              {ticket.escalation_id}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${priorityColors[ticket.priority]}`}>
                              {ticket.priority}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${statusColors[ticket.status]}`}>
                              {ticket.status === 'pending' ? 'Ожидает' : ticket.status === 'in_progress' ? 'В работе' : 'Решён'}
                            </span>
                          </div>
                          <h3 className="mt-2 font-medium text-foreground">{ticket.summary}</h3>
                          <p className="mt-1 line-clamp-2 text-sm text-muted">
                            {ticket.client_message}
                          </p>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted" />
                      </div>
                      <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {Math.round((Date.now() - new Date(ticket.created_at).getTime()) / 60000)} мин назад
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Response Panel */}
            <div className="rounded-2xl border border-border/30 bg-surface p-6">
              {selectedTicket ? (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">Ответ на обращение</h2>
                    <button
                      onClick={() => setSelectedTicket(null)}
                      className="rounded-lg p-2 text-muted transition hover:bg-background hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Take ticket button */}
                  {selectedTicket.status === 'pending' && (
                    <button
                      onClick={() => handleTakeTicket(selectedTicket)}
                      className="mb-4 w-full rounded-xl bg-blue-500 px-4 py-3 font-medium text-white transition hover:bg-blue-600"
                    >
                      🎯 Взять в работу
                    </button>
                  )}

                  {/* Status badge */}
                  {selectedTicket.status === 'in_progress' && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl bg-blue-500/10 p-3">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        В работе
                      </span>
                    </div>
                  )}

                  {selectedTicket.status === 'resolved' && (
                    <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        Решено
                      </span>
                    </div>
                  )}

                  {/* Ticket Details */}
                  <div className="mb-6 rounded-xl bg-background p-4">
                    <div className="flex items-center gap-2 text-xs text-muted">
                      <span className="font-mono">{selectedTicket.escalation_id}</span>
                      <span>•</span>
                      <span className={`rounded-full px-2 py-0.5 ${priorityColors[selectedTicket.priority]}`}>
                        {selectedTicket.priority}
                      </span>
                      <span>•</span>
                      <span>{selectedTicket.department_name}</span>
                    </div>
                    <h3 className="mt-2 font-medium text-foreground">{selectedTicket.summary}</h3>
                    
                    {/* Conversation history */}
                    {selectedTicket.conversation_history && selectedTicket.conversation_history.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs font-medium text-muted">История разговора:</p>
                        <div className="max-h-40 overflow-y-auto space-y-2 rounded-lg bg-surface p-2">
                          {selectedTicket.conversation_history.map((msg, idx) => (
                            <div
                              key={idx}
                              className={`rounded-lg p-2 text-sm ${
                                msg.is_user
                                  ? 'bg-brand-500/10 text-foreground'
                                  : 'bg-purple-500/10 text-foreground'
                              }`}
                            >
                              <span className="text-xs text-muted">
                                {msg.is_user ? '👤 Клиент:' : '🤖 AI:'}
                              </span>
                              <p className="mt-1">{msg.content}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-4 rounded-lg bg-surface p-3">
                      <p className="text-xs font-medium text-muted mb-1">Последнее сообщение клиента:</p>
                      <p className="text-sm text-foreground">{selectedTicket.client_message}</p>
                    </div>

                    <div className="mt-3 rounded-lg bg-amber-500/10 p-3">
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                        Причина эскалации:
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">{selectedTicket.reason}</p>
                    </div>
                  </div>

                  {/* AI Suggestion */}
                  <div className="mb-4 rounded-xl bg-purple-500/10 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                        AI подсказка
                      </span>
                    </div>
                    <p className="text-sm text-purple-700 dark:text-purple-300">
                      Рекомендую уточнить у клиента детали проблемы и предложить пошаговое решение.
                      После успешного решения можно добавить ответ в базу знаний AI.
                    </p>
                  </div>

                  {/* Status selector */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Статус задания
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusChange('pending')}
                        className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                          selectedTicket.status === 'pending'
                            ? 'bg-amber-500 text-white'
                            : 'bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 dark:text-amber-400'
                        }`}
                      >
                        ⏳ Ожидает
                      </button>
                      <button
                        onClick={() => handleStatusChange('in_progress')}
                        className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                          selectedTicket.status === 'in_progress'
                            ? 'bg-blue-500 text-white'
                            : 'bg-blue-500/10 text-blue-600 hover:bg-blue-500/20 dark:text-blue-400'
                        }`}
                      >
                        🔄 В работе
                      </button>
                      <button
                        onClick={() => handleStatusChange('resolved')}
                        className={`flex-1 rounded-xl px-4 py-2 text-sm font-medium transition ${
                          selectedTicket.status === 'resolved'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400'
                        }`}
                      >
                        ✅ Решено
                      </button>
                    </div>
                  </div>

                  {/* Response Input */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Ваш ответ клиенту
                    </label>
                    <textarea
                      value={response}
                      onChange={(e) => setResponse(e.target.value)}
                      placeholder="Введите ответ..."
                      rows={6}
                      className="w-full rounded-xl border border-border/30 bg-background p-4 text-foreground placeholder-muted focus:border-brand-500 focus:outline-none"
                    />
                    <div className="mt-4 flex gap-2">
                      <button
                        onClick={handleSendResponse}
                        disabled={!response.trim() || isSubmitting}
                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-3 font-medium text-white transition hover:bg-brand-600 disabled:opacity-50"
                      >
                        {isSubmitting ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Отправить ответ и закрыть
                      </button>
                      <button
                        onClick={() => {
                          setActiveTab('knowledge')
                          setNewArticle((prev) => ({
                            ...prev,
                            question: selectedTicket.summary,
                            answer: response || '',
                          }))
                        }}
                        className="flex items-center gap-2 rounded-xl border border-border/30 bg-background px-4 py-3 font-medium text-foreground transition hover:bg-surface"
                      >
                        <BookOpen className="h-4 w-4" />
                        В базу знаний
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex h-full flex-col items-center justify-center py-12 text-center">
                  <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500/10">
                    <MessageSquare className="h-8 w-8 text-brand-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Выберите обращение</h3>
                  <p className="mt-2 max-w-xs text-sm text-muted">
                    Выберите обращение из списка слева, чтобы ответить клиенту
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Knowledge Base Tab */}
        {activeTab === 'knowledge' && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Add Article Form */}
            <div className="rounded-2xl border border-border/30 bg-surface p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10">
                  <Plus className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Добавить в базу знаний</h2>
                  <p className="text-sm text-muted">AI будет использовать эту информацию</p>
                </div>
              </div>

              {addArticleSuccess && (
                <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-4 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span>Статья успешно добавлена в базу знаний!</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Category */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Категория *
                  </label>
                  <select
                    value={newArticle.category_key}
                    onChange={(e) =>
                      setNewArticle((prev) => ({
                        ...prev,
                        category_key: e.target.value,
                        subcategory_key: '',
                      }))
                    }
                    className="w-full rounded-xl border border-border/30 bg-background px-4 py-3 text-foreground focus:border-brand-500 focus:outline-none"
                  >
                    <option value="">Выберите категорию</option>
                    {kbCategories.map((cat) => (
                      <option key={cat.key} value={cat.key}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subcategory */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Подкатегория *
                  </label>
                  <select
                    value={newArticle.subcategory_key}
                    onChange={(e) =>
                      setNewArticle((prev) => ({ ...prev, subcategory_key: e.target.value }))
                    }
                    disabled={!newArticle.category_key}
                    className="w-full rounded-xl border border-border/30 bg-background px-4 py-3 text-foreground focus:border-brand-500 focus:outline-none disabled:opacity-50"
                  >
                    <option value="">Выберите подкатегорию</option>
                    {selectedCategory?.subcategories.map((sub) => (
                      <option key={sub.key} value={sub.key}>
                        {sub.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Question */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Вопрос (RU) *
                  </label>
                  <input
                    type="text"
                    value={newArticle.question}
                    onChange={(e) =>
                      setNewArticle((prev) => ({ ...prev, question: e.target.value }))
                    }
                    placeholder="Например: Как подключиться к VPN?"
                    className="w-full rounded-xl border border-border/30 bg-background px-4 py-3 text-foreground placeholder-muted focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Question KZ */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Вопрос (KZ)
                  </label>
                  <input
                    type="text"
                    value={newArticle.question_kz}
                    onChange={(e) =>
                      setNewArticle((prev) => ({ ...prev, question_kz: e.target.value }))
                    }
                    placeholder="Қазақша сұрақ"
                    className="w-full rounded-xl border border-border/30 bg-background px-4 py-3 text-foreground placeholder-muted focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Answer */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Ответ (RU) *
                  </label>
                  <textarea
                    value={newArticle.answer}
                    onChange={(e) =>
                      setNewArticle((prev) => ({ ...prev, answer: e.target.value }))
                    }
                    placeholder="Подробный ответ на вопрос..."
                    rows={5}
                    className="w-full rounded-xl border border-border/30 bg-background px-4 py-3 text-foreground placeholder-muted focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Answer KZ */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Ответ (KZ)
                  </label>
                  <textarea
                    value={newArticle.answer_kz}
                    onChange={(e) =>
                      setNewArticle((prev) => ({ ...prev, answer_kz: e.target.value }))
                    }
                    placeholder="Қазақша жауап..."
                    rows={3}
                    className="w-full rounded-xl border border-border/30 bg-background px-4 py-3 text-foreground placeholder-muted focus:border-brand-500 focus:outline-none"
                  />
                </div>

                {/* Options */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Приоритет
                    </label>
                    <select
                      value={newArticle.priority}
                      onChange={(e) =>
                        setNewArticle((prev) => ({ ...prev, priority: e.target.value }))
                      }
                      className="w-full rounded-xl border border-border/30 bg-background px-4 py-3 text-foreground focus:border-brand-500 focus:outline-none"
                    >
                      <option value="low">Низкий</option>
                      <option value="medium">Средний</option>
                      <option value="high">Высокий</option>
                      <option value="critical">Критический</option>
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="mb-2 block text-sm font-medium text-foreground">
                      Авто-решение
                    </label>
                    <div className="flex h-[50px] items-center gap-3 rounded-xl border border-border/30 bg-background px-4">
                      <input
                        type="checkbox"
                        id="auto-resolve"
                        checked={newArticle.can_auto_resolve}
                        onChange={(e) =>
                          setNewArticle((prev) => ({ ...prev, can_auto_resolve: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-border text-brand-500 focus:ring-brand-500"
                      />
                      <label htmlFor="auto-resolve" className="text-sm text-foreground">
                        AI может решить сам
                      </label>
                    </div>
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={handleAddArticle}
                  disabled={
                    isAddingArticle ||
                    !newArticle.category_key ||
                    !newArticle.subcategory_key ||
                    !newArticle.question ||
                    !newArticle.answer
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-500 px-4 py-3 font-medium text-white transition hover:bg-purple-600 disabled:opacity-50"
                >
                  {isAddingArticle ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4" />
                  )}
                  Добавить в базу знаний AI
                </button>
              </div>
            </div>

            {/* Info Panel */}
            <div className="space-y-6">
              {/* Stats */}
              <div className="rounded-2xl border border-border/30 bg-surface p-6">
                <h3 className="mb-4 text-lg font-semibold text-foreground">Статистика базы знаний</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl bg-background p-4">
                    <div className="text-2xl font-bold text-foreground">4</div>
                    <div className="text-sm text-muted">Категории</div>
                  </div>
                  <div className="rounded-xl bg-background p-4">
                    <div className="text-2xl font-bold text-foreground">12+</div>
                    <div className="text-sm text-muted">Статей</div>
                  </div>
                  <div className="rounded-xl bg-background p-4">
                    <div className="text-2xl font-bold text-emerald-500">78%</div>
                    <div className="text-sm text-muted">Авто-решение</div>
                  </div>
                  <div className="rounded-xl bg-background p-4">
                    <div className="text-2xl font-bold text-purple-500">2</div>
                    <div className="text-sm text-muted">Языка</div>
                  </div>
                </div>
              </div>

              {/* How it works */}
              <div className="rounded-2xl border border-border/30 bg-surface p-6">
                <h3 className="mb-4 text-lg font-semibold text-foreground">Как это работает</h3>
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-sm font-bold text-purple-500">
                      1
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Добавьте статью</p>
                      <p className="text-sm text-muted">
                        Заполните вопрос и ответ в форме слева
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-sm font-bold text-purple-500">
                      2
                    </div>
                    <div>
                      <p className="font-medium text-foreground">AI обучится</p>
                      <p className="text-sm text-muted">
                        Статья сразу попадёт в иерархический RAG
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-sm font-bold text-purple-500">
                      3
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Автоматические ответы</p>
                      <p className="text-sm text-muted">
                        AI будет использовать статью для ответов клиентам
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  <h3 className="font-semibold text-purple-600 dark:text-purple-400">Советы</h3>
                </div>
                <ul className="space-y-2 text-sm text-purple-700 dark:text-purple-300">
                  <li>• Пишите вопросы так, как их задают клиенты</li>
                  <li>• Включайте пошаговые инструкции в ответы</li>
                  <li>• Добавляйте казахскую версию для лучшего охвата</li>
                  <li>• Отмечайте "Авто-решение" для простых вопросов</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

