import { useTranslation } from 'react-i18next'
import { Ellipsis } from 'lucide-react'
import { Popover } from 'radix-ui'
import { Button } from '@/components/ui/button'
import { LanguageSwitch } from './LanguageSwitch'
import { ThemeSwitch } from './ThemeSwitch'

/**
 * Phones only: language and theme sit behind one "more" button, so the top bar fits.
 * A popover (not a menu) because it holds toggles; Radix handles Escape, outside clicks
 * and returns the focus to the button.
 */
export function TopBarMenu() {
  const { t } = useTranslation()
  return (
    <Popover.Root>
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
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
