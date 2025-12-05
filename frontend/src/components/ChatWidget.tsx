import { useState, useRef, useEffect } from 'react'
import {
  X,
  Send,
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
  isOperator?: boolean  // true if message is from human operator
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

// LocalStorage keys
const STORAGE_KEYS = {
  MESSAGES: 'helpdesk_chat_messages',
  ESCALATIONS: 'helpdesk_chat_escalations',
  CSAT_SUBMITTED: 'helpdesk_chat_csat_submitted',
  SESSION_ID: 'helpdesk_chat_session_id',
  LANGUAGE: 'helpdesk_chat_language',
}

// Generate or get session ID
const getSessionId = () => {
  let sessionId = localStorage.getItem(STORAGE_KEYS.SESSION_ID)
  if (!sessionId) {
    sessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem(STORAGE_KEYS.SESSION_ID, sessionId)
  }
  return sessionId
}

// Load messages from localStorage
const loadMessages = (): Message[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES)
    if (saved) {
      const parsed = JSON.parse(saved)
      // Convert timestamp strings back to Date objects
      return parsed.map((m: Message & { timestamp: string }) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      }))
    }
  } catch (e) {
    console.error('Error loading messages:', e)
  }
  return []
}

// Load escalations from localStorage
const loadEscalations = (): string[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.ESCALATIONS)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

// Load CSAT submitted from localStorage
const loadCSATSubmitted = (): string[] => {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.CSAT_SUBMITTED)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

// Load language from localStorage
const loadLanguage = (): 'ru' | 'kz' => {
  const saved = localStorage.getItem(STORAGE_KEYS.LANGUAGE)
  return saved === 'kz' ? 'kz' : 'ru'
}

