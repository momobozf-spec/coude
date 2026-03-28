import {
  useCartStore,
  FREE_SHIPPING_THRESHOLD,
  CART_UPSELL_PRICE,
} from '../store/cartStore'
import { useUiStore } from '../store/uiStore'
import { useLanguageStore } from '../store/languageStore'

export default function CartDrawer() {
  const { items, cartExtras, removeItem, updateQuantity, toggleCartExtra } =
    useCartStore()
  const subtotal = useCartStore((s) => s.getSubtotal())
  const extrasTotal = useCartStore((s) => s.getExtrasTotal())
  const total = useCartStore((s) => s.getTotal())
  const itemCount = useCartStore((s) => s.getItemCount())
  const { isCartOpen, closeCart } = useUiStore()
  const { t } = useLanguageStore()

  if (!isCartOpen) return null

  const remaining = FREE_SHIPPING_THRESHOLD - subtotal
  const freeShipping = remaining <= 0
  const progressPercent = Math.min(
    (subtotal / FREE_SHIPPING_THRESHOLD) * 100,
    100
  )
  const shippingCost = freeShipping ? 0 : 4.95

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-dark/40 backdrop-blur-sm transition-opacity duration-300"
        onClick={closeCart}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-cream shadow-2xl shadow-dark/20 animate-slide-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sand px-6 py-4">
          <h2 className="font-heading text-xl font-semibold text-brown">
            {t('cart.title')}{' '}
            <span className="text-sm font-body font-normal text-brown/50">
              ({itemCount} {itemCount === 1 ? t('cart.item') : t('cart.items')})
            </span>
          </h2>
          <button
            onClick={closeCart}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-brown/50 hover:bg-sand hover:text-brown transition-all duration-200"
            aria-label={t('cart.close')}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-5 p-6 text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-sand/60">
                <svg className="h-10 w-10 text-brown/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                </svg>
              </div>
              <p className="text-brown/50 font-medium text-lg font-heading">
                {t('cart.empty')}
              </p>
              <button
                onClick={closeCart}
                className="rounded-xl bg-olive px-8 py-2.5 text-sm font-semibold text-white hover:bg-olive/90 transition-all duration-300 shadow-sm"
              >
                {t('cart.goShopping')}
              </button>
            </div>
          ) : (
            <div className="p-6 space-y-4">
              {/* Free shipping progress */}
              <div className="rounded-xl bg-sand/60 p-4">
                {freeShipping ? (
                  <p className="text-sm font-semibold text-olive text-center flex items-center justify-center gap-2">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {t('cart.freeShippingDone')}
                  </p>
                ) : (
                  <>
                    <p className="text-sm text-brown/70 text-center mb-2.5">
                      {t('cart.freeShippingProgress', {
                        amount: remaining.toFixed(2).replace('.', ','),
                      })}
                    </p>
                    <div className="h-2.5 w-full rounded-full bg-cream overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-gold/70 via-gold to-gold/80 transition-all duration-700 ease-out"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Items */}
              {items.map((item) => (
                <div
                  key={`${item.id}-${item.tier}`}
                  className="flex gap-4 rounded-xl bg-white p-4 shadow-sm border border-sand/40 hover:shadow-md transition-shadow duration-300"
                >
                  {/* Image placeholder */}
                  <div className="flex h-18 w-18 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sand/80 to-sand text-3xl">
                    {item.image || '\uD83D\uDCE6'}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brown truncate">
                      {item.name}
                    </p>
                    {item.tierName && (
                      <p className="text-xs text-brown/40 mt-0.5">{item.tierName}</p>
                    )}
                    <p className="text-sm font-bold text-gold mt-1">
                      {'\u20AC'}{item.price.toFixed(2).replace('.', ',')}
                    </p>

                    {/* Quantity controls */}
                    <div className="mt-2 flex items-center gap-1">
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.tier, item.quantity - 1)
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-sand/80 text-sm text-brown hover:bg-gold hover:text-cream transition-all duration-200"
                      >
                        {'\u2212'}
                      </button>
                      <span className="text-sm font-semibold text-brown w-8 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          updateQuantity(item.id, item.tier, item.quantity + 1)
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-sand/80 text-sm text-brown hover:bg-gold hover:text-cream transition-all duration-200"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(item.id, item.tier)}
                    className="self-start flex h-7 w-7 items-center justify-center rounded-lg text-brown/30 hover:bg-red-50 hover:text-red-500 transition-all duration-200"
                    aria-label={t('cart.remove')}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}

              {/* Upsell */}
              <div className="rounded-xl bg-sand/30 border border-sand/60 p-4 space-y-3">
                <p className="text-xs font-semibold text-brown/50 uppercase tracking-widest">
                  {t('cart.extras')}
                </p>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={cartExtras.giftWrapping}
                    onChange={() => toggleCartExtra('giftWrapping')}
                    className="h-4 w-4 rounded border-sand text-gold accent-gold"
                  />
                  <span className="text-sm text-brown group-hover:text-gold transition-colors">
                    {t('cart.giftWrapping')}{' '}
                    <span className="text-brown/40">
                      (+{'\u20AC'}
                      {CART_UPSELL_PRICE.toFixed(2).replace('.', ',')})
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={cartExtras.handwrittenCard}
                    onChange={() => toggleCartExtra('handwrittenCard')}
                    className="h-4 w-4 rounded border-sand text-gold accent-gold"
                  />
                  <span className="text-sm text-brown group-hover:text-gold transition-colors">
                    {t('cart.handwrittenCard')}{' '}
                    <span className="text-brown/40">
                      (+{'\u20AC'}
                      {CART_UPSELL_PRICE.toFixed(2).replace('.', ',')})
                    </span>
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer - totals */}
        {items.length > 0 && (
          <div className="border-t border-sand p-6 space-y-3 bg-white/50">
            <div className="flex justify-between text-sm text-brown/60">
              <span>{t('cart.subtotal')}</span>
              <span>{'\u20AC'}{subtotal.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-sm text-brown/60">
              <span>{t('cart.extras')}</span>
              <span>{'\u20AC'}{extrasTotal.toFixed(2).replace('.', ',')}</span>
            </div>
            <div className="flex justify-between text-sm text-brown/60">
              <span>{t('cart.shipping')}</span>
              <span>
                {freeShipping ? (
                  <span className="text-olive font-semibold">{t('cart.free')}</span>
                ) : (
                  `\u20AC${shippingCost.toFixed(2).replace('.', ',')}`
                )}
              </span>
            </div>
            <div className="flex justify-between text-lg font-bold text-brown border-t border-sand pt-3">
              <span>{t('cart.total')}</span>
              <span className="text-gold">
                {'\u20AC'}{(total + shippingCost).toFixed(2).replace('.', ',')}
              </span>
            </div>

            <button className="w-full rounded-xl bg-gradient-to-r from-gold via-gold to-gold/90 py-3.5 text-sm font-bold text-dark hover:from-gold/90 hover:to-gold transition-all duration-300 shadow-md shadow-gold/20 hover:shadow-lg hover:shadow-gold/30 active:scale-[0.98]">
              {t('cart.checkout')}
            </button>

            {/* Payment icons */}
            <div className="flex items-center justify-center gap-3 pt-1">
              {['iDEAL', 'Bancontact', 'Visa', 'Mastercard', 'PayPal'].map((method) => (
                <span key={method} className="text-[10px] text-brown/30 font-medium">{method}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
