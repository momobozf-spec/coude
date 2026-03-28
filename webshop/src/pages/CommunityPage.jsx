import { useState } from 'react'
import { useLanguageStore } from '../store/languageStore'

const communityPosts = [
  {
    id: 1,
    user: 'Aisha M.',
    avatar: '👩‍🦱',
    date: '2 uur geleden',
    text: 'Net de Ramadan Kareem Box ontvangen en ik ben sprakeloos! De verpakking is zo mooi dat ik het bijna niet wil openmaken. De dadels zijn heerlijk en de bakhoor ruikt hemels. Perfecte cadeau voor mijn moeder!',
    likes: 24,
    comments: 6,
    verified: true,
    featured: true,
  },
  {
    id: 2,
    user: 'Omar K.',
    avatar: '👨',
    date: '5 uur geleden',
    text: 'De Nikah Gift Box was een groot succes op het huwelijksfeest. Mijn zus en haar man waren er heel blij mee. De kwaliteit van de Quran met vertaling is echt premium. Bedankt Jamal & Jamila!',
    likes: 18,
    comments: 3,
    verified: true,
    featured: true,
  },
  {
    id: 3,
    user: 'Safiya D.',
    avatar: '👩',
    date: '1 dag geleden',
    text: 'Ik heb de Sakina Selfcare Box voor mezelf besteld en wat een verwenmoment! De zwarte zaadolie is van topkwaliteit en de dhikr kaarten helpen me echt om even tot rust te komen.',
    likes: 31,
    comments: 8,
    verified: true,
    featured: false,
  },
  {
    id: 4,
    user: 'Bilal H.',
    avatar: '👨‍🦲',
    date: '2 dagen geleden',
    text: 'Al 3 keer besteld bij Jamal & Jamila en elke keer weer top. De Eid boxen zijn mijn go-to cadeau geworden voor familie. Mooie producten, snelle levering en prachtige verpakking.',
    likes: 42,
    comments: 11,
    verified: false,
    featured: false,
  },
  {
    id: 5,
    user: 'Mariam E.',
    avatar: '👩‍🦰',
    date: '3 dagen geleden',
    text: 'De Aqiqah Baby Box voor mijn nichtje was zo schattig! Het rompertje is super zacht en de mini Quran is echt bijzonder. Een doordacht cadeau met veel betekenis.',
    likes: 27,
    comments: 5,
    verified: true,
    featured: false,
  },
]

const topContributors = [
  { name: 'Aisha M.', avatar: '👩‍🦱', posts: 15 },
  { name: 'Bilal H.', avatar: '👨‍🦲', posts: 12 },
  { name: 'Safiya D.', avatar: '👩', posts: 9 },
  { name: 'Omar K.', avatar: '👨', posts: 7 },
]

const trendingTags = [
  '#RamadanKareem',
  '#EidCadeaus',
  '#JamalJamila',
  '#IslamitischCadeau',
  '#Babybox',
  '#NikahGift',
]

