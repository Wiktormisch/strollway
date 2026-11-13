import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { LANGUAGES, saveLanguage, type Language } from '@/i18n'

export function LanguageSwitch() {
  const { t, i18n } = useTranslation()

  function choose(language: Language) {
    void i18n.changeLanguage(language)
    saveLanguage(language)
  }

  return (
    <div role="group" aria-label={t('language.label')} className="flex shrink-0 gap-1">
      {LANGUAGES.map((language) => (
        <Button
          key={language}
          variant={i18n.language === language ? 'default' : 'ghost'}
          aria-pressed={i18n.language === language}
          lang={language}
          onClick={() => choose(language)}
        >
          {/* Phones see "PL" / "EN"; the accessible name stays the full language name. */}
          <span aria-hidden className="sm:hidden">
            {language.toUpperCase()}
          </span>
          <span className="sr-only sm:not-sr-only">{t(`language.${language}`)}</span>
        </Button>
      ))}
    </div>
  )
}
