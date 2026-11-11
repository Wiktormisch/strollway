import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Star } from 'lucide-react'
import type { WalkListItem } from '@/api/types'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { formatDistance, formatDuration } from '@/lib/format'

export function WalkCard({ walk }: { walk: WalkListItem }) {
  const { t, i18n } = useTranslation()
  return (
    <Card className="h-full">
      <CardContent className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-medium break-words">
            <Link to={`/walks/${walk.id}`} className="hover:underline">
              {walk.name}
            </Link>
          </h2>
          <Badge variant={walk.status === 'done' ? 'default' : 'secondary'} className="shrink-0">
            {t(`walks.status.${walk.status}`)}
          </Badge>
        </div>
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
          <dt className="text-muted-foreground">{t('walks.card.distance')}</dt>
          <dd>{formatDistance(walk.distance_m, i18n.language)}</dd>
          <dt className="text-muted-foreground">{t('walks.card.duration')}</dt>
          <dd>{formatDuration(walk.duration_min)}</dd>
          <dt className="text-muted-foreground">{t('walks.card.stairsAvoided')}</dt>
          <dd>{formatDistance(walk.stairs_avoided_m, i18n.language)}</dd>
          <dt className="text-muted-foreground">{t('walks.card.stops')}</dt>
          <dd>{walk.stops_count}</dd>
        </dl>
        {walk.status === 'done' && walk.rating !== null && (
          <p className="flex items-center gap-1 text-sm">
            <Star aria-hidden className="size-4 fill-amber-400 text-amber-500" />
            {t('walks.rating.value', { value: walk.rating })}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
