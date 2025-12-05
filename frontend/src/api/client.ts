import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Types
export interface Department {
  id: string
  name: string
  name_kz: string | null
  description: string | null
  is_active: boolean
  created_at: string
}

export interface Category {
  id: string
  name: string
  name_kz: string | null
  description: string | null
  department_id: string | null
  parent_id: string | null
  is_active: boolean
  created_at: string
}

export type TicketStatus = 'new' | 'processing' | 'waiting_response' | 'resolved' | 'closed' | 'escalated'
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical'
export type TicketSource = 'email' | 'chat' | 'portal' | 'phone' | 'telegram'

export interface Ticket {
  id: string
  ticket_number: string
  client_name: string | null
  client_email: string | null
  client_phone: string | null
  subject: string
  description: string
  language: string
  status: TicketStatus
  priority: TicketPriority
  source: TicketSource
  department_id: string | null
  category_id: string | null
  assigned_to_id: string | null
  ai_classified: boolean
  ai_confidence: number | null
  ai_auto_resolved: boolean
  ai_summary: string | null
  ai_suggested_response: string | null
  created_at: string
  updated_at: string
  first_response_at: string | null
  resolved_at: string | null
}

export interface TicketListItem {
  id: string
  ticket_number: string
  subject: string
  client_name: string | null
  client_email: string | null
  status: TicketStatus
  priority: TicketPriority
  source: TicketSource
  ai_classified: boolean
  ai_auto_resolved: boolean
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  ticket_id: string
  sender_id: string | null
  content: string
  is_from_client: boolean
  is_ai_generated: boolean
  is_internal_note: boolean
  created_at: string
}

export interface TicketWithMessages extends Ticket {
  messages: Message[]
  department: Department | null
  category: Category | null
}

export interface TicketStats {
  total_tickets: number
  new_tickets: number
  resolved_tickets: number
  auto_resolved_tickets: number
  avg_response_time_minutes: number | null
  avg_resolution_time_minutes: number | null
  classification_accuracy: number
  auto_resolution_rate: number
}

export interface DepartmentStats {
  department_id: string
  department_name: string
  ticket_count: number
  avg_resolution_time_minutes: number | null
}

export interface PriorityDistribution {
  low: number
  medium: number
  high: number
  critical: number
}

export interface SourceDistribution {
  email: number
  chat: number
  portal: number
  phone: number
  telegram: number
}

export interface DashboardStats {
  ticket_stats: TicketStats
  priority_distribution: PriorityDistribution
  source_distribution: SourceDistribution
  department_stats: DepartmentStats[]
  recent_tickets: TicketListItem[]
}

export interface AIClassificationResult {
  category_id: string | null
  department_id: string | null
  priority: TicketPriority
  confidence: number
  detected_language: string
  summary: string
  suggested_response: string | null
  can_auto_resolve: boolean
}

export interface CreateTicketPayload {
  subject: string
  description: string
  language?: string
  client_name?: string
  client_email?: string
  client_phone?: string
  source?: TicketSource
  category_id?: string
}

export interface UpdateTicketPayload {
  subject?: string
  description?: string
  status?: TicketStatus
  priority?: TicketPriority
  department_id?: string
  category_id?: string
  assigned_to_id?: string
}

// API Functions
export const ticketsApi = {
  list: (params?: {
    status?: TicketStatus
    priority?: TicketPriority
    department_id?: string
    search?: string
    limit?: number
    offset?: number
  }) => api.get<TicketListItem[]>('/tickets', { params }),

  get: (id: string) => api.get<TicketWithMessages>(`/tickets/${id}`),

  getByNumber: (number: string) => api.get<TicketWithMessages>(`/tickets/by-number/${number}`),

  create: (data: CreateTicketPayload) => api.post<Ticket>('/tickets', data),

  update: (id: string, data: UpdateTicketPayload) => api.patch<Ticket>(`/tickets/${id}`, data),

  addMessage: (ticketId: string, content: string, isFromClient = false, useAi = false) =>
    api.post<Message>(`/tickets/${ticketId}/messages`, { content }, {
      params: { is_from_client: isFromClient, use_ai: useAi },
    }),

  escalate: (ticketId: string, departmentId: string) =>
    api.post<Ticket>(`/tickets/${ticketId}/escalate`, null, {
      params: { department_id: departmentId },
    }),

  summarize: (ticketId: string) => api.post<{ summary: string }>(`/tickets/${ticketId}/summarize`),

  classify: (subject: string, description: string, language = 'ru') =>
    api.post<AIClassificationResult>('/tickets/ai/classify', null, {
      params: { subject, description, language },
    }),

  generateResponse: (subject: string, description: string, language = 'ru') =>
    api.post<{ response: string }>('/tickets/ai/generate-response', null, {
      params: { subject, description, language },
    }),

  translate: (text: string, targetLanguage: string) =>
    api.post<{ translated: string }>('/tickets/ai/translate', null, {
      params: { text, target_language: targetLanguage },
    }),

  getDashboardStats: () => api.get<DashboardStats>('/tickets/analytics/dashboard'),
}

export const departmentsApi = {
  list: () => api.get<Department[]>('/departments'),

  create: (data: { name: string; name_kz?: string; description?: string; keywords?: string[] }) =>
    api.post<Department>('/departments', data),
}

export const categoriesApi = {
  list: (departmentId?: string) =>
    api.get<Category[]>('/categories', { params: { department_id: departmentId } }),

  create: (data: {
    name: string
    name_kz?: string
    description?: string
    department_id?: string
    parent_id?: string
    auto_response_template?: string
  }) => api.post<Category>('/categories', data),
}