export const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [messages, setMessages] = useState<Message[]>(loadMessages)
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [language, setLanguage] = useState<'ru' | 'kz'>(loadLanguage)
  const [pendingEscalations, setPendingEscalations] = useState<string[]>(loadEscalations)
  const [showCSAT, setShowCSAT] = useState<string | null>(null) // escalation_id to rate
  const [csatRating, setCSATRating] = useState(0)
  const [csatFeedback, setCSATFeedback] = useState('')
  const [csatSubmitted, setCSATSubmitted] = useState<string[]>(loadCSATSubmitted)
  const [sessionId] = useState(getSessionId)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Save messages to localStorage when they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages))
  }, [messages])

  // Save escalations to localStorage when they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ESCALATIONS, JSON.stringify(pendingEscalations))
  }, [pendingEscalations])

  // Save CSAT submitted to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CSAT_SUBMITTED, JSON.stringify(csatSubmitted))
  }, [csatSubmitted])

  // Save language to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.LANGUAGE, language)
  }, [language])

  // Log session ID for debugging
  useEffect(() => {
    console.log('Chat session ID:', sessionId)
  }, [sessionId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Track how many operator messages we've shown per escalation
  const [shownMessageCounts, setShownMessageCounts] = useState<Record<string, number>>({})

  // Poll for operator responses on pending escalations
  useEffect(() => {
    if (pendingEscalations.length === 0) return

    const checkForResponses = async () => {
      for (const escalationId of pendingEscalations) {
        try {
          const response = await chatApi.getEscalation(escalationId)
          const escalation = response.data

          // Check for new operator messages
          const operatorMessages = escalation.operator_messages || []
          const shownCount = shownMessageCounts[escalationId] || 0
          
          // Show any new operator messages
          if (operatorMessages.length > shownCount) {
            const newMessages = operatorMessages.slice(shownCount)
            
            newMessages.forEach((msg: { content: string; timestamp: string }, index: number) => {
              setMessages((prev) => [
                ...prev,
                {
                  id: `operator-${escalationId}-${shownCount + index}-${Date.now()}`,
                  content: msg.content,
                  isBot: true,
                  isOperator: true,
                  timestamp: new Date(msg.timestamp),
                },
              ])
            })
            
            // Update shown count
            setShownMessageCounts((prev) => ({
              ...prev,
              [escalationId]: operatorMessages.length,
            }))
          }

          // Only remove from pending and show CSAT when resolved
          if (escalation.status === 'resolved') {
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

    // Check immediately and then every 3 seconds (faster polling for chat)
    checkForResponses()
    const interval = setInterval(checkForResponses, 3000)

    return () => clearInterval(interval)
  }, [pendingEscalations, csatSubmitted, shownMessageCounts])

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

  // Get active (non-resolved) escalation ID
  const getActiveEscalationId = (): string | undefined => {
    // Return the first pending escalation that's not resolved
    return pendingEscalations.length > 0 ? pendingEscalations[0] : undefined
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
      const activeEscalation = getActiveEscalationId()
      
      // If there's an active escalation, message goes to operator
      if (activeEscalation) {
        // Send to operator via escalation
        await chatApi.sendToEscalation(activeEscalation, userMessage)
        
        setTimeout(() => {
          addBotMessage(
            language === 'kz'
              ? '📨 Сіздің хабарламаңыз операторға жіберілді. Жауабын күтіңіз.'
              : '📨 Ваше сообщение отправлено оператору. Ожидайте ответа.'
          )
          setIsTyping(false)
        }, 300)
        return
      }

      // Otherwise, send to AI
      const response = await chatApi.send(
        userMessage,
        getConversationHistory(),
        language,
        activeEscalation
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
          className="flex h-16 w-16 items-center justify-center rounded-full overflow-hidden shadow-lg transition-all duration-300 hover:scale-110 hover:shadow-xl ring-4 ring-purple-500/30"
        >
          <img
            src="/images/ai-avatar.jpg"
            alt="AI"
            className="h-full w-full object-cover"
          />
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
              <div className="h-10 w-10 overflow-hidden rounded-xl ring-2 ring-purple-500/30">
                <img
                  src="/images/ai-avatar.jpg"
                  alt="AI"
                  className="h-full w-full object-cover"
                />
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
              {/* New chat button */}
              {messages.length > 0 && (
                <button
                  onClick={() => {
                    if (confirm('Начать новый чат? История будет очищена.')) {
                      setMessages([])
                      setPendingEscalations([])
                      setShowCSAT(null)
                      setCSATRating(0)
                      setCSATFeedback('')
                      // Generate new session
                      const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
                      localStorage.setItem(STORAGE_KEYS.SESSION_ID, newSessionId)
                    }
                  }}
                  className="rounded-lg p-2 text-muted transition hover:bg-surface/80 hover:text-foreground"
                  title="Новый чат"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
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
                <div className="mb-4 h-16 w-16 overflow-hidden rounded-2xl shadow-lg ring-4 ring-purple-500/30">
                  <img
                    src="/images/ai-avatar.jpg"
                    alt="AI"
                    className="h-full w-full object-cover"
                  />
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
                    className={`flex items-end gap-2 ${message.isBot ? 'justify-start' : 'justify-end'}`}
                  >
                    {/* Avatar for bot messages - outside container */}
                    {message.isBot && (
                      <div className="flex-shrink-0">
                        <img
                          src={message.isOperator ? '/images/operator-avatar.webp' : '/images/ai-avatar.jpg'}
                          alt={message.isOperator ? 'Оператор' : 'AI'}
                          className={`h-8 w-8 rounded-full object-cover ring-2 ${message.isOperator ? 'ring-emerald-500/20' : 'ring-purple-500/20'}`}
                        />
                      </div>
                    )}
                    <div
                      className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        message.isBot
                          ? 'bg-surface border border-border/30 text-foreground'
                          : 'bg-gradient-to-br from-purple-500 to-brand-600 text-white'
                      }`}
                    >
                      {message.isBot && (
                        <div className="mb-2 flex items-center gap-2">
                          <span className={`text-xs font-medium ${message.isOperator ? 'text-emerald-500' : 'text-purple-500'}`}>
                            {message.isOperator ? '👨‍💼 Оператор' : '🤖 AI-ассистент'}
                          </span>
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
                  <div className="flex items-end gap-2 justify-start">
                    <div className="flex-shrink-0">
                      <img
                        src="/images/ai-avatar.jpg"
                        alt="AI"
                        className="h-8 w-8 rounded-full object-cover ring-2 ring-purple-500/20"
                      />
                    </div>
                    <div className="rounded-2xl border border-border/30 bg-surface px-4 py-3">
                      <div className="flex items-center gap-2">
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
