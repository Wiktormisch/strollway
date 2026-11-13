import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { currentTheme, setTheme, type Theme } from '@/lib/theme'

/** One button: it shows the theme you switch to, and its name says so. */
export function ThemeSwitch() {
  const { t } = useTranslation()
  const [theme, setThemeState] = useState<Theme>(currentTheme)
  const next: Theme = theme === 'dark' ? 'light' : 'dark'
  const Icon = next === 'dark' ? Moon : Sun
  const label = t(`theme.switchTo.${next}`)

  function toggle() {
    setTheme(next)
    setThemeState(next)
  }

  return (
    <Button size="icon" variant="ghost" aria-label={label} title={label} onClick={toggle}>
      <Icon aria-hidden />
    </Button>
  )
}
