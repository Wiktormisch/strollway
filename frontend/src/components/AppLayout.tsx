import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useMatch } from 'react-router-dom'
import { Baby } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LanguageSwitch } from './LanguageSwitch'
import { ThemeSwitch } from './ThemeSwitch'

const NAV_ITEMS = [
  { to: '/', key: 'nav.planner', end: true },
  { to: '/walks', key: 'nav.walks', end: false },
  { to: '/profiles', key: 'nav.profiles', end: false },
] as const

export function AppLayout() {
  const { t } = useTranslation()
  // The planner is a full-screen map; other pages use a centred column.
  const fullScreen = useMatch('/') !== null

  return (
    <div
      className={cn(
        'flex flex-col bg-background text-foreground',
        fullScreen ? 'h-svh' : 'min-h-svh',
      )}
    >
      <header className="border-b">
        {/* One row on phones: only the logo icon and short language codes are visible there. */}
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2 sm:gap-4 sm:py-3">
          <NavLink to="/" className="flex shrink-0 items-center gap-2 text-lg font-semibold">
            <Baby aria-hidden className="size-5" />
            <span className="sr-only sm:not-sr-only">{t('app.name')}</span>
          </NavLink>
          <nav className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto sm:gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'shrink-0 rounded-md px-2 py-1.5 text-sm whitespace-nowrap hover:bg-muted sm:px-3',
                    isActive && 'bg-brand-soft font-medium text-foreground hover:bg-brand-soft',
                  )
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
          <ThemeSwitch />
          <LanguageSwitch />
        </div>
      </header>
      <main
        className={cn(
          fullScreen ? 'relative min-h-0 flex-1' : 'mx-auto w-full max-w-5xl px-4 py-6',
        )}
      >
        <Outlet />
      </main>
    </div>
  )
}
