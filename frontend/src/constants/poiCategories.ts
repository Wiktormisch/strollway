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
  Trees,
  Umbrella,
  Utensils,
  type LucideIcon,
} from 'lucide-react'

// Categories from backend/planning/pois.py (CATEGORY_BY_TAG and TRIP_CATEGORY_BY_TAG), in display order.
export const POI_CATEGORIES = [
  'playground',
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

/** Known categories first, in a fixed order; unknown ones at the end. */
export function categoryOrder(category: string): number {
  const index = (POI_CATEGORIES as readonly string[]).indexOf(category)
  return index === -1 ? POI_CATEGORIES.length : index
}
