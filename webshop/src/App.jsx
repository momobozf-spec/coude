import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import Header from './components/Header'
import Footer from './components/Footer'
import CartDrawer from './components/CartDrawer'
import WhatsAppButton from './components/WhatsAppButton'
import NewsletterPopup from './components/NewsletterPopup'
import MobileNav from './components/MobileNav'
import HomePage from './pages/HomePage'
import ShopPage from './pages/ShopPage'
import ProductPage from './pages/ProductPage'
import CollectionPage from './pages/CollectionPage'
import CommunityPage from './pages/CommunityPage'
import AboutPage from './pages/AboutPage'
import FAQPage from './pages/FAQPage'
import ContactPage from './pages/ContactPage'
import { useLanguageStore } from './store/languageStore'
import { translations } from './i18n'

// Scroll to top on route change
function ScrollToTop() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [location.pathname])

  return null
}

function AppLayout() {
  const language = useLanguageStore((state) => state.language)

  useEffect(() => {
    const languageMeta = translations[language]?.meta
    document.documentElement.lang = languageMeta?.code || 'nl'
    document.documentElement.dir = languageMeta?.dir || 'ltr'
  }, [language])

  return (
    <div className="min-h-screen flex flex-col bg-cream">
      <Header />
      <main className="flex-1 pb-16 md:pb-0">
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/shop" element={<ShopPage />} />
          <Route path="/products/:slug" element={<ProductPage />} />
          <Route path="/collections/:slug" element={<CollectionPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/over-ons" element={<AboutPage />} />
          <Route path="/faq" element={<FAQPage />} />
          <Route path="/contact" element={<ContactPage />} />
        </Routes>
      </main>
      <Footer />
      <CartDrawer />
      <WhatsAppButton />
      <NewsletterPopup />
      <MobileNav />
    </div>
  )
}

function App() {
  return (
    <Router>
      <AppLayout />
    </Router>
  )
}

export default App
