import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PointRow } from './PointRow'

const POINT = { lat: 54.123456, lng: 18.654321 }

function renderRow(props: Partial<Parameters<typeof PointRow>[0]> = {}) {
  const onChange = vi.fn()
  const onClear = vi.fn()
  render(
    <PointRow
      badge="A"
      name="Start"
      point={POINT}
      onChange={onChange}
      onClear={onClear}
      {...props}
    />,
  )
  return { onChange, onClear }
}

describe('PointRow', () => {
  it('shows "Point on the map" and hides the coordinates in closed details', async () => {
    const user = userEvent.setup()
    renderRow()
    expect(screen.getByText('Point on the map')).toBeInTheDocument()
    const coordinates = screen.getByText('54.12346, 18.65432')
    expect(coordinates).not.toBeVisible()

    await user.click(screen.getByText('Details'))
    expect(coordinates).toBeVisible()
  })

  it('shows the demo name instead of the generic label', () => {
    renderRow({ demoName: 'Big detour' })
    expect(screen.getByText('Big detour')).toBeInTheDocument()
    expect(screen.queryByText('Point on the map')).not.toBeInTheDocument()
  })

  it('without a point: says "Not set", no details and no clear button', () => {
    renderRow({ point: null })
    expect(screen.getByText('Not set')).toBeInTheDocument()
    expect(screen.queryByText('Details')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear Start' })).not.toBeInTheDocument()
  })

  it('calls the change and clear actions', async () => {
    const user = userEvent.setup()
    const { onChange, onClear } = renderRow()
    await user.click(screen.getByRole('button', { name: 'Change: Start' }))
    await user.click(screen.getByRole('button', { name: 'Clear Start' }))
    expect(onChange).toHaveBeenCalledOnce()
    expect(onClear).toHaveBeenCalledOnce()
  })
})
