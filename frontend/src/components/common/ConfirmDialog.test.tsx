import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function renderDialog(onOpenChange = vi.fn(), onConfirm = vi.fn()) {
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Delete this walk?"
      text="It cannot be undone."
      confirmLabel="Delete"
      onConfirm={onConfirm}
    />,
  )
  return {
    dialog: screen.getByRole('dialog', { name: 'Delete this walk?' }),
    onOpenChange,
    onConfirm,
  }
}

describe('ConfirmDialog', () => {
  it('has a translated close button and a red confirm action', () => {
    const { dialog } = renderDialog()
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toHaveAttribute(
      'data-variant',
      'destructive',
    )
  })

  it('Cancel only closes; Delete confirms', async () => {
    const { dialog, onOpenChange, onConfirm } = renderDialog()
    const user = userEvent.setup()
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onConfirm).not.toHaveBeenCalled()
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledOnce()
  })
})
