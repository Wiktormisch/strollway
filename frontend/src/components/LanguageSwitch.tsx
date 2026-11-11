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
    <div role="group" aria-label={t('language.label')} className="flex gap-1">
      {LANGUAGES.map((language) => (
        <Button
          key={language}
          size="sm"
          variant={i18n.language === language ? 'default' : 'ghost'}
          aria-pressed={i18n.language === language}
          lang={language}
          onClick={() => choose(language)}
        >
          {t(`language.${language}`)}
        </Button>
      ))}
    </div>
  )
}
