import { useState, useRef, useEffect } from 'react'
import {
  X,
  Send,
  Bot,
  Sparkles,
  RefreshCw,
  Minimize2,
  Maximize2,
  ExternalLink,
  HelpCircle,
  FileText,
  Zap,
  BookOpen,
  Star,
} from 'lucide-react'
import { chatApi, type ChatMessage as APIChatMessage, type ToolCallResult } from '../api/client'

interface Message {
  id: string
  content: string
  isBot: boolean
  timestamp: Date
  sources?: Array<{
    category: string
    subcategory: string
    question: string
  }>
  canAutoResolve?: boolean
  toolCall?: ToolCallResult | null
}

const quickActions = [
  { icon: <Sparkles className="h-4 w-4" />, label: 'Создать обращение', action: 'create_ticket' },
  { icon: <HelpCircle className="h-4 w-4" />, label: 'Найти ответ в базе знаний', action: 'search_kb' },
  { icon: <FileText className="h-4 w-4" />, label: 'Проверить статус тикета', action: 'check_status' },
  { icon: <Zap className="h-4 w-4" />, label: 'Срочная проблема', action: 'urgent' },
]

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [language, setLanguage] = useState<'ru' | 'kz'>('ru')
  const [pendingEscalations, setPendingEscalations] = useState<string[]>([])
  const [showCSAT, setShowCSAT] = useState<string | null>(null) // escalation_id to rate
  const [csatRating, setCSATRating] = useState(0)
  const [csatFeedback, setCSATFeedback] = useState('')
  const [csatSubmitted, setCSATSubmitted] = useState<string[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Poll for operator responses on pending escalations
  useEffect(() => {
    if (pendingEscalations.length === 0) return

    const checkForResponses = async () => {
      for (const escalationId of pendingEscalations) {
        try {
          const response = await chatApi.getEscalation(escalationId)
          const escalation = response.data

          // If operator responded
          if (escalation.status === 'resolved' && escalation.operator_response) {
            // Add operator message to chat
            setMessages((prev) => [
              ...prev,
              {
                id: `operator-${escalationId}`,
                content: `👨‍💼 **Ответ оператора:**\n\n${escalation.operator_response}`,
                isBot: true,
                timestamp: new Date(),
              },
            ])

            // Remove from pending
            setPendingEscalations((prev) => prev.filter((id) => id !== escalationId))
            
            // Show CSAT form if not already submitted
            if (!csatSubmitted.includes(escalationId)) {
              setShowCSAT(escalationId)
            }
          }
        } catch (error) {
          console.error('Error checking escalation:', error)
        }
      }
    }

    // Check immediately and then every 5 seconds
    checkForResponses()
    const interval = setInterval(checkForResponses, 5000)

    return () => clearInterval(interval)
  }, [pendingEscalations, csatSubmitted])

  // Submit CSAT rating
  const handleSubmitCSAT = async () => {
    if (!showCSAT || csatRating === 0) return

    try {
      await chatApi.submitCSAT(showCSAT, csatRating, csatFeedback || undefined)
      
      // Add thank you message
      setMessages((prev) => [
        ...prev,
        {
          id: `csat-thanks-${showCSAT}`,
          content: `⭐ Спасибо за вашу оценку (${csatRating}/5)! Мы ценим ваш отзыв и постоянно улучшаем качество обслуживания.`,
          isBot: true,
          timestamp: new Date(),
        },
      ])

      setCSATSubmitted((prev) => [...prev, showCSAT])
      setShowCSAT(null)
      setCSATRating(0)
      setCSATFeedback('')
    } catch (error) {
      console.error('Error submitting CSAT:', error)
    }
  }

  // Convert messages to API format
  const getConversationHistory = (): APIChatMessage[] => {
    return messages.map((m) => ({
      content: m.content,
      is_user: !m.isBot,
    }))
  }

  const addBotMessage = (
    content: string,
    sources?: Message['sources'],
    canAutoResolve?: boolean,
    toolCall?: ToolCallResult | null
  ) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        content,
        isBot: true,
        timestamp: new Date(),
        sources,
        canAutoResolve,
        toolCall,
      },
    ])
  }

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage = input.trim()
    setInput('')

    // Add user message
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        content: userMessage,
        isBot: false,
        timestamp: new Date(),
      },
    ])

    setIsTyping(true)

    try {
      // Call RAG-powered chat API with Function Calling
      const response = await chatApi.send(
        userMessage,
        getConversationHistory(),
        language
      )

      const { response: botResponse, sources, can_auto_resolve, tool_call } = response.data

      // If escalation was created, track it for polling operator response
      if (tool_call && tool_call.name === 'escalate_to_operator' && tool_call.result?.escalation_id) {
        setPendingEscalations((prev) => [...prev, tool_call.result.escalation_id as string])
      }
      if (tool_call && tool_call.name === 'create_ticket' && tool_call.result?.ticket_number) {
        setPendingEscalations((prev) => [...prev, tool_call.result.ticket_number as string])
      }

      setTimeout(() => {
        addBotMessage(botResponse, sources, can_auto_resolve, tool_call)
        setIsTyping(false)
      }, 500)
    } catch (error) {
      console.error('Chat error:', error)
      setTimeout(() => {
        addBotMessage(
          language === 'kz'
            ? 'Кешіріңіз, қате орын алды. Тикет жасауыңызды ұсынамын.'
            : 'Извините, произошла ошибка. Рекомендую создать тикет для получения помощи.'
        )
        setIsTyping(false)
      }, 500)
    }
  }

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'create_ticket':
        window.location.href = '/submit'
        break
      case 'search_kb':
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            content: language === 'kz' ? 'Білім базасынан іздеу' : 'Поиск в базе знаний',
            isBot: false,
            timestamp: new Date(),
          },
        ])
        addBotMessage(
          language === 'kz'
            ? 'Сұрағыңызды жазыңыз, мен білім базасынан жауап іздеймін. AI иерархиялық RAG жүйесін қолданады.'
            : 'Напишите ваш вопрос, и я поищу ответ в базе знаний. AI использует иерархическую RAG-систему для точного поиска.'
        )
        break
      case 'check_status':
        addBotMessage(
          language === 'kz'
            ? 'Тикет нөмірін енгізіңіз (мысалы, TKT-241205-XXXX), мен оның күйін тексеремін.'
            : 'Введите номер вашего тикета (например, TKT-241205-XXXX), и я проверю его статус.'
        )
        break
      case 'urgent':
        window.location.href = '/submit?priority=critical'
        break
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <>
      {/* Chat Button */}
      <div
        className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${
          isOpen ? 'scale-0 opacity-0 pointer-events-none' : 'scale-100 opacity-100'
        }`}
      >
        {/* Tooltip bubble */}
        <div className="absolute bottom-full right-0 mb-3 animate-bounce-slow">
          <div className="relative whitespace-nowrap rounded-2xl bg-white px-4 py-3 text-sm font-medium text-gray-800 shadow-lg dark:bg-slate-800 dark:text-white">
            <span>👋 Нажми на меня, если нужна помощь!</span>
            {/* Arrow */}
            <div className="absolute -bottom-2 right-6 h-4 w-4 rotate-45 bg-white dark:bg-slate-800" />
          </div>
        </div>
        
        {/* Button */}
        <button
          onClick={() => setIsOpen(true)}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-brand-600 text-white shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl"
        >
          <Bot className="h-8 w-8" />
          {/* Pulse animation */}
          <span className="absolute inset-0 animate-ping rounded-full bg-purple-400 opacity-30" />
        </button>
      </div>

      {/* Chat Window */}
      <div
        className={`fixed z-50 transition-all duration-300 ${
          isOpen ? 'scale-100 opacity-100' : 'scale-95 opacity-0 pointer-events-none'
        } ${
          isExpanded
            ? 'inset-4 sm:inset-8'
            : 'bottom-6 right-6 h-[600px] w-[420px] max-h-[85vh]'
        }`}
      >
        <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-border/30 bg-surface shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/20 bg-gradient-to-r from-purple-500/10 to-brand-500/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-brand-600 text-white">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">AI Help Desk</h3>
                <p className="text-xs text-muted">
                  RAG-система · Отвечаю мгновенно
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Language toggle */}
              <div className="mr-2 flex rounded-lg bg-surface/50 p-0.5">
                <button
                  onClick={() => setLanguage('ru')}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                    language === 'ru'
                      ? 'bg-brand-500 text-white'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  RU
                </button>
                <button
                  onClick={() => setLanguage('kz')}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                    language === 'kz'
                      ? 'bg-brand-500 text-white'
                      : 'text-muted hover:text-foreground'
                  }`}
                >
                  KZ
                </button>
              </div>
              <button
                onClick={() => window.open('/submit', '_blank')}
                className="rounded-lg p-2 text-muted transition hover:bg-surface/80 hover:text-foreground"
                title="Открыть в новом окне"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="rounded-lg p-2 text-muted transition hover:bg-surface/80 hover:text-foreground"
              >
                {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-2 text-muted transition hover:bg-surface/80 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-brand-600 text-white shadow-lg">
                  <Bot className="h-8 w-8" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">
                  {language === 'kz' ? 'Сәлем! Мен AI-көмекші 👋' : 'Привет! Я AI-ассистент 👋'}
                </h3>
                <p className="mt-2 max-w-xs text-sm text-muted">
                  {language === 'kz'
                    ? 'Мен сұрағыңызға жауап табуға немесе қолдау қызметіне өтініш жасауға көмектесемін'
                    : 'Я помогу найти ответ на ваш вопрос или создать обращение в службу поддержки'}
                </p>

                {/* RAG Info */}
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-purple-500/10 px-3 py-2 text-xs text-purple-600 dark:text-purple-300">
                  <BookOpen className="h-4 w-4" />
                  <span>Иерархический RAG с базой знаний</span>
                </div>

                {/* Quick Actions */}
                <div className="mt-6 w-full space-y-2">
                  {quickActions.map((action) => (
                    <button
                      key={action.action}
                      onClick={() => handleQuickAction(action.action)}
                      className="flex w-full items-center gap-3 rounded-xl border border-border/30 bg-background/50 px-4 py-3 text-left text-sm transition hover:border-brand-400 hover:bg-brand-500/5"
                    >
                      <span className="text-purple-500">{action.icon}</span>
                      <span className="text-foreground">{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.isBot
                          ? 'bg-surface border border-border/30 text-foreground'
                          : 'bg-gradient-to-br from-purple-500 to-brand-600 text-white'
                      }`}
                    >
                      {message.isBot && (
                        <div className="mb-2 flex items-center gap-2">
                          <Bot className="h-4 w-4 text-purple-500" />
                          <span className="text-xs font-medium text-purple-500">AI-ассистент</span>
                          {message.canAutoResolve && (
                            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                              ✓ Решено
                            </span>
                          )}
                        </div>
                      )}
                      <p className="whitespace-pre-wrap text-sm">{message.content}</p>
                      
                      {/* Tool Call Info (Escalation/Ticket) */}
                      {message.toolCall && message.toolCall.result && (
                        <div className={`mt-3 rounded-lg p-3 ${
                          message.toolCall.name === 'escalate_to_operator'
                            ? 'bg-amber-500/10 border border-amber-500/30'
                            : message.toolCall.name === 'create_ticket'
                            ? 'bg-emerald-500/10 border border-emerald-500/30'
                            : 'bg-blue-500/10 border border-blue-500/30'
                        }`}>
                          {message.toolCall.name === 'escalate_to_operator' && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🔄</span>
                                <span className="font-medium text-amber-600 dark:text-amber-400">
                                  Передано оператору
                                </span>
                              </div>
                              <div className="text-xs space-y-1 text-muted">
                                <p>📋 Номер: <span className="font-mono text-foreground">{message.toolCall.result.escalation_id}</span></p>
                                <p>🏢 Отдел: {message.toolCall.result.department_name}</p>
                                <p>⚡ Приоритет: {message.toolCall.result.priority}</p>
                              </div>
                            </div>
                          )}
                          {message.toolCall.name === 'create_ticket' && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🎫</span>
                                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                                  Тикет создан
                                </span>
                              </div>
                              <div className="text-xs space-y-1 text-muted">
                                <p>📋 Номер: <span className="font-mono text-foreground">{message.toolCall.result.ticket_number}</span></p>
                                <p>📝 Тема: {message.toolCall.result.subject}</p>
                                <p>⚡ Приоритет: {message.toolCall.result.priority}</p>
                              </div>
                            </div>
                          )}
                          {message.toolCall.name === 'check_ticket_status' && (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🔍</span>
                                <span className="font-medium text-blue-600 dark:text-blue-400">
                                  Статус тикета
                                </span>
                              </div>
                              <div className="text-xs space-y-1 text-muted">
                                <p>📋 Номер: <span className="font-mono text-foreground">{message.toolCall.result.ticket_number}</span></p>
                                <p>📊 Статус: {message.toolCall.result.status}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Sources */}
                      {message.sources && message.sources.length > 0 && !message.toolCall && (
                        <div className="mt-3 border-t border-border/20 pt-2">
                          <p className="text-xs text-muted mb-1">📚 Источники:</p>
                          <div className="space-y-1">
                            {message.sources.map((source, idx) => (
                              <div
                                key={idx}
                                className="text-xs text-muted/80 flex items-center gap-1"
                              >
                                <span className="text-purple-400">→</span>
                                {source.category} / {source.subcategory}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <p
                        className={`mt-1 text-xs ${
                          message.isBot ? 'text-muted' : 'text-white/70'
                        }`}
                      >
                        {message.timestamp.toLocaleTimeString('ru-RU', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>
                ))}

                {isTyping && (
                  <div className="flex justify-start">
                    <div className="rounded-2xl border border-border/30 bg-surface px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-purple-500" />
                        <span className="text-xs text-muted">AI думает</span>
                        <div className="flex gap-1">
                          <span className="h-2 w-2 animate-bounce rounded-full bg-purple-500 [animation-delay:0ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-purple-500 [animation-delay:150ms]" />
                          <span className="h-2 w-2 animate-bounce rounded-full bg-purple-500 [animation-delay:300ms]" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* CSAT Rating Form */}
          {showCSAT && (
            <div className="border-t border-border/20 bg-gradient-to-r from-amber-500/10 to-yellow-500/10 p-4">
              <div className="text-center">
                <p className="text-sm font-medium text-foreground mb-2">
                  ⭐ Оцените качество обслуживания
                </p>
                <div className="flex justify-center gap-1 mb-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setCSATRating(star)}
                      className="p-1 transition hover:scale-110"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          star <= csatRating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={csatFeedback}
                  onChange={(e) => setCSATFeedback(e.target.value)}
                  placeholder="Оставьте комментарий (необязательно)"
                  className="w-full rounded-lg border border-border/30 bg-background px-3 py-2 text-sm text-foreground placeholder-muted focus:border-brand-500 focus:outline-none mb-3"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowCSAT(null)
                      setCSATRating(0)
                      setCSATFeedback('')
                    }}
                    className="flex-1 rounded-lg border border-border/30 px-4 py-2 text-sm font-medium text-muted transition hover:bg-surface"
                  >
                    Пропустить
                  </button>
                  <button
                    onClick={handleSubmitCSAT}
                    disabled={csatRating === 0}
                    className="flex-1 rounded-lg bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                  >
                    Отправить
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border/20 bg-background/50 p-4">
            <div className="flex items-end gap-2 rounded-xl border border-border/30 bg-surface p-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={language === 'kz' ? 'Сұрағыңызды жазыңыз...' : 'Напишите сообщение...'}
                rows={1}
                className="max-h-32 min-h-[40px] flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground placeholder-muted focus:outline-none"
                style={{ height: 'auto' }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement
                  target.style.height = 'auto'
                  target.style.height = Math.min(target.scrollHeight, 128) + 'px'
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-brand-600 text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {isTyping ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-muted">
              AI Help Desk · Иерархический RAG · ITFEST 2025
            </p>
          </div>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && isExpanded && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setIsExpanded(false)}
        />
      )}
    </>
  )
}
