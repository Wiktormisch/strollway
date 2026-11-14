import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** An icon button to the "How it works" page; used in the desktop top bar. */
export function HowItWorksLink() {
  const { t } = useTranslation()
  const label = t('topBar.howItWorks')
  return (
    <Button asChild size="icon" variant="ghost">
      <Link to="/how-it-works" aria-label={label} title={label}>
        <Info aria-hidden />
      </Link>
    </Button>
  )
}