export default function CommunityPage() {
  const [likedPosts, setLikedPosts] = useState([])
  const { t } = useLanguageStore()

  const toggleLike = (postId) => {
    setLikedPosts((prev) =>
      prev.includes(postId)
        ? prev.filter((id) => id !== postId)
        : [...prev, postId]
    )
  }

  const featuredPosts = communityPosts.filter((p) => p.featured)

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="bg-sand py-20 text-center relative overflow-hidden">
        <div className="absolute inset-0 pattern-bg opacity-50" />
        <div className="max-w-3xl mx-auto px-4 relative z-10">
          <p className="text-gold font-medium text-sm uppercase tracking-widest mb-4">
            Community
          </p>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-brown mb-4">
            {t('community.title')}
          </h1>
          <p className="text-brown/70 text-lg">
            {t('community.subtitle')}
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-olive text-white py-6">
        <div className="max-w-4xl mx-auto px-4 flex justify-center gap-12 md:gap-20">
          {[
            { count: t('communityExtra.membersCount'), label: t('community.stats.members') },
            { count: t('communityExtra.postsCount'), label: t('community.stats.posts') },
            { count: t('communityExtra.ambassadorsCount'), label: t('community.stats.ambassadors') },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="font-heading text-3xl md:text-4xl font-bold">{stat.count}</p>
              <p className="text-white/70 text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Stories */}
      <section className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <p className="text-gold font-medium text-sm uppercase tracking-widest mb-2">
            Featured
          </p>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-brown mb-2">
            {t('communityExtra.featuredStories')}
          </h2>
          <p className="text-brown/60">
            {t('communityExtra.featuredSubtitle')}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {featuredPosts.map((post) => (
            <div
              key={post.id}
              className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group"
            >
              {/* Image placeholder */}
              <div className="bg-sand h-48 flex items-center justify-center relative">
                <span className="text-6xl opacity-30 group-hover:scale-110 transition-transform duration-500">📷</span>
                <div className="absolute inset-0 bg-gradient-to-t from-brown/20 to-transparent" />
                {post.verified && (
                  <span className="absolute top-4 right-4 bg-olive text-white text-xs px-3 py-1 rounded-full font-medium">
                    ✓ {t('common.verifiedPurchase')}
                  </span>
                )}
              </div>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-3xl">{post.avatar}</span>
                  <div>
                    <p className="font-semibold text-brown">{post.user}</p>
                    <p className="text-brown/40 text-xs">{post.date}</p>
                  </div>
                </div>
                <p className="text-brown/80 leading-relaxed line-clamp-3">
                  {post.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Feed (2/3) — masonry-style */}
          <div className="lg:col-span-2 columns-1 md:columns-2 gap-6 space-y-6">
            {communityPosts.map((post) => {
              const liked = likedPosts.includes(post.id)
              return (
                <article
                  key={post.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 break-inside-avoid"
                >
                  {/* Header */}
                  <div className="p-6 pb-0">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-sand flex items-center justify-center text-2xl">
                        {post.avatar}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-brown">
                            {post.user}
                          </span>
                          {post.verified && (
                            <span className="text-olive text-xs bg-olive/10 px-2 py-0.5 rounded-full font-medium">
                              ✓ {t('common.verifiedPurchase')}
                            </span>
                          )}
                        </div>
                        <span className="text-brown/40 text-xs">{post.date}</span>
                      </div>
                    </div>

                    {/* Text */}
                    <p className="text-brown/80 leading-relaxed mb-4">
                      {post.text}
                    </p>
                  </div>

                  {/* Image placeholder */}
                  <div className="bg-sand mx-6 rounded-xl h-40 flex items-center justify-center mb-4">
                    <span className="text-5xl opacity-25">📷</span>
                  </div>

                  {/* Actions */}
                  <div className="px-6 pb-5 flex items-center gap-6 text-sm border-t border-sand/50 pt-4 mx-6">
                    <button
                      onClick={() => toggleLike(post.id)}
                      className={`flex items-center gap-1.5 cursor-pointer transition-all duration-300 ${
                        liked ? 'text-red-500 scale-105' : 'text-brown/50 hover:text-red-500'
                      }`}
                    >
                      {liked ? '❤️' : '🤍'}{' '}
                      {post.likes + (liked ? 1 : 0)}
                    </button>
                    <button className="flex items-center gap-1.5 text-brown/50 hover:text-brown cursor-pointer transition-colors">
                      💬 {post.comments}
                    </button>
                    <button className="flex items-center gap-1.5 text-brown/50 hover:text-brown cursor-pointer transition-colors">
                      🔗 {t('community.share')}
                    </button>
                  </div>
                </article>
              )
            })}

            {/* CTA */}
            <div className="text-center py-10 break-inside-avoid">
              <button
                onClick={() => alert(t('communityExtra.postSoon'))}
                className="gold-gradient text-dark px-10 py-4 rounded-full font-semibold hover:shadow-lg hover:shadow-gold/25 transition-all duration-300 cursor-pointer"
              >
                {t('community.createPost')}
              </button>
            </div>
          </div>

          {/* Sidebar (1/3) */}
          <aside className="space-y-6">
            {/* Top contributors */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-heading text-lg font-bold text-brown mb-5 flex items-center gap-2">
                <span className="text-gold">🏆</span>
                {t('community.topContributors')}
              </h3>
              <ul className="space-y-4">
                {topContributors.map((c, i) => (
                  <li key={i} className="flex items-center gap-3 group">
                    <div className="w-10 h-10 rounded-full bg-sand flex items-center justify-center text-xl group-hover:scale-110 transition-transform duration-300">
                      {c.avatar}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-brown text-sm">
                        {c.name}
                      </p>
                      <p className="text-brown/40 text-xs">
                        {c.posts} {t('communityExtra.postsLabel')}
                      </p>
                    </div>
                    <span className="font-heading text-lg font-bold text-gold/60">
                      #{i + 1}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Trending tags */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h3 className="font-heading text-lg font-bold text-brown mb-5 flex items-center gap-2">
                <span className="text-gold">#</span>
                {t('community.trending')}
              </h3>
              <div className="flex flex-wrap gap-2">
                {trendingTags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-sand text-brown/70 text-sm px-4 py-2 rounded-full hover:bg-gold/10 hover:text-gold transition-all duration-300 cursor-pointer"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
