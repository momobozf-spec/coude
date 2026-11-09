import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import "dotenv/config";

// Marketplace seed — vendors, service categories, services, and linking
// existing products to vendors. Runs after the main product seed (see
// package.json → db:seed). Idempotent via upsert on slug/unique fields.

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {}),
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding marketplace (vendors + services)...");

  // ── Vendors ──────────────────────────────────────────────────────────
  const vendorData = [
    { slug: "maison-saffraan", name: "Maison Saffraan", tagline: "Marokkaanse theekunst & tafelcultuur", type: "PRODUCTS", location: "Antwerpen", description: "Ambachtelijke theeglazen, potten en serveerstukken, met liefde geselecteerd in de souks van Marrakech en Fez.", imageSeed: "vendor-saffraan", featured: true },
    { slug: "atelier-amber", name: "Atelier Amber", tagline: "Geuren, kaarsen & home fragrance", type: "PRODUCTS", location: "Brussel", description: "Warme oosterse geuren — oud, amber en musk — in kaarsen, parfumolie en interieursprays.", imageSeed: "vendor-amber", featured: true },
    { slug: "dar-keramiek", name: "Dar Keramiek", tagline: "Handgemaakt aardewerk & decoratie", type: "PRODUCTS", location: "Gent", description: "Handgedraaide en beschilderde keramiek, terracotta en wanddecoratie met oosters karakter.", imageSeed: "vendor-keramiek", featured: true },
    { slug: "riad-textiel", name: "Riad Textiel", tagline: "Kussens, plaids & poufs", type: "PRODUCTS", location: "Rotterdam", description: "Zacht textiel met Berber- en oosters geïnspireerde patronen voor een warm interieur.", imageSeed: "vendor-textiel", featured: false },
    { slug: "hammam-rituals", name: "Hammam Rituals", tagline: "Skincare, selfcare & wellness", type: "PRODUCTS", location: "Online", description: "Arganolie, zwarte zeep en hammam-rituelen voor een verzorgend moment thuis.", imageSeed: "vendor-hammam", featured: false },
    { slug: "studio-leyla", name: "Studio Leyla", tagline: "Event styling, henna & beleving", type: "SERVICES", location: "Antwerpen & omstreken", description: "Creatieve diensten rond events, decoratie en beleving met een oriental touch.", imageSeed: "vendor-leyla", featured: true },
    { slug: "atelier-noor", name: "Atelier Noor", tagline: "Fotografie, branding & workshops", type: "SERVICES", location: "Brussel / online", description: "Beeld, branding en creatieve workshops voor lifestyle-ondernemers en bijzondere momenten.", imageSeed: "vendor-noor", featured: false },
  ];

  const vendors: Record<string, { id: string }> = {};
  for (const v of vendorData) {
    const vendor = await prisma.vendor.upsert({
      where: { slug: v.slug },
      update: v,
      create: v,
    });
    vendors[v.slug] = { id: vendor.id };
  }
  console.log(`Vendors: ${Object.keys(vendors).length}`);

  // Link the admin/demo account to a vendor so the seller dashboard is populated.
  const admin = await prisma.user.findUnique({ where: { email: process.env.ADMIN_EMAIL || "admin@layali.shop" } });
  if (admin) {
    await prisma.vendor.update({ where: { slug: "maison-saffraan" }, data: { userId: admin.id, type: "BOTH" } });
    console.log(`Linked vendor 'maison-saffraan' to admin account`);
  }

  // ── Service categories ───────────────────────────────────────────────
  const serviceCats = [
    { slug: "event-styling", name: "Event styling", sortOrder: 1 },
    { slug: "wedding-decor", name: "Wedding decor", sortOrder: 2 },
    { slug: "henna-artists", name: "Henna artists", sortOrder: 3 },
    { slug: "tea-catering", name: "Catering & tea experience", sortOrder: 4 },
    { slug: "photography", name: "Fotografie & video", sortOrder: 5 },
    { slug: "beauty", name: "Beauty & verzorging", sortOrder: 6 },
    { slug: "interior-styling", name: "Interior styling", sortOrder: 7 },
    { slug: "gift-styling", name: "Gift box styling", sortOrder: 8 },
    { slug: "workshops", name: "Creative workshops", sortOrder: 9 },
    { slug: "branding", name: "Digital branding", sortOrder: 10 },
  ];
  const scats: Record<string, { id: string }> = {};
  for (const c of serviceCats) {
    const cat = await prisma.serviceCategory.upsert({ where: { slug: c.slug }, update: c, create: c });
    scats[c.slug] = { id: cat.id };
  }
  console.log(`Service categories: ${Object.keys(scats).length}`);

  // ── Services ─────────────────────────────────────────────────────────
  const services = [
    { slug: "wedding-decor-styling", title: "Wedding decor styling", cat: "wedding-decor", vendor: "studio-leyla", priceFrom: 750, priceType: "FROM", location: "België", online: false, popular: true, featured: true, shortDesc: "Complete styling voor jouw bruiloft met oriental sfeer.", description: "Van mandap tot tafelaankleding: wij stylen je bruiloft tot in de puntjes met warme oosterse details, lantaarns, textiel en bloemwerk. Inclusief moodboard, opbouw en afbraak.", tags: ["bruiloft", "decor", "styling"] },
    { slug: "henna-night-artist", title: "Henna artist voor je henna-avond", cat: "henna-artists", vendor: "studio-leyla", priceFrom: 150, priceType: "FROM", location: "BE & NL", online: false, popular: true, featured: true, shortDesc: "Professionele henna-kunst voor bruid en gasten.", description: "Een ervaren henna-artiest voor je henna-avond of feest. Fijne, traditionele en moderne patronen, met natuurlijke henna. Pakketten voor bruid alleen of bruid + gasten.", tags: ["henna", "bruiloft", "beleving"] },
    { slug: "moroccan-tea-experience", title: "Moroccan tea experience", cat: "tea-catering", vendor: "studio-leyla", priceFrom: 12, priceType: "FROM", location: "BE", online: false, popular: true, featured: true, shortDesc: "Authentiek theeritueel voor jouw event (p.p.).", description: "Breng het ritueel van Marokkaanse muntthee naar je event. Inclusief theeceremonie, glazen, zoetigheden en sfeervolle styling. Prijs per persoon, vanaf 15 gasten.", tags: ["thee", "catering", "beleving"] },
    { slug: "event-fotografie", title: "Event fotografie", cat: "photography", vendor: "atelier-noor", priceFrom: 350, priceType: "FROM", location: "BE & NL", online: false, popular: true, featured: false, shortDesc: "Sfeervolle reportage van jouw bijzondere moment.", description: "Professionele fotografie voor bruiloften, events en feesten. Warme, editorial beeldtaal die de sfeer van je moment vastlegt. Inclusief nabewerkte digitale galerij.", tags: ["fotografie", "event"] },
    { slug: "beauty-styling", title: "Beauty styling & make-up", cat: "beauty", vendor: "studio-leyla", priceFrom: 95, priceType: "FROM", location: "Antwerpen", online: false, popular: false, featured: false, shortDesc: "Make-up en styling voor je grote dag.", description: "Professionele make-up en beauty styling voor bruiden en gasten. Natuurlijke tot glamoureuze looks, afgestemd op jouw stijl. Proefsessie mogelijk.", tags: ["beauty", "make-up"] },
    { slug: "interior-styling-oriental", title: "Interior styling met oriental touch", cat: "interior-styling", vendor: "studio-leyla", priceFrom: 250, priceType: "FROM", location: "BE & NL", online: true, popular: true, featured: true, shortDesc: "Geef je interieur warmte en karakter.", description: "Een styling-consult voor je woonkamer, hoek of hele interieur met warme oosterse accenten. Inclusief moodboard, kleur- en materiaaladvies en een curated shoppinglijst.", tags: ["interieur", "styling", "advies"] },
    { slug: "gift-box-styling", title: "Gift box styling voor events", cat: "gift-styling", vendor: "atelier-amber", priceFrom: 25, priceType: "FROM", location: "Online", online: true, popular: false, featured: false, shortDesc: "Cadeauboxen op maat voor gasten of relaties.", description: "Op maat samengestelde sfeerboxen voor bruiloften, bedrijfsrelaties of bedankjes. Geuren, kaarsen, dadels en lekkers — sfeervol verpakt. Vanaf 10 stuks.", tags: ["cadeau", "giftbox", "styling"] },
    { slug: "keramiek-workshop", title: "Creative workshop keramiek", cat: "workshops", vendor: "dar-keramiek", priceFrom: 65, priceType: "FROM", location: "Gent", online: false, popular: true, featured: true, shortDesc: "Draai je eigen schaaltje of theekom (p.p.).", description: "Een gezellige hands-on workshop waarin je je eigen keramiek draait en beschildert met oosterse motieven. Inclusief materiaal, begeleiding en bakken. Voor groepen en teambuilding.", tags: ["workshop", "keramiek", "ambacht"] },
    { slug: "branding-lifestyle", title: "Branding pakket voor lifestyle-ondernemers", cat: "branding", vendor: "atelier-noor", priceFrom: 850, priceType: "FROM", location: "Online", online: true, popular: false, featured: false, shortDesc: "Warm, herkenbaar merk voor jouw zaak.", description: "Logo, kleurenpalet, typografie en social templates met een warme oriental signatuur. Inclusief merkgids en toepassingen. Ideaal voor kleine lifestyle- en horecazaken.", tags: ["branding", "design", "ondernemers"] },
    { slug: "event-styling-arabian", title: "Event styling — Arabian Nights", cat: "event-styling", vendor: "studio-leyla", priceFrom: 500, priceType: "FROM", location: "BE & NL", online: false, popular: true, featured: true, shortDesc: "Volledige sfeerstyling voor je feest of event.", description: "Dompel je gasten onder in 1001-nachten sfeer: lounge-zithoeken, lantaarns, textiel, licht en geur. Concept, opbouw en styling volledig verzorgd.", tags: ["event", "styling", "arabian nights"] },
    { slug: "video-reels", title: "Video & reels voor je merk", cat: "photography", vendor: "atelier-noor", priceFrom: 300, priceType: "FROM", location: "BE", online: false, popular: false, featured: false, shortDesc: "Sfeervolle content voor social media.", description: "Korte, warme video-content en reels voor je webshop of zaak. Van productvideo tot sfeerimpressie. Inclusief montage en kleurgrading.", tags: ["video", "content", "social"] },
    { slug: "tafelstyling-workshop", title: "Workshop oosterse tafelstyling", cat: "workshops", vendor: "studio-leyla", priceFrom: 55, priceType: "FROM", location: "Antwerpen", online: false, popular: false, featured: false, shortDesc: "Leer een sfeervolle tafel dekken (p.p.).", description: "Leer in een avond hoe je een warme, gastvrije tafel dekt met theeglazen, textiel, kaarsen en kleur. Inclusief hapjes, thee en een goodie. Voor vriendengroepen en teams.", tags: ["workshop", "tafelstyling", "beleving"] },
  ];

  let createdServices = 0;
  for (const s of services) {
    const { cat, vendor, ...rest } = s;
    await prisma.service.upsert({
      where: { slug: s.slug },
      update: { ...rest, categoryId: scats[cat].id, vendorId: vendors[vendor].id, status: "ACTIVE" },
      create: { ...rest, categoryId: scats[cat].id, vendorId: vendors[vendor].id, status: "ACTIVE" },
    });
    createdServices++;
  }
  console.log(`Services: ${createdServices}`);

  // ── Link existing products to product vendors (by category) ──────────
  const productVendorByCategory: Record<string, string> = {
    "tea-experience": "maison-saffraan",
    tableware: "maison-saffraan",
    "kitchen-serving": "maison-saffraan",
    fragrance: "atelier-amber",
    "candles-lanterns": "atelier-amber",
    "home-decor": "dar-keramiek",
    "cushions-textiles": "riad-textiel",
    "hammam-wellness": "hammam-rituals",
    gifts: "atelier-amber",
    "wedding-henna": "studio-leyla",
    seasonal: "atelier-amber",
  };

  const allProducts = await prisma.product.findMany({ include: { category: true } });
  let linked = 0;
  for (const p of allProducts) {
    const vSlug = productVendorByCategory[p.category.slug];
    if (!vSlug) continue;
    await prisma.product.update({ where: { id: p.id }, data: { vendorId: vendors[vSlug].id } });
    linked++;
  }
  console.log(`Products linked to a vendor: ${linked}`);

  console.log("Marketplace seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
