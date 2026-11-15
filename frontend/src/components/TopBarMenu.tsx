import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronRight, Ellipsis, Info } from 'lucide-react'
import { Popover } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { LanguageSwitch } from './LanguageSwitch'
import { ThemeSwitch } from './ThemeSwitch'

/**
 * Phones only: language, theme and the "How it works" link sit behind one "more" button,
 * so the top bar fits.
 * A popover (not a menu) because it holds toggles; Radix handles Escape, outside clicks
 * and returns the focus to the button.
 */
export function TopBarMenu() {
  const { t } = useTranslation()
  // Controlled, so the popover closes when the user follows the link to another page.
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="icon" variant="ghost" aria-label={t('topBar.menu')}>
          <Ellipsis aria-hidden />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          aria-label={t('topBar.menu')}
          className="z-50 w-64 space-y-3 rounded-2xl border bg-popover p-4 text-popover-foreground shadow-lg"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{t('topBar.theme')}</span>
            <ThemeSwitch />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{t('language.label')}</span>
            <LanguageSwitch />
          </div>
          <Link
            to="/how-it-works"
            onClick={() => setOpen(false)}
            className="-mx-2 flex h-11 items-center gap-2 rounded-xl px-2 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <Info aria-hidden className="size-5 shrink-0 text-sage-500" />
            <span className="flex-1">{t('topBar.howItWorks')}</span>
            <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
