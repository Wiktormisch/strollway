// Idea 19: a static page that explains the app, its limits and its data sources (audit X1, U3).
import { useTranslation } from 'react-i18next'
import { Accessibility, Database, MapPin, Route, Sparkles, type LucideIcon } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { usePageTitle } from '@/lib/usePageTitle'

const SECTIONS: { key: string; icon: LucideIcon }[] = [
  { key: 'route', icon: Route },
  { key: 'ai', icon: Sparkles },
  { key: 'area', icon: MapPin },
  { key: 'keyboard', icon: Accessibility },
]

// The credit lines are the exact texts the providers ask for, so they are the same in pl and en.
const SOURCES = [
  { key: 'routes', href: 'https://openrouteservice.org' },
  { key: 'map', href: 'https://www.openstreetmap.org/copyright' },
  { key: 'weather', href: 'https://open-meteo.com' },
] as const

export function HowItWorksPage() {
  const { t } = useTranslation()
  usePageTitle(t('pages.howItWorks.title'))

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">{t('pages.howItWorks.title')}</h1>
      <p className="max-w-prose text-muted-foreground">{t('howItWorks.intro')}</p>

      {SECTIONS.map(({ key, icon: Icon }) => (
        <Card key={key}>
          <CardHeader>
            <h2 className="flex items-center gap-2 text-lg leading-snug font-medium">
              <Icon aria-hidden className="size-5 shrink-0 text-sage-500" />
              {t(`howItWorks.${key}.title`)}
            </h2>
          </CardHeader>
          <CardContent>
            <p className="max-w-prose">{t(`howItWorks.${key}.text`)}</p>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <h2 className="flex items-center gap-2 text-lg leading-snug font-medium">
            <Database aria-hidden className="size-5 shrink-0 text-sage-500" />
            {t('howItWorks.sources.title')}
          </h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-3">
            {SOURCES.map(({ key, href }) => (
              <li key={key}>
                <span className="block text-sm text-muted-foreground">
                  {t(`howItWorks.sources.${key}.what`)}
                </span>
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-2 hover:text-muted-foreground focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  {t(`howItWorks.sources.${key}.credit`)}
                </a>
              </li>
            ))}
          </ul>
          <p className="max-w-prose text-sm text-muted-foreground">
            {t('howItWorks.sources.licences')}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