export const knowledgeBaseApi = {
  search: (query: string, limit = 5) =>
    api.get<Array<{
      id: string
      question: string
      question_kz: string | null
      answer: string
      answer_kz: string | null
      category_id: string | null
      usage_count: number
      is_active: boolean
      created_at: string
    }>>('/knowledge-base/search', { params: { query, limit } }),

  create: (data: {
    question: string
    answer: string
    question_kz?: string
    answer_kz?: string
    category_id?: string
    keywords?: string[]
  }) => api.post('/knowledge-base', data),
}

// Chat API with RAG
export interface ChatMessage {
  content: string
  is_user: boolean
}

export interface ToolCallResult {
  name: string
  args: Record<string, unknown>
  result: {
    success: boolean
    action?: string
    message: string
    escalation_id?: string
    ticket_number?: string
    department?: string
    department_name?: string
    priority?: string
    reason?: string
    summary?: string
    subject?: string
    status?: string
  }
}

export interface ChatResponse {
  response: string
  sources: Array<{
    category: string
    subcategory: string
    question: string
  }>
  can_auto_resolve: boolean
  suggested_priority: string
  tool_call?: ToolCallResult | null
}

export interface KBCategory {
  key: string
  name: string
  name_kz?: string
  subcategories: Array<{
    key: string
    name: string
    article_count: number
  }>
}

// Escalation type for operators
export interface Escalation {
  id: string
  escalation_id: string
  client_message: string
  summary: string
  reason: string
  department: string
  department_name: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'pending' | 'in_progress' | 'resolved'
  created_at: string
  operator_response?: string
  resolved_at?: string
  responded_at?: string
  conversation_history?: Array<{ content: string; is_user: boolean }>
  // New: list of all messages
  client_messages?: Array<{ content: string; timestamp: string }>
  operator_messages?: Array<{ content: string; timestamp: string }>
}

export const chatApi = {
  send: (message: string, conversationHistory?: ChatMessage[], language = 'ru', activeEscalationId?: string) =>
    api.post<ChatResponse>('/chat', {
      message,
      conversation_history: conversationHistory,
      language,
      active_escalation_id: activeEscalationId,
    }),
  
  // Send client message to escalation (when talking to operator)
  sendToEscalation: (escalationId: string, message: string) =>
    api.post<{ success: boolean; escalation: Escalation }>(`/chat/escalations/${escalationId}/messages`, {
      escalation_id: escalationId,
      message,
    }),

  searchKB: (query: string, topK = 3) =>
    api.get<Array<{
      category: string
      subcategory: string
      question: string
      answer: string
      can_auto_resolve: boolean
      priority: string
      score: number
    }>>('/chat/search', { params: { query, top_k: topK } }),

  getCategories: () => api.get<KBCategory[]>('/chat/categories'),

  addArticle: (data: {
    category_key: string
    subcategory_key: string
    question: string
    answer: string
    question_kz?: string
    answer_kz?: string
    can_auto_resolve?: boolean
    priority?: string
  }) => api.post<{ success: boolean; message: string }>('/chat/knowledge-base/add', data),

  health: () => api.get<{
    status: string
    openai_enabled: boolean
    model: string
    categories_count: number
  }>('/chat/health'),

  // AI Stats
  getStats: () => api.get<{
    total_escalations: number
    pending_escalations: number
    in_progress_escalations: number
    resolved_escalations: number
    resolution_rate: number
    by_department: Record<string, number>
    by_priority: Record<string, number>
    ai_enabled: boolean
    ai_model: string
    knowledge_base_categories: number
    knowledge_base_articles: number
  }>('/chat/stats'),

  // AI Tools for operators
  summarize: (text: string, language = 'ru') =>
    api.post<{ summary: string }>('/chat/summarize', { text, language }),

  translate: (text: string, targetLanguage: string) =>
    api.post<{ translated: string; target_language: string }>('/chat/translate', {
      text,
      target_language: targetLanguage,
    }),

  suggestResponse: (clientMessage: string, context?: string, language = 'ru') =>
    api.post<{ suggestion: string }>('/chat/suggest-response', {
      client_message: clientMessage,
      context,
      language,
    }),

  // Escalations API for operators
  getEscalations: (status?: string) =>
    api.get<Escalation[]>('/chat/escalations', { params: status ? { status } : {} }),

  getEscalation: (id: string) => api.get<Escalation>(`/chat/escalations/${id}`),

  updateEscalation: (id: string, data: { status?: string; operator_response?: string }) =>
    api.patch<{ success: boolean; escalation?: Escalation }>(`/chat/escalations/${id}`, data),

  deleteEscalation: (id: string) =>
    api.delete<{ success: boolean; message?: string }>(`/chat/escalations/${id}`),

  // CSAT (Customer Satisfaction Score)
  submitCSAT: (escalationId: string, rating: number, feedback?: string) =>
    api.post<{ success: boolean; message: string }>('/chat/csat', {
      escalation_id: escalationId,
      rating,
      feedback,
    }),

  getCSATStats: () =>
    api.get<{
      average: number
      total_responses: number
      distribution: Record<number, number>
      satisfaction_rate: number
    }>('/chat/csat/stats'),

  getCSATReviews: () =>
    api.get<Array<{
      escalation_id: string
      rating: number
      feedback: string | null
      submitted_at: string
      summary: string
      department_name: string
      resolved_at: string | null
    }>>('/chat/csat/reviews'),
}

