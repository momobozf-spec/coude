import { NavLink } from 'react-router-dom'
import { useCartStore } from '../store/cartStore'
import { useUiStore } from '../store/uiStore'
import { useLanguageStore } from '../store/languageStore'

export default function MobileNav() {
  const itemCount = useCartStore((s) => s.getItemCount())
  const openCart = useUiStore((s) => s.openCart)
  const { t } = useLanguageStore()

  const linkClass = ({ isActive }) =>
    `relative flex flex-col items-center gap-0.5 text-[10px] font-medium transition-all duration-300 ${
      isActive ? 'text-gold' : 'text-brown/50'
    }`

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-sand bg-cream/95 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-around py-2">
        <NavLink to="/" className={linkClass}>
          {({ isActive }) => (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2 : 1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
              <span>{t('nav.home')}</span>
              {isActive && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-gold" />
              )}
            </>
          )}
        </NavLink>

        <NavLink to="/shop" className={linkClass}>
          {({ isActive }) => (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2 : 1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
              <span>{t('nav.shop')}</span>
              {isActive && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-gold" />
              )}
            </>
          )}
        </NavLink>

        <button
          onClick={openCart}
          className="relative flex flex-col items-center gap-0.5 text-[10px] font-medium text-brown/50 hover:text-gold transition-all duration-300"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
          </svg>
          {itemCount > 0 && (
            <span className="absolute -top-1 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-br from-gold to-gold/80 text-[9px] font-bold text-cream shadow-sm">
              {itemCount}
            </span>
          )}
          <span>{t('nav.cart')}</span>
        </button>

        <NavLink to="/community" className={linkClass}>
          {({ isActive }) => (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2 : 1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              <span>{t('nav.community')}</span>
              {isActive && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-gold" />
              )}
            </>
          )}
        </NavLink>

        <NavLink to="/contact" className={linkClass}>
          {({ isActive }) => (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={isActive ? 2 : 1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 8.625v8.25A2.625 2.625 0 0119.125 19.5H4.875A2.625 2.625 0 012.25 16.875v-8.25m19.5 0A2.625 2.625 0 0019.125 6H4.875A2.625 2.625 0 002.25 8.625m19.5 0l-8.69 5.519a2.25 2.25 0 01-2.12 0L2.25 8.625" />
              </svg>
              <span>{t('nav.contact')}</span>
              {isActive && (
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-[2px] w-6 rounded-full bg-gold" />
              )}
            </>
          )}
        </NavLink>
      </div>
    </nav>
  )
}
