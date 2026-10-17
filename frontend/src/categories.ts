import type { Category } from './api'

interface CategoryStyle {
  label: string
  color: string
}

/** Polish labels and chip colours for the backend's fixed category list. */
export const CATEGORIES: Record<Category, CategoryStyle> = {
  bakery: { label: 'Pieczywo', color: '#d39b3a' },
  dairy: { label: 'Nabiał', color: '#5aa9e6' },
  meat: { label: 'Mięso', color: '#d1584f' },
  fruits_vegetables: { label: 'Owoce i warzywa', color: '#58a55c' },
  drinks: { label: 'Napoje', color: '#2fb0bf' },
  sweets_snacks: { label: 'Słodycze i przekąski', color: '#e07aa8' },
  alcohol: { label: 'Alkohol', color: '#8f6bd1' },
  household_chemicals: { label: 'Chemia domowa', color: '#5b6ee1' },
  cosmetics: { label: 'Kosmetyki', color: '#e58b5b' },
  clothing: { label: 'Ubrania', color: '#6f8a9c' },
  home: { label: 'Dom', color: '#a47551' },
  other: { label: 'Inne', color: '#9aa3a0' },
}
