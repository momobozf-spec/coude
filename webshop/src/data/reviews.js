export const reviews = [
  {
    id: 1,
    name: 'Fatima B.',
    rating: 5,
    text: 'Prachtige Ramadan box ontvangen. De presentatie voelt echt premium en de dadels waren heerlijk.',
    product: 'ramadan-kareem-box',
    verified: true,
    date: '2026-02-15',
  },
  {
    id: 2,
    name: 'Youssef A.',
    rating: 4,
    text: 'Mooie samenstelling en snelle levering. Vooral het gebedskleed voelde heel luxe aan.',
    product: 'ramadan-kareem-box',
    verified: true,
    date: '2026-02-20',
  },
  {
    id: 3,
    name: 'Amina K.',
    rating: 5,
    text: 'De Eid Mubarak Box was het perfecte cadeau voor mijn zus. Alles voelde feestelijk en verzorgd aan.',
    product: 'eid-mubarak-box',
    verified: true,
    date: '2026-01-28',
  },
  {
    id: 4,
    name: 'Ibrahim M.',
    rating: 5,
    text: 'Besteld als huwelijkscadeau en het was een groot succes. Echt een premium unboxing-ervaring.',
    product: 'nikah-love-box',
    verified: true,
    date: '2026-03-02',
  },
  {
    id: 5,
    name: 'Nour S.',
    rating: 4,
    text: 'Een hele fijne self-care box. De rozenwaterspray en het journal maken het echt bijzonder.',
    product: 'sakina-self-care-box',
    verified: true,
    date: '2026-02-10',
  },
  {
    id: 6,
    name: 'Khadija V.',
    rating: 5,
    text: 'Voor de geboorte van mijn neefje besteld en iedereen was geraakt door hoe mooi alles verpakt was.',
    product: 'new-baby-barakah-box',
    verified: true,
    date: '2026-03-10',
  },
  {
    id: 7,
    name: 'Mohammed R.',
    rating: 5,
    text: 'De deluxe variant van de Ramadan box voelt echt als een cadeau met impact. Zeker een aanrader.',
    product: 'ramadan-kareem-box',
    verified: false,
    date: '2026-01-15',
  },
  {
    id: 8,
    name: 'Sara E.',
    rating: 5,
    text: 'Al twee keer besteld en beide keren top. De persoonlijke touch maakt het echt af.',
    product: 'eid-mubarak-box',
    verified: true,
    date: '2026-03-18',
  },
]

export const getReviewsByProduct = (productId) =>
  reviews.filter((review) => review.product === productId)

export const getAverageRating = (productId) => {
  const productReviews = getReviewsByProduct(productId)
  if (productReviews.length === 0) return 0

  const sum = productReviews.reduce((accumulator, review) => {
    return accumulator + review.rating
  }, 0)

  return (sum / productReviews.length).toFixed(1)
}
