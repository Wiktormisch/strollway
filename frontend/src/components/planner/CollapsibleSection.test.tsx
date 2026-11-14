import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CollapsibleSection } from './CollapsibleSection'

it('is closed by default and opens from its title', async () => {
  const user = userEvent.setup()
  render(
    <CollapsibleSection id="stops" title="Stops">
      <p>stop list</p>
    </CollapsibleSection>,
  )
  // The heading stays a heading; the button inside it opens the section.
  expect(screen.getByRole('heading', { name: 'Stops' })).toBeInTheDocument()
  const button = screen.getByRole('button', { name: 'Stops' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  expect(screen.getByText('stop list')).not.toBeVisible()

  await user.click(button)
  expect(button).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText('stop list')).toBeVisible()
})

it('can start open', () => {
  render(
    <CollapsibleSection id="places" title="Places" defaultOpen>
      <p>place list</p>
    </CollapsibleSection>,
  )
  expect(screen.getByText('place list')).toBeVisible()
})
