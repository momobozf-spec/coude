export const categories = [
  {
    id: 'ramadan',
    name: 'Ramadan',
    nameAr: 'رمضان',
    slug: 'ramadan-cadeaus',
    icon: '🌙',
    description:
      'Cadeauboxen voor de heilige maand Ramadan, met dadels, geurbeleving en rituele rustmomenten.',
  },
  {
    id: 'eid',
    name: 'Eid',
    nameAr: 'عيد',
    slug: 'eid-cadeaus',
    icon: '🎉',
    description:
      'Feestelijke Eid geschenken met premium details om de vreugde van de dag te delen.',
  },
  {
    id: 'geboorte',
    name: 'Geboorte & Aqiqah',
    nameAr: 'عقيقة',
    slug: 'geboorte-aqiqah',
    icon: '👶',
    description:
      'Liefdevolle geboorteboxen voor nieuwe zegeningen, samengesteld met zachtheid en betekenis.',
  },
  {
    id: 'huwelijk',
    name: 'Nikah & Huwelijk',
    nameAr: 'نكاح',
    slug: 'nikah-huwelijk',
    icon: '💍',
    description:
      'Elegante huwelijksgeschenken die spiritualiteit, design en romantiek samenbrengen.',
  },
  {
    id: 'zelfzorg',
    name: 'Zelfzorg',
    nameAr: 'سكينة',
    slug: 'zelfzorg',
    icon: '🧖',
    description:
      'Rustgevende self-care boxen voor reflectie, zachtheid en barakah in je dagelijkse ritme.',
  },
  {
    id: 'decor',
    name: 'Huis & Decor',
    nameAr: 'ديكور',
    slug: 'huis-decor',
    icon: '🏠',
    description:
      'Sfeervolle woonaccenten en islamitische decorstukken voor een warm en gastvrij thuis.',
  },
  {
    id: 'addons',
    name: 'Add-ons',
    nameAr: 'إضافات',
    slug: 'add-ons',
    icon: '✨',
    description:
      'Los verkrijgbare extra’s om een box te verrijken of als betekenisvol klein cadeau te geven.',
  },
]

export const getCategoryBySlug = (slug) =>
  categories.find((category) => category.slug === slug)

export const getCategoryById = (id) =>
  categories.find((category) => category.id === id)
