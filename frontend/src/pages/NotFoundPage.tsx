import { Link } from 'react-router-dom'

export const NotFoundPage = () => {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-24">
      <div className="max-w-xl rounded-3xl border border-border/30 bg-surface/80 p-10 text-center shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-brand-500">Ошибка 404</p>
        <h1 className="mt-4 text-4xl font-semibold text-foreground">Страница не найдена</h1>
        <p className="mt-4 text-muted">
          Кажется, вы попали по ссылке, которой больше не существует. Проверьте адрес или вернитесь на лендинг, чтобы
          продолжить знакомство с NovaLanding.
        </p>
        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-brand-500"
          >
            На главную
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center justify-center rounded-full border border-border/40 px-6 py-3 text-sm font-semibold text-foreground transition hover:border-brand-400"
          >
            Создать аккаунт
          </Link>
        </div>
      </div>
    </div>
  )
}

