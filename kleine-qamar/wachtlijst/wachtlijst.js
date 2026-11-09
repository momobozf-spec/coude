(() => {
  /**
   * Where sign-ups go: the Brevo form "Kleine Qamar wachtlijst" (double opt-in,
   * list "Kleine Qamar wachtlijst"). Field names are Brevo's own: EMAIL, the
   * empty honeypot email_address_check, locale and html_type.
   */
  const CONFIG = window.QAMAR_CONFIG
  const FORM_ENDPOINT = CONFIG.FORM_ENDPOINT
  const LEGAL = CONFIG.legal
  /** Brevo only knows a few interface languages for its own messages; Arabic falls back to English. */
  const BREVO_LOCALE = { nl: 'nl', fr: 'fr', ar: 'en' }

  const T = {
    nl: {
      name: 'Kleine Qamar',
      heroTitle: 'Islamitische verhalen, kleurplaten en spelletjes voor <em>jonge kinderen</em>',
      heroLead: 'Op tablet en telefoon, in het Nederlands, Frans en Arabisch. Zonder reclame, zonder chat, met waarden die je thuis ook meegeeft.',
      heroCta: 'Zet me op de wachtlijst',
      ages: 'Voor kinderen van 3 tot 8 jaar · start vóór Ramadan 2027',
      phoneText: 'Yasmine heeft een schaaltje dadels. Voor ze eet, zegt ze zacht: <b>Bismillah</b>.',
      phoneRead: 'Lees voor',
      insideEyebrow: 'Wat zit erin',
      insideTitle: 'Elke dag iets kleins over geloof, delen en dankbaarheid',
      f1t: 'Verhalen met voorlezen', f1p: 'Korte verhalen over sadaqa, Bismillah zeggen, dankbaar zijn en goed zijn voor je buren. Je kind kan ze zelf laten voorlezen.',
      f2t: 'Kleurplaten', f2p: 'Lantaarns, moskeeën, de halve maan en Ramadan-tafels. Vlakken vullen met één tik of vrij tekenen met de vinger.',
      f3t: 'Spelletjes', f3p: 'Memory met dingen uit het dagelijkse leven van moslims, en de Arabische letters leren herkennen en horen.',
      safeEyebrow: 'Voor ouders',
      safeTitle: 'Rustig, veilig en zorgvuldig gemaakt',
      promise: [
        ['Geen reclame en geen chat', 'Je kind ziet alleen verhalen, kleurplaten en spelletjes.'],
        ['Niets te koop voor kinderen', 'Alleen jij als ouder beheert het abonnement, achter een oudercontrole.'],
        ['Geen gegevens over je kind', 'We vragen niet naar de naam, de leeftijd of een foto van je kind.'],
        ['Nagelezen vóór publicatie', 'We laten elk verhaal en elke duʿa nakijken door een imam. Profeten worden nooit afgebeeld.'],
      ],
      signEyebrow: 'Wachtlijst',
      signTitle: 'Wees er als eerste bij',
      signIntro: 'Schrijf je in en je hoort als eerste wanneer Kleine Qamar start, met een aanbod voor de eerste gezinnen. Hoogstens een paar e-mails tot de lancering.',
      emailLabel: 'Je e-mailadres',
      consent: 'Ik wil e-mails ontvangen over de lancering van Kleine Qamar. Ik kan me altijd uitschrijven. Mijn adres wordt alleen hiervoor gebruikt door Marhaba Data & AI Agent BV, met Brevo als verwerker. Lees de <a href="privacy.html#nl" target="_blank" rel="noopener">privacyverklaring</a>.',
      privacyLink: 'Privacyverklaring',
      submit: 'Inschrijven',
      errEmail: 'Vul een geldig e-mailadres in, bijvoorbeeld naam@voorbeeld.be.',
      errConsent: 'Vink aan dat je e-mails wilt ontvangen.',
      ok: 'Bedankt! Je staat op de wachtlijst. Kijk in je mailbox om je inschrijving te bevestigen.',
      errSend: 'Inschrijven lukte niet. Probeer het straks opnieuw.',
      previewNote: 'Dit is een voorbeeld van de pagina: hier wordt nog niets verstuurd.',
      faqEyebrow: 'Vragen',
      faqTitle: 'Wat ouders ons vragen',
      faq: [
        ['Voor welke leeftijd is het?', 'Voor kinderen van ongeveer 3 tot 8 jaar. De verhalen zijn kort en de spelletjes werken zonder te kunnen lezen.'],
        ['Welke talen?', 'Nederlands, Frans en Arabisch. Je kiest de taal in de app en kunt altijd wisselen.'],
        ['Wat kost het?', 'Een deel is gratis, zodat je het eerst kunt proberen. Voor alle verhalen en spelletjes komt er een gezinsabonnement. De prijs maken we bekend bij de lancering.'],
        ['Werkt het op mijn toestel?', 'Ja, op elke recente tablet en telefoon, via de browser. Je hoeft niets te installeren.'],
      ],
      footerNote: 'Gemaakt in België',
    },
    fr: {
      name: 'Petit Qamar',
      heroTitle: 'Des histoires, coloriages et jeux islamiques pour les <em>jeunes enfants</em>',
      heroLead: 'Sur tablette et téléphone, en français, néerlandais et arabe. Sans publicité, sans chat, avec les valeurs que vous transmettez à la maison.',
      heroCta: 'Je m’inscris sur la liste d’attente',
      ages: 'Pour les enfants de 3 à 8 ans · lancement avant le Ramadan 2027',
      phoneText: 'Yasmine a un petit bol de dattes. Avant de manger, elle dit doucement : <b>Bismillah</b>.',
      phoneRead: 'Lire',
      insideEyebrow: 'Au programme',
      insideTitle: 'Chaque jour, un petit moment sur la foi, le partage et la gratitude',
      f1t: 'Histoires lues à voix haute', f1p: 'De courtes histoires sur la sadaqa, dire Bismillah, être reconnaissant et bon avec ses voisins. Votre enfant peut se les faire lire.',
      f2t: 'Coloriages', f2p: 'Lanternes, mosquées, croissant de lune et tables du Ramadan. On remplit les zones d’un toucher ou on dessine du bout du doigt.',
      f3t: 'Jeux', f3p: 'Un memory avec des objets de la vie quotidienne des musulmans, et les lettres arabes à reconnaître et à écouter.',
      safeEyebrow: 'Pour les parents',
      safeTitle: 'Calme, sûr et fait avec soin',
      promise: [
        ['Pas de publicité, pas de chat', 'Votre enfant ne voit que des histoires, des coloriages et des jeux.'],
        ['Rien à acheter pour les enfants', 'Seul le parent gère l’abonnement, derrière un contrôle parental.'],
        ['Aucune donnée sur votre enfant', 'Nous ne demandons ni le prénom, ni l’âge, ni la photo de votre enfant.'],
        ['Relu avant publication', 'Chaque histoire et chaque duʿa sont relues par un imam. Les prophètes ne sont jamais représentés.'],
      ],
      signEyebrow: 'Liste d’attente',
      signTitle: 'Soyez parmi les premiers',
      signIntro: 'Inscrivez-vous et vous serez les premiers informés du lancement de Petit Qamar, avec une offre pour les premières familles. Quelques e-mails au plus d’ici le lancement.',
      emailLabel: 'Votre adresse e-mail',
      consent: 'J’accepte de recevoir des e-mails sur le lancement de Petit Qamar. Je peux me désinscrire à tout moment. Mon adresse est utilisée uniquement à cette fin par Marhaba Data & AI Agent BV, avec Brevo comme sous-traitant. Lire la <a href="privacy.html#fr" target="_blank" rel="noopener">politique de confidentialité</a>.',
      privacyLink: 'Politique de confidentialité',
      submit: 'Je m’inscris',
      errEmail: 'Indiquez une adresse e-mail valide, par exemple nom@exemple.be.',
      errConsent: 'Cochez la case pour accepter de recevoir nos e-mails.',
      ok: 'Merci ! Vous êtes sur la liste d’attente. Vérifiez votre boîte mail pour confirmer votre inscription.',
      errSend: 'L’inscription n’a pas fonctionné. Réessayez dans un instant.',
      previewNote: 'Ceci est un aperçu de la page : rien n’est encore envoyé.',
      faqEyebrow: 'Questions',
      faqTitle: 'Ce que les parents nous demandent',
      faq: [
        ['Pour quel âge ?', 'Pour les enfants d’environ 3 à 8 ans. Les histoires sont courtes et les jeux se jouent sans savoir lire.'],
        ['Quelles langues ?', 'Français, néerlandais et arabe. Vous choisissez la langue dans l’application et pouvez changer à tout moment.'],
        ['Combien ça coûte ?', 'Une partie est gratuite pour essayer. Pour toutes les histoires et tous les jeux, il y aura un abonnement famille. Le prix sera annoncé au lancement.'],
        ['Est-ce que ça marche sur mon appareil ?', 'Oui, sur toute tablette et tout téléphone récents, dans le navigateur. Rien à installer.'],
      ],
      footerNote: 'Fait en Belgique',
    },
    ar: {
      name: 'قمر الصغير',
      heroTitle: 'قصص وصفحات تلوين وألعاب إسلامية <em>للأطفال الصغار</em>',
      heroLead: 'على الجهاز اللوحي والهاتف، بالعربية والهولندية والفرنسية. بلا إعلانات ولا دردشة، وبالقيم التي تربّون عليها أطفالكم في البيت.',
      heroCta: 'سجّلني في قائمة الانتظار',
      ages: 'للأطفال من 3 إلى 8 سنوات · الانطلاق قبل رمضان 2027',
      phoneText: 'عند ياسمين صحنٌ صغير من التمر. قبل أن تأكل، تقول بهدوء: <b>بسم الله</b>.',
      phoneRead: 'اقرأ لي',
      insideEyebrow: 'ماذا ستجدون',
      insideTitle: 'كل يوم لحظة صغيرة عن الإيمان والمشاركة والشكر',
      f1t: 'قصص مقروءة', f1p: 'قصص قصيرة عن الصدقة، وقول بسم الله، والشكر، والإحسان إلى الجيران. يمكن لطفلك أن يستمع إليها.',
      f2t: 'صفحات تلوين', f2p: 'فوانيس ومساجد وهلال وموائد رمضان. تلوين المساحات بلمسة أو الرسم بالإصبع.',
      f3t: 'ألعاب', f3p: 'لعبة الذاكرة بأشياء من حياة المسلمين اليومية، والتعرّف على الحروف العربية والاستماع إليها.',
      safeEyebrow: 'للوالدين',
      safeTitle: 'هادئ وآمن ومصنوع بعناية',
      promise: [
        ['بلا إعلانات ولا دردشة', 'لا يرى طفلك إلا القصص وصفحات التلوين والألعاب.'],
        ['لا مشتريات للأطفال', 'الوالد وحده يدير الاشتراك، خلف رقابة أبوية.'],
        ['لا بيانات عن طفلك', 'لا نسأل عن اسم طفلك ولا عمره ولا صورته.'],
        ['مراجعة قبل النشر', 'يراجع إمامٌ كل قصة وكل دعاء. ولا يُصوَّر الأنبياء أبدًا.'],
      ],
      signEyebrow: 'قائمة الانتظار',
      signTitle: 'كونوا من الأوائل',
      signIntro: 'سجّلوا لتكونوا أول من يعلم بانطلاق «قمر الصغير»، مع عرض للعائلات الأولى. بضع رسائل فقط حتى الانطلاق.',
      emailLabel: 'بريدك الإلكتروني',
      consent: 'أوافق على تلقي رسائل حول انطلاق «قمر الصغير»، ويمكنني إلغاء الاشتراك في أي وقت. تستخدم شركة Marhaba Data & AI Agent BV عنواني لهذا الغرض فقط، وتعتمد على Brevo كمعالج للبيانات. اقرأ <a href="privacy.html#ar" target="_blank" rel="noopener">سياسة الخصوصية</a>.',
      privacyLink: 'سياسة الخصوصية',
      submit: 'سجّلني',
      errEmail: 'أدخل بريدًا إلكترونيًا صحيحًا، مثل name@example.be.',
      errConsent: 'ضع علامة للموافقة على تلقي الرسائل.',
      ok: 'شكرًا! أنت الآن في قائمة الانتظار. تحقق من بريدك لتأكيد التسجيل.',
      errSend: 'لم ينجح التسجيل. حاول مرة أخرى بعد قليل.',
      previewNote: 'هذه معاينة للصفحة: لا يُرسَل شيء بعد.',
      faqEyebrow: 'أسئلة',
      faqTitle: 'ما يسألنا عنه الآباء',
      faq: [
        ['لأي عمر؟', 'للأطفال من 3 إلى 8 سنوات تقريبًا. القصص قصيرة والألعاب لا تحتاج إلى القراءة.'],
        ['ما اللغات المتاحة؟', 'العربية والهولندية والفرنسية. تختار اللغة في التطبيق ويمكنك تغييرها في أي وقت.'],
        ['كم السعر؟', 'جزء مجاني لتجربته أولًا. ولكل القصص والألعاب سيكون هناك اشتراك عائلي، ونعلن السعر عند الانطلاق.'],
        ['هل يعمل على جهازي؟', 'نعم، على أي جهاز لوحي أو هاتف حديث، عبر المتصفح. لا حاجة إلى التثبيت.'],
      ],
      footerNote: 'صُنع في بلجيكا',
    },
  }

  let lang = 'nl'
  try {
    const saved = localStorage.getItem('qamar-landing-lang')
    if (T[saved]) lang = saved
    else if ((navigator.language || '').toLowerCase().startsWith('fr')) lang = 'fr'
    else if ((navigator.language || '').toLowerCase().startsWith('ar')) lang = 'ar'
  } catch (e) {}

  // ── Drawings (original shapes) ───────────────────────────────────────────
  const moon = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">
      <path d="M10 -46 A46 46 0 1 0 10 46 A66 66 0 0 1 10 -46 Z" fill="#ffd36e"/>
      <path d="M-30 -6 q5 -6 10 0" stroke="#7a4b14" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M-29 14 q8 8 16 0" stroke="#7a4b14" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path class="tw" d="M40 -40 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" fill="#ffe7ad"/></g>`
  const starsIn = (w, h, n) => Array.from({ length: n }, (_, i) =>
      `<circle class="tw" style="animation-delay:${(i % 6) * .5}s" cx="${(i * 47.3) % w}" cy="${(i * 29.7) % (h * .7)}" r="${i % 4 ? 1.4 : 2.2}" fill="#fff"/>`).join('')
  const SVG = {
    phone: `<rect width="300" height="220" fill="#1e2652"/>${starsIn(300, 220, 14)}${moon(220, 70, .8)}
      <rect y="180" width="300" height="40" fill="#2f6b5e"/>
      <g transform="translate(40 118)"><rect y="18" width="110" height="64" rx="6" fill="#e88d67"/><path d="M-8 22 L55 -16 L118 22Z" fill="#8e4a62"/><rect x="16" y="36" width="30" height="24" rx="4" fill="#ffd36e"/><rect x="68" y="44" width="26" height="38" rx="4" fill="#a46a45"/></g>`,
    story: `<svg viewBox="0 0 300 140" preserveAspectRatio="xMidYMid slice">${starsIn(300, 140, 12)}${moon(150, 70, .9)}</svg>`,
    color: `<svg viewBox="0 0 300 140"><g transform="translate(115 6)" stroke="#2a2440" stroke-width="3" stroke-linejoin="round">
      <circle cx="35" cy="10" r="7" fill="none"/><path d="M8 40 Q35 4 62 40Z" fill="#e88d67"/><rect x="4" y="40" width="62" height="10" rx="3" fill="#a2569a"/>
      <path d="M8 50h27v62H14z" fill="#f07a8c"/><path d="M35 50h27l-6 62H35z" fill="#5fb3a3"/><path d="M18 62q8-8 14 0v34H18z" fill="#ffd36e"/>
      <path d="M40 62q8-8 14 0v34H40z" fill="#fff8ea"/><rect x="10" y="112" width="50" height="10" rx="3" fill="#a2569a"/></g>
      <path d="M230 30 l8 16 18 2 -14 12 4 18 -16 -10 -16 10 4 -18 -14 -12 18 -2z" fill="#fff8ea" stroke="#2a2440" stroke-width="3" stroke-linejoin="round"/>
      <path d="M60 104 q20 -30 46 -6" stroke="#4a7fd6" stroke-width="7" fill="none" stroke-linecap="round"/></svg>`,
    games: `<svg viewBox="0 0 300 140"><g font-family="Baloo Bhaijaan 2, sans-serif" font-weight="800" text-anchor="middle">
      <rect x="22" y="22" width="78" height="96" rx="14" fill="#fff"/><text x="61" y="92" font-size="58" fill="#2a2440">ب</text>
      <rect x="111" y="22" width="78" height="96" rx="14" fill="#fff"/>
      <g transform="translate(125 40)"><rect x="6" y="40" width="7" height="44" fill="#4a7fd6"/><path d="M4 40 L9.5 28 L15 40Z" fill="#4a7fd6"/><path d="M18 58 Q34 32 50 58Z" fill="#5fb3a3"/><rect x="18" y="58" width="32" height="26" fill="#8fd3c4"/></g>
      <rect x="200" y="22" width="78" height="96" rx="14" fill="#1e2652"/>${moon(239, 70, .5)}</g></svg>`,
  }

  function apply() {
    const t = T[lang]
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = lang === 'nl' ? 'Kleine Qamar wachtlijst' : lang === 'fr' ? 'Petit Qamar liste d’attente' : 'قمر الصغير'
    document.getElementById('logo').innerHTML = `<svg viewBox="-60 -60 120 120" aria-hidden="true">${moon(0, 0, 1)}</svg><span>${t.name}</span>`
    document.querySelectorAll('[data-t]').forEach(el => { const v = t[el.dataset.t]; if (typeof v === 'string') el.innerHTML = v })
    document.getElementById('promise').innerHTML = '<ul>' + t.promise.map(([h, p]) =>
      `<li><span class="tick" aria-hidden="true">✓</span><div><strong>${h}</strong><span class="t">${p}</span></div></li>`).join('') + '</ul>'
    document.getElementById('faq').innerHTML = t.faq.map(([q, a], i) =>
      `<details id="faq-${i}"><summary>${q}</summary><p>${a}</p></details>`).join('')
    document.querySelectorAll('.langs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)))
    document.getElementById('msg').textContent = ''
    document.getElementById('privacy-link').href = 'privacy.html#' + lang
  }

  // Uitbatergegevens (WER boek III/XII) uit config.js
  document.getElementById('legal-line').textContent =
    [LEGAL.entityName, LEGAL.enterpriseNumber, LEGAL.address || LEGAL.city].join(' · ')
  const legalEmail = document.getElementById('legal-email')
  legalEmail.textContent = LEGAL.email
  legalEmail.href = 'mailto:' + LEGAL.email

  document.querySelectorAll('.langs button').forEach(b => b.onclick = () => {
    lang = b.dataset.lang
    try { localStorage.setItem('qamar-landing-lang', lang) } catch (e) {}
    apply()
  })

  // Static art
  document.getElementById('phone-scene').innerHTML = SVG.phone
  document.getElementById('art-story').innerHTML = SVG.story
  document.getElementById('art-color').innerHTML = SVG.color
  document.getElementById('art-games').innerHTML = SVG.games
  document.getElementById('stars').innerHTML = Array.from({ length: 36 }, (_, i) =>
    `<circle class="tw" style="animation-delay:${(i % 7) * .45}s" cx="${(i * 37.7) % 100}" cy="${(i * 61.3) % 100}" r="${i % 5 ? .16 : .28}" fill="#fff" opacity=".7"/>`).join('')

  // Sign-up
  const form = document.getElementById('form')
  const msg = document.getElementById('msg')
  const note = document.getElementById('preview-note')
  // Inside the claude.ai preview the page cannot reach Brevo; on the real site it can.
  const IN_PREVIEW = /claude\.ai|claudeusercontent|anthropic/.test(location.hostname) || location.protocol === 'file:'
  note.hidden = !IN_PREVIEW

  form.addEventListener('submit', async e => {
    e.preventDefault()
    const t = T[lang]
    const email = document.getElementById('email').value.trim()
    msg.className = 'msg'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.classList.add('err'); msg.textContent = t.errEmail; return }
    if (!document.getElementById('consent').checked) { msg.classList.add('err'); msg.textContent = t.errConsent; return }

    if (!FORM_ENDPOINT || IN_PREVIEW) { msg.classList.add('ok'); msg.textContent = t.previewNote; return }

    const button = document.getElementById('submit')
    button.disabled = true
    try {
      const body = new FormData()
      body.append('EMAIL', email)
      body.append('email_address_check', '')
      body.append('locale', BREVO_LOCALE[lang])
      body.append('html_type', 'simple')
      // Brevo does not allow reading the answer cross-site; a network failure still throws.
      await fetch(FORM_ENDPOINT, { method: 'POST', body, mode: 'no-cors' })
      msg.classList.add('ok'); msg.textContent = t.ok
      form.reset()
    } catch (err) {
      msg.classList.add('err'); msg.textContent = t.errSend
    } finally {
      button.disabled = false
    }
  })

  apply()
})()
