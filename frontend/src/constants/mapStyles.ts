// Line styles on the map (docs/DESIGN.md section 5).
// The routes differ by shape (solid / dashed / thick), not only by colour.
import type { MapColors } from '@/lib/cssColors'

const ROUTE_WEIGHT = 7
const STAIRS_WEIGHT = 7
/** A wider line in the card colour under a line, so it stands out from busy map tiles. */
const CASING_EXTRA = 4
/** A soft halo in the route colour around the casing. A wide transparent line works in every
 * browser; a CSS filter on SVG paths does not. */
const GLOW_EXTRA = 12

export function mapLineStyles(colors: MapColors) {
  const casing = (weight: number) => ({
    color: colors.card,
    weight: weight + CASING_EXTRA,
    opacity: 1,
    interactive: false,
  })
  return {
    routeGlow: {
      color: colors.route,
      weight: ROUTE_WEIGHT + GLOW_EXTRA,
      opacity: 0.25,
      interactive: false,
    },
    routeCasing: casing(ROUTE_WEIGHT),
    route: { color: colors.route, weight: ROUTE_WEIGHT, opacity: 1 },
    baseline: { color: colors['muted-foreground'], weight: 3, opacity: 0.9, dashArray: '6 8' },
    stairsCasing: casing(STAIRS_WEIGHT),
    stairs: { color: colors.stairs, weight: STAIRS_WEIGHT, opacity: 1 },
  }
}
