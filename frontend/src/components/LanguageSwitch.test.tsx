import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useTranslation } from 'react-i18next'
import { LANGUAGE_STORAGE_KEY, detectLanguage } from '@/i18n'
import { LanguageSwitch } from './LanguageSwitch'

function Tagline() {
  const { t } = useTranslation()
  return <p>{t('app.tagline')}</p>
}

describe('LanguageSwitch', () => {
  it('changes the text and saves the choice', async () => {
    render(
      <>
        <LanguageSwitch />
        <Tagline />
      </>,
    )
    expect(screen.getByText('Stair-free walks for families with a stroller')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Polski' }))

    expect(screen.getByText('Spacery bez schodów dla rodzin z wózkiem')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Polski' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('pl')
  })

  it('reads the saved choice before the browser language', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'pl')
    expect(detectLanguage()).toBe('pl')
  })

  it('ignores an unknown saved value', () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'de')
    expect(['pl', 'en']).toContain(detectLanguage())
  })
})
