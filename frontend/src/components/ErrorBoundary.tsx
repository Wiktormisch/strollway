import { Component, type ErrorInfo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'

type Props = { children: ReactNode }
type State = { failed: boolean }

/**
 * Catches errors thrown while rendering the page, so the user sees a short message
 * and a reload button instead of a blank screen (audit F3).
 * React has no hook for this yet, so it must be a class component.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error:', error, info.componentStack)
  }

  render() {
    return this.state.failed ? <CrashMessage /> : this.props.children
  }
}

function CrashMessage() {
  const { t } = useTranslation()
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 p-6 text-center">
      <p>{t('errors.crash')}</p>
      <Button onClick={() => window.location.reload()}>{t('errors.reloadPage')}</Button>
    </div>
  )
}
