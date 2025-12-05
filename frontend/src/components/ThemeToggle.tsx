import { useTheme } from '../contexts/theme'

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="group relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/40 bg-surface/80 text-foreground shadow-sm transition hover:border-brand-400 hover:shadow-soft"
      aria-label="Переключить тему"
    >
      <span className="sr-only">Переключить тему</span>
      <svg
        className={`absolute h-5 w-5 transform text-amber-500 transition-all duration-300 ${
          isDark ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
      </svg>
      <svg
        className={`absolute h-5 w-5 transform text-indigo-400 transition-all duration-300 ${
          isDark ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        }`}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    </button>
  )
}

