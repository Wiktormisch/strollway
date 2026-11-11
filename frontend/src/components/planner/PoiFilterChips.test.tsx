import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { PoiFilterChips } from './PoiFilterChips'

const categories = [
  { category: 'cafe', count: 2 },
  { category: 'bench', count: 5 },
]

describe('PoiFilterChips', () => {
  it('shows each category with its count and state', () => {
    render(
      <PoiFilterChips categories={categories} hidden={new Set(['bench'])} onToggle={vi.fn()} />,
    )
    expect(screen.getByRole('button', { name: 'Cafe (2)' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Bench (5)' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('toggles a category by click and by keyboard', async () => {
    const onToggle = vi.fn()
    const user = userEvent.setup()
    render(<PoiFilterChips categories={categories} hidden={new Set()} onToggle={onToggle} />)

    await user.click(screen.getByRole('button', { name: 'Cafe (2)' }))
    expect(onToggle).toHaveBeenLastCalledWith('cafe')

    await user.tab() // focus moves to the next chip
    await user.keyboard('{Enter}')
    expect(onToggle).toHaveBeenLastCalledWith('bench')
  })
})
