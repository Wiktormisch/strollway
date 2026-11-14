import { useId, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'
import { MIN_PLACE_QUERY_LENGTH, usePlaceSearch } from '@/api/places'
import type { LatLng, PlaceSearchResult } from '@/api/types'
import { Input } from '@/components/ui/input'
import { categoryLabel } from '@/lib/poiLabel'
import { useDebouncedValue } from '@/lib/useDebouncedValue'
import { cn } from '@/lib/utils'

/** Wait this long after the last key, so typing "oliwski" sends one request, not seven. */
export const SEARCH_DELAY_MS = 300

interface PlaceSearchProps {
  onPick: (point: LatLng) => void
}

/**
 * Search our own places by name to set the start (audit idea 15).
 * An ARIA combobox: the input owns a list of options; arrows move, Enter picks, Escape closes.
 */
export function PlaceSearch({ onPick }: PlaceSearchProps) {
  const { t } = useTranslation()
  const listId = useId()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const query = useDebouncedValue(text.trim(), SEARCH_DELAY_MS)
  const search = usePlaceSearch(query)

  const results = search.data ?? []
  const longEnough = query.length >= MIN_PLACE_QUERY_LENGTH
  const showList = open && longEnough
  const optionId = (index: number) => `${listId}-${index}`

  function pick(place: PlaceSearchResult) {
    onPick({ lat: place.lat, lng: place.lng })
    setText('')
    setOpen(false)
    setActive(-1)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!results.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault() // keep the caret where it is
      setOpen(true)
      const step = event.key === 'ArrowDown' ? 1 : -1
      setActive((current) => (current + step + results.length) % results.length)
    } else if (event.key === 'Enter' && showList && active >= 0) {
      event.preventDefault() // do not submit the planner form
      pick(results[active])
    }
  }

  return (
    <div className="relative space-y-1">
      <label htmlFor={`${listId}-input`} className="text-sm font-medium">
        {t('placeSearch.label')}
      </label>
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={`${listId}-input`}
          type="search"
          role="combobox"
          autoComplete="off"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          placeholder={t('placeSearch.placeholder')}
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setOpen(true)
            setActive(-1)
          }}
          onFocus={() => setOpen(true)}
          // A short delay, so a click on an option lands before the list closes.
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          className="pl-9"
        />
        {search.isFetching && (
          <Loader2
            aria-hidden
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
          />
        )}
      </div>

      {showList && (
        <div className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-lg">
          <ul
            id={listId}
            role="listbox"
            aria-label={t('placeSearch.label')}
            className="max-h-64 overflow-y-auto py-1"
          >
            {results.map((place, index) => (
              <li
                key={place.poi_id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                // mousedown, not click: it fires before the input loses focus.
                onMouseDown={(event) => {
                  event.preventDefault()
                  pick(place)
                }}
                className={cn(
                  'flex min-h-11 cursor-pointer flex-col justify-center px-3 py-1.5 hover:bg-muted',
                  index === active && 'bg-muted',
                )}
              >
                <span className="text-sm font-medium">{place.name}</span>
                <span className="text-xs text-muted-foreground">
                  {categoryLabel(t, place.category)}
                </span>
              </li>
            ))}
          </ul>
          {/* Status lines live outside the listbox: a listbox may hold only options. */}
          <p role="status" className="px-3 py-2 text-sm text-muted-foreground empty:hidden">
            {search.isError
              ? t('placeSearch.error')
              : search.isFetching && !results.length
                ? t('placeSearch.loading')
                : search.isSuccess && !results.length
                  ? t('placeSearch.empty')
                  : ''}
          </p>
        </div>
      )}
    </div>
  )
}
