import { useState, useEffect, useRef } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { useWishlistStore } from '../store/wishlistStore'
import { useUiStore } from '../store/uiStore'
import { useLanguageStore, FLAGS, LABELS } from '../store/languageStore'

const collections = [
  { key: 'ramadan', slug: 'ramadan-cadeaus' },
  { key: 'eid', slug: 'eid-cadeaus' },
  { key: 'geboorte', slug: 'geboorte-aqiqah' },
  { key: 'huwelijk', slug: 'nikah-huwelijk' },
  { key: 'zelfzorg', slug: 'zelfzorg' },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [collectionsOpen, setCollectionsOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [langOpen, setLangOpen] = useState(false)
  const langRef = useRef(null)

  const { t, language, setLanguage } = useLanguageStore()
  const itemCount = useCartStore((s) => s.getItemCount())
  const wishlistCount = useWishlistStore((s) => s.items.length)
  const { openCart, isMenuOpen, openMenu, closeMenu, searchQuery, setSearchQuery } = useUiStore()

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close language dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (langRef.current && !langRef.current.contains(e.target)) {
        setLangOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const navLinkClass = ({ isActive }) =>
    `relative text-sm font-medium tracking-wide transition-all duration-300 hover:text-gold after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:bg-gold after:transition-all after:duration-300 ${
      isActive
        ? 'text-gold after:w-full'
        : 'text-brown after:w-0 hover:after:w-full'
    }`

  const languages = ['nl', 'fr', 'de', 'en']

  return (
    <header className="sticky top-0 z-40">
      {/* Top bar */}
      <div className="bg-gradient-to-r from-gold/90 via-gold to-gold/90 text-dark">
        <div className="mx-auto flex max-w-7xl items-center justify-center gap-4 px-4 py-1.5 text-xs font-medium tracking-wide md:gap-6">
          <span>{t('topBar.freeShipping')}</span>
          <span className="hidden sm:inline text-dark/40">|</span>
          <span className="hidden sm:inline">{'\u2713'} {t('topBar.halal')}</span>
        </div>
      </div>

      {/* Main header */}
      <div
        className={`bg-cream/95 backdrop-blur-md transition-shadow duration-300 ${
          scrolled ? 'shadow-lg shadow-brown/5' : ''
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:px-6">
          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-brown hover:text-gold transition-colors duration-300"
            onClick={isMenuOpen ? closeMenu : openMenu}
            aria-label="Menu"
          >
            {isMenuOpen ? (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-gold via-gold/90 to-gold/70 text-cream font-arabic text-xl font-bold shadow-md shadow-gold/20 ring-2 ring-gold/20 group-hover:shadow-lg group-hover:shadow-gold/30 transition-all duration-300">
              {'\u062C'}
            </div>
            <span className="hidden sm:block font-heading text-xl font-semibold text-brown group-hover:text-gold transition-colors duration-300">
              Jamal &amp; Jamila
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-7">
            <NavLink to="/" className={navLinkClass}>
              {t('nav.home')}
            </NavLink>
            <NavLink to="/shop" className={navLinkClass}>
              {t('nav.shop')}
            </NavLink>

            {/* Collections dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setCollectionsOpen(true)}
              onMouseLeave={() => setCollectionsOpen(false)}
            >
              <button
                className="relative text-sm font-medium tracking-wide transition-all duration-300 hover:text-gold text-brown flex items-center gap-1"
                onClick={() => setCollectionsOpen((o) => !o)}
              >
                {t('nav.collections')}
                <svg
                  className={`h-3.5 w-3.5 transition-transform duration-200 ${collectionsOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {collectionsOpen && (
                <div className="absolute top-full left-0 mt-2 w-52 rounded-xl bg-cream shadow-xl shadow-brown/10 border border-sand/80 py-2 animate-fade-in">
                  {collections.map((collection) => (
                    <Link
                      key={collection.key}
                      to={`/collections/${collection.slug}`}
                      className="block px-5 py-2.5 text-sm text-brown hover:bg-sand/60 hover:text-gold transition-all duration-200 hover:pl-6"
                      onClick={() => setCollectionsOpen(false)}
                    >
                      {t(`collections.${collection.key}`)}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <NavLink to="/community" className={navLinkClass}>
              {t('nav.community')}
            </NavLink>
            <NavLink to="/over-ons" className={navLinkClass}>
              {t('nav.about')}
            </NavLink>
          </nav>

          {/* Right icons */}
          <div className="flex items-center gap-2">
            {/* Language switcher (desktop) */}
            <div className="relative hidden md:block" ref={langRef}>
              <button
                onClick={() => setLangOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-lg border border-sand/80 px-2.5 py-1.5 text-sm text-brown hover:border-gold/50 hover:text-gold transition-all duration-300 bg-white/50"
              >
                <span>{FLAGS[language]}</span>
                <span className="text-xs font-medium">{LABELS[language]}</span>
                <svg
                  className={`h-3 w-3 transition-transform duration-200 ${langOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {langOpen && (
                <div className="absolute right-0 top-full mt-2 w-36 rounded-xl bg-cream shadow-xl shadow-brown/10 border border-sand/80 py-1.5 animate-fade-in">
                  {languages.map((lang) => (
                    <button
                      key={lang}
                      onClick={() => {
                        setLanguage(lang)
                        setLangOpen(false)
                      }}
                      className={`flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-all duration-200 hover:bg-sand/60 ${
                        language === lang ? 'text-gold font-medium bg-sand/30' : 'text-brown'
                      }`}
                    >
                      <span>{FLAGS[lang]}</span>
                      <span>{LABELS[lang]}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Search */}
            <button
              className="hidden md:flex items-center justify-center h-9 w-9 rounded-lg text-brown hover:text-gold hover:bg-sand/50 transition-all duration-300"
              onClick={() => setSearchOpen((o) => !o)}
              aria-label={t('nav.search')}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>

            {/* Wishlist */}
            <Link
              to="/shop"
              className="hidden md:flex relative items-center justify-center h-9 w-9 rounded-lg text-brown hover:text-gold hover:bg-sand/50 transition-all duration-300"
              aria-label={t('nav.wishlist')}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              {wishlistCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold/80 text-[10px] font-bold text-cream shadow-sm">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Cart */}
            <button
              className="relative flex items-center justify-center h-9 w-9 rounded-lg text-brown hover:text-gold hover:bg-sand/50 transition-all duration-300"
              onClick={openCart}
              aria-label={t('nav.cart')}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              {itemCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold/80 text-[10px] font-bold text-cream shadow-sm">
                  {itemCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Desktop search bar */}
        {searchOpen && (
          <div className="hidden md:block border-t border-sand/60 animate-fade-in">
            <div className="mx-auto max-w-7xl px-6 py-3">
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brown/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('nav.searchPlaceholder')}
                  className="w-full rounded-xl border border-sand bg-white pl-10 pr-4 py-2.5 text-sm text-brown placeholder:text-brown/40 focus:border-gold focus:outline-none focus:ring-2 focus:ring-gold/10 transition-all duration-300"
                  autoFocus
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile menu overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 top-[104px] z-50 bg-cream animate-fade-in md:hidden overflow-y-auto">
          <div className="flex flex-col p-6 gap-1">
            {/* Mobile search */}
            <div className="relative mb-5">
              <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-brown/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('nav.searchPlaceholder')}
                className="w-full rounded-xl border border-sand bg-white pl-10 pr-4 py-3 text-sm text-brown placeholder:text-brown/40 focus:border-gold focus:outline-none"
              />
            </div>

            <NavLink to="/" className={navLinkClass} onClick={closeMenu}>
              <span className="text-lg font-heading">{t('nav.home')}</span>
            </NavLink>
            <NavLink to="/shop" className={navLinkClass} onClick={closeMenu}>
              <span className="text-lg font-heading">{t('nav.shop')}</span>
            </NavLink>

            <div className="py-2">
              <p className="text-xs font-medium text-brown/50 uppercase tracking-widest mb-2">
                {t('nav.collections')}
              </p>
              {collections.map((collection) => (
                <Link
                  key={collection.key}
                  to={`/collections/${collection.slug}`}
                  className="block py-2.5 pl-4 text-sm text-brown hover:text-gold transition-colors border-l-2 border-sand hover:border-gold"
                  onClick={closeMenu}
                >
                  {t(`collections.${collection.key}`)}
                </Link>
              ))}
            </div>

            <NavLink to="/community" className={navLinkClass} onClick={closeMenu}>
              <span className="text-lg font-heading">{t('nav.community')}</span>
            </NavLink>
            <NavLink to="/over-ons" className={navLinkClass} onClick={closeMenu}>
              <span className="text-lg font-heading">{t('nav.about')}</span>
            </NavLink>

            {/* Wishlist link on mobile */}
            <Link
              to="/shop"
              className="mt-4 flex items-center gap-2.5 text-brown hover:text-gold transition-colors"
              onClick={closeMenu}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
              {t('nav.wishlist')}
              {wishlistCount > 0 && (
                <span className="rounded-full bg-gold text-cream text-xs px-2 py-0.5 font-medium">
                  {wishlistCount}
                </span>
              )}
            </Link>

            {/* Mobile language selector */}
            <div className="mt-6 pt-5 border-t border-sand">
              <p className="text-xs font-medium text-brown/50 uppercase tracking-widest mb-3">
                {t('footer.language')}
              </p>
              <div className="flex gap-2">
                {languages.map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-all duration-200 ${
                      language === lang
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-sand text-brown hover:border-gold/50'
                    }`}
                  >
                    <span>{FLAGS[lang]}</span>
                    <span>{LABELS[lang]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
