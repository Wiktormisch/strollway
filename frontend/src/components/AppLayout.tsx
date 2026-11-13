import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useMatch } from 'react-router-dom'
import { Baby } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LanguageSwitch } from './LanguageSwitch'
import { ThemeSwitch } from './ThemeSwitch'
import { TopBarMenu } from './TopBarMenu'

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
        fullScreen ? 'relative h-svh' : 'min-h-svh',
      )}
    >
      {/* A floating pill bar (DESIGN.md section 6). Over the map on the planner (to the right
          of the 400 px panel on wide screens), and sticky at the top on other pages. */}
      <header
        className={cn(
          'z-20 px-3 pt-3',
          fullScreen ? 'absolute inset-x-0 top-0 md:left-100' : 'sticky top-0',
        )}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-1 rounded-full border bg-card p-1.5 shadow-lg">
          <NavLink
            to="/"
            aria-label={t('app.name')}
            className="flex size-11 shrink-0 items-center justify-center gap-2 rounded-full text-brand hover:bg-muted lg:w-auto lg:px-3"
          >
            <Baby aria-hidden className="size-6" />
            <span className="hidden text-base font-semibold text-foreground lg:inline">
              {t('app.name')}
            </span>
          </NavLink>
          {/* No sideways scrolling: three short links fit next to the logo and the menu. */}
          <nav className="flex min-w-0 flex-1 gap-0.5">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex h-11 min-w-0 items-center rounded-full px-2.5 text-sm whitespace-nowrap hover:bg-muted sm:px-4',
                    isActive && 'bg-brand-soft font-medium text-foreground hover:bg-brand-soft',
                  )
                }
              >
                <span className="truncate">{t(item.key)}</span>
              </NavLink>
            ))}
          </nav>
          <div className="md:hidden">
            <TopBarMenu />
          </div>
          <div className="hidden items-center gap-1 md:flex">
            <ThemeSwitch />
            <LanguageSwitch />
          </div>
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
