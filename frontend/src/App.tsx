import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { LandingPage } from './pages/LandingPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { DashboardPage } from './pages/DashboardPage'
import { TicketsListPage } from './pages/TicketsListPage'
import { TicketViewPage } from './pages/TicketViewPage'
import { SubmitTicketPage } from './pages/SubmitTicketPage'
import { DepartmentsPage } from './pages/DepartmentsPage'
import { OperatorPage } from './pages/OperatorPage'
import { ThemeToggle } from './components/ThemeToggle'
import { ParticleBackground } from './components/ParticleBackground'
import { ChatWidget } from './components/ChatWidget'
import {
  Bot,
  LayoutDashboard,
  Inbox,
  Building2,
  MessageSquarePlus,
  Menu,
  X,
  Headphones,
} from 'lucide-react'
import { useState } from 'react'

const publicNavLinks = [
  { href: '/#features', label: 'Возможности' },
  { href: '/#workflow', label: 'Как работает' },
  { href: '/#faq', label: 'FAQ' },
]

const operatorNavLinks = [
  { href: '/dashboard', label: 'Дашборд', icon: <LayoutDashboard className="h-4 w-4" /> },
  { href: '/operator', label: 'Оператор', icon: <Headphones className="h-4 w-4" /> },
  { href: '/tickets', label: 'Тикеты', icon: <Inbox className="h-4 w-4" /> },
  { href: '/departments', label: 'Департаменты', icon: <Building2 className="h-4 w-4" /> },
]

function App() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Determine if we're in operator panel or public site
  const isOperatorPanel =
    location.pathname.startsWith('/dashboard') ||
    location.pathname.startsWith('/operator') ||
    location.pathname.startsWith('/tickets') ||
    location.pathname.startsWith('/departments')

  return (
    <div className="bg-background text-foreground">
      <ParticleBackground />
      <div className="relative flex min-h-screen flex-col">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 bg-[radial-gradient(circle_at_top,_rgba(79,70,229,0.35),_transparent_60%)]" />

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border/30 bg-surface/80 backdrop-blur-lg">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
            <Link to="/" className="flex items-center gap-2 font-semibold text-lg tracking-tight">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-brand-600">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <span className="hidden sm:inline">AI Help Desk</span>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden items-center gap-1 md:flex">
              {isOperatorPanel ? (
                <>
                  {operatorNavLinks.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                        location.pathname === item.href ||
                        (item.href !== '/dashboard' && location.pathname.startsWith(item.href))
                          ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300'
                          : 'text-muted hover:bg-surface/80 hover:text-foreground'
                      }`}
                    >
                      {item.icon}
                      {item.label}
                    </Link>
                  ))}
                </>
              ) : (
                <>
                  {publicNavLinks.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-surface/80 hover:text-foreground"
                    >
                      {item.label}
                    </Link>
                  ))}
                </>
              )}
            </nav>

            <div className="flex items-center gap-2">
              <ThemeToggle />
              {isOperatorPanel ? (
                <Link
                  to="/submit"
                  className="hidden items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-600 sm:flex"
                >
                  <MessageSquarePlus className="h-4 w-4" />
                  Новый тикет
                </Link>
              ) : (
                <Link
                  to="/dashboard"
                  className="hidden items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-600 sm:flex"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  Панель
                </Link>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="rounded-lg p-2 text-muted hover:bg-surface/80 hover:text-foreground md:hidden"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Mobile Navigation */}
          {mobileMenuOpen && (
            <div className="border-t border-border/20 bg-surface/95 px-4 py-4 md:hidden">
              <nav className="space-y-1">
                {(isOperatorPanel ? operatorNavLinks : publicNavLinks).map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      location.pathname === item.href
                        ? 'bg-brand-500/10 text-brand-600 dark:text-brand-300'
                        : 'text-muted hover:bg-surface/80 hover:text-foreground'
                    }`}
                  >
                    {'icon' in item && (item as typeof operatorNavLinks[number]).icon}
                    {item.label}
                  </Link>
                ))}
                <div className="pt-2">
                  {isOperatorPanel ? (
                    <Link
                      to="/submit"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                      Новый тикет
                    </Link>
                  ) : (
                    <Link
                      to="/dashboard"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
                    >
                      <LayoutDashboard className="h-4 w-4" />
                      Панель оператора
                    </Link>
                  )}
                </div>
              </nav>
            </div>
          )}
        </header>

        <main className={`flex-1 ${isOperatorPanel ? 'mx-auto w-full max-w-7xl px-4 py-6 sm:px-6' : ''}`}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/submit" element={<SubmitTicketPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/operator" element={<OperatorPage />} />
            <Route path="/tickets" element={<TicketsListPage />} />
            <Route path="/tickets/:id" element={<TicketViewPage />} />
            <Route path="/departments" element={<DepartmentsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>

        <footer className="border-t border-border/20 bg-surface/70">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:px-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-brand-500" />
              <span>AI Help Desk Service © {new Date().getFullYear()}</span>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link to="/" className="hover:text-foreground">
                Главная
              </Link>
              <Link to="/submit" className="hover:text-foreground">
                Создать обращение
              </Link>
              <Link to="/dashboard" className="hover:text-foreground">
                Дашборд
              </Link>
              <span className="text-muted/50">ITFEST Hackathon 2025</span>
            </div>
          </div>
        </footer>

        {/* Chat Widget */}
        <ChatWidget />
      </div>
    </div>
  )
}

export default App
