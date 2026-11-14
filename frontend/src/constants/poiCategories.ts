import {
  Armchair,
  Coffee,
  Droplet,
  FerrisWheel,
  Landmark,
  MapPin,
  PawPrint,
  ShoppingBasket,
  Toilet,
  ToyBrick,
  Trees,
  Umbrella,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

// Categories from backend/planning/pois.py (CATEGORY_BY_TAG and TRIP_CATEGORY_BY_TAG), in display order.
export const POI_CATEGORIES = [
  'playground',
  'indoor_play',
  'toilets',
  'cafe',
  'restaurant',
  'water',
  'bench',
  'park',
  'zoo',
  'museum',
  'beach',
  'shop',
] as const

const ICONS: Record<string, LucideIcon> = {
  playground: FerrisWheel,
  indoor_play: ToyBrick,
  toilets: Toilet,
  cafe: Coffee,
  restaurant: Utensils,
  water: Droplet,
  bench: Armchair,
  park: Trees,
  zoo: PawPrint,
  museum: Landmark,
  beach: Umbrella,
  shop: ShoppingBasket,
}

export function categoryIcon(category: string): LucideIcon {
  return ICONS[category] ?? MapPin
}

// Five colour groups instead of eleven colours, so the map stays calm (DESIGN.md section 2).
// Values are CSS variable names. Tailwind cannot see class names built at runtime, so
// components use `style={{ color: categoryColor(category) }}`, and so does the map HTML.
const COLOR_GROUPS: Record<string, string> = {
  playground: 'cat-play',
  indoor_play: 'cat-play',
  zoo: 'cat-play',
  beach: 'cat-play',
  cafe: 'cat-food',
  restaurant: 'cat-food',
  shop: 'cat-food',
  toilets: 'cat-care',
  water: 'cat-care',
  park: 'sage-500',
  bench: 'sage-500',
}

/** A CSS colour for the category icon; museum and unknown categories are muted. */
export function categoryColor(category: string): string {
  return `var(--${COLOR_GROUPS[category] ?? 'muted-foreground'})`
}

/** Known categories first, in a fixed order; unknown ones at the end. */
export function categoryOrder(category: string): number {
  const index = (POI_CATEGORIES as readonly string[]).indexOf(category)
  return index === -1 ? POI_CATEGORIES.length : index
}
