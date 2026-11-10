import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router-dom'
import { Baby } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LanguageSwitch } from './LanguageSwitch'

const NAV_ITEMS = [
  { to: '/', key: 'nav.planner', end: true },
  { to: '/walks', key: 'nav.walks', end: false },
  { to: '/profiles', key: 'nav.profiles', end: false },
] as const

export function AppLayout() {
  const { t } = useTranslation()

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-semibold">
            <Baby aria-hidden className="size-5" />
            {t('app.name')}
          </NavLink>
          <nav className="flex flex-1 gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-1.5 text-sm hover:bg-muted',
                    isActive && 'bg-muted font-medium',
                  )
                }
              >
                {t(item.key)}
              </NavLink>
            ))}
          </nav>
          <LanguageSwitch />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
