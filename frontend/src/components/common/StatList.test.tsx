import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { StatList } from './StatList'

describe('StatList', () => {
  it('shows each stat with a hidden icon, a name and a value', () => {
    render(
      <StatList
        label="Route in numbers"
        stats={[
          { kind: 'time', label: 'Time', value: '6 min' },
          { kind: 'kcal', label: 'Calories', value: 'about 23 kcal' },
        ]}
      />,
    )
    const list = screen.getByLabelText('Route in numbers')
    expect(list).toHaveTextContent('Time6 min')
    expect(list).toHaveTextContent('Caloriesabout 23 kcal')
    const icons = list.querySelectorAll('svg')
    expect(icons).toHaveLength(2)
    icons.forEach((icon) => expect(icon).toHaveAttribute('aria-hidden', 'true'))
  })
})
