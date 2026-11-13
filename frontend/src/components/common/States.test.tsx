import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EmptyState, ListSkeleton, LoadError } from './States'

describe('EmptyState', () => {
  it('shows the sentence and the one action', () => {
    render(<EmptyState title="No walks yet" action={<button>Add</button>} />)
    expect(screen.getByText('No walks yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })
})

describe('LoadError', () => {
  it('is an alert with a working "Try again"', async () => {
    const onRetry = vi.fn()
    render(<LoadError error={new Error('down')} onRetry={onRetry} />)
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('ListSkeleton', () => {
  it('announces loading and draws the given number of blocks', () => {
    render(<ListSkeleton count={2} />)
    const status = screen.getByRole('status', { name: 'Loading…' })
    expect(status.children).toHaveLength(2)
  })
})
