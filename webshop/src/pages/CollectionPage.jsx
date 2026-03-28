import { useParams, Link } from 'react-router-dom'
import { categories } from '../data/categories'
import { products } from '../data/products'
import { useLanguageStore } from '../store/languageStore'
import ProductCard from '../components/ProductCard'

export default function CollectionPage() {
  const { slug } = useParams()
  const { t } = useLanguageStore()

  const category = categories.find((c) => c.slug === slug)

  if (!category) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-sand flex items-center justify-center">
          <span className="text-3xl">?</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-brown mb-2">
          {t('collectionExtra.notFound')}
        </h1>
        <p className="text-brown/60 mb-6">
          {t('collectionExtra.notFoundDesc')}
        </p>
        <Link
          to="/shop"
          className="gold-gradient text-dark px-8 py-3 rounded-full font-semibold hover:shadow-lg hover:shadow-gold/25 transition-all duration-300 inline-block"
        >
          {t('common.backToShop')}
        </Link>
      </div>
    )
  }

  const categoryProducts = products.filter(
    (p) => p.category === category.id
  )

  const categoryName = t(`categories.${category.id}`) !== `categories.${category.id}`
    ? t(`categories.${category.id}`)
    : category.name

  const categoryDesc = t(`categoryDescriptions.${category.id}`) !== `categoryDescriptions.${category.id}`
    ? t(`categoryDescriptions.${category.id}`)
    : category.description

  return (
    <div className="min-h-screen">
      {/* Category hero header with gradient overlay */}
      <section className="relative bg-sand overflow-hidden">
        <div className="absolute inset-0 pattern-bg opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-sand/90" />
        <div className="max-w-3xl mx-auto px-4 py-20 md:py-28 text-center relative z-10">
          <span className="text-6xl block mb-5 animate-fade-in">{category.icon}</span>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-brown mb-3">
            {categoryName}
          </h1>
          <p className="arabic text-gold text-xl mb-5">{category.nameAr}</p>
          <p className="text-brown/60 text-lg max-w-xl mx-auto">
            {categoryDesc}
          </p>
        </div>
      </section>

      {/* Breadcrumb */}
      <div className="max-w-6xl mx-auto px-4 pt-8">
        <nav className="flex items-center gap-2 text-sm text-brown/50">
          <Link to="/" className="hover:text-gold transition-colors">{t('nav.home')}</Link>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brown/30">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <Link to="/shop" className="hover:text-gold transition-colors">{t('nav.shop')}</Link>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-brown/30">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-brown/80 font-medium">{categoryName}</span>
        </nav>
      </div>

      {/* Products */}
      <section className="max-w-6xl mx-auto px-4 py-8 pb-16">
        {categoryProducts.length > 0 ? (
          <>
            {/* Product count */}
            <p className="text-brown/50 text-sm mb-6 font-medium">
              {t('collectionExtra.productCount', { count: categoryProducts.length })}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {categoryProducts.map((product, i) => (
                <div
                  key={product.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gold/10 flex items-center justify-center">
              <span className="text-3xl">🔜</span>
            </div>
            <h2 className="font-heading text-2xl font-bold text-brown mb-3">
              {t('collectionExtra.emptyTitle')}
            </h2>
            <p className="text-brown/60 max-w-md mx-auto">
              {t('collectionExtra.emptyDesc')}
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
