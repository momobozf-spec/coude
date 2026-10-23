import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import "dotenv/config";

// SQLite client. Array fields are native Json columns, so arrays can be passed
// directly — Prisma serialises them.
const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
  ...(process.env.DATABASE_AUTH_TOKEN ? { authToken: process.env.DATABASE_AUTH_TOKEN } : {}),
});
const prisma = new PrismaClient({ adapter });

/**
 * Deterministic placeholder photography. Always renders (never a broken image),
 * seeded per product so every product keeps a stable picture. Replace these with
 * real product photography (Cloudinary/your CDN) before launch.
 */
const img = (seed: string, n = 1): string[] =>
  Array.from({ length: n }, (_, i) => `https://picsum.photos/seed/layali-${seed}-${i}/900/1100`);

type SeedProduct = {
  name: string;
  slug: string;
  sku: string;
  shortDesc: string;
  description: string;
  descriptionFr?: string;
  price: number;
  comparePrice?: number;
  images: string[];
  colors?: string[];
  scents?: string[];
  materials?: string[];
  sizes?: string[];
  tags?: string[];
  stock: number;
  weight?: number;
  shippingType?: string;
  featured?: boolean;
  bestSeller?: boolean;
  newCollection?: boolean;
  badge?: string;
  category: string; // category slug
};

async function main() {
  console.log("Seeding Layali (Oriental Lifestyle) database...");

  // ---------------------------------------------------------------------------
  // Admin user
  // ---------------------------------------------------------------------------
  const adminPassword = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD || "admin123456", 12);
  const admin = await prisma.user.upsert({
    where: { email: process.env.ADMIN_EMAIL || "admin@layali.shop" },
    update: { role: "ADMIN" },
    create: {
      email: process.env.ADMIN_EMAIL || "admin@layali.shop",
      name: "Layali Admin",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log("Admin user:", admin.email);

  // A demo customer so order/account flows can be tested immediately.
  const customerPassword = await bcrypt.hash("klant123456", 12);
  await prisma.user.upsert({
    where: { email: "klant@layali.shop" },
    update: {},
    create: { email: "klant@layali.shop", name: "Demo Klant", password: customerPassword, role: "USER" },
  });

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------
  const categoryData: { name: string; slug: string; description: string; sortOrder: number; seed: string }[] = [
    { name: "Home Decor", slug: "home-decor", description: "Wanddecoratie, schalen en accenten die je interieur warmte geven.", sortOrder: 1, seed: "homedecor" },
    { name: "Tea Experience", slug: "tea-experience", description: "Theeglazen, theepotten en alles voor het perfecte oosterse theemoment.", sortOrder: 2, seed: "tea" },
    { name: "Tableware", slug: "tableware", description: "Serveerschalen, plateaus en tafelaankleding met oosters karakter.", sortOrder: 3, seed: "tableware" },
    { name: "Fragrance", slug: "fragrance", description: "Musk, oud en amber parfumolie, home fragrance en wierook.", sortOrder: 4, seed: "fragrance" },
    { name: "Candles & Lanterns", slug: "candles-lanterns", description: "Geurkaarsen en lantaarns voor warm, sfeervol licht.", sortOrder: 5, seed: "candles" },
    { name: "Hammam & Wellness", slug: "hammam-wellness", description: "Hammam- en badrituelen met arganolie en zwarte zeep.", sortOrder: 6, seed: "hammam" },
    { name: "Gifts", slug: "gifts", description: "Cadeaupakketten en sfeerboxen met karakter voor elke gelegenheid.", sortOrder: 7, seed: "gifts" },
    { name: "Wedding & Henna Gifts", slug: "wedding-henna", description: "Bedankjes en giftboxen voor bruiloft en henna night.", sortOrder: 8, seed: "wedding" },
    { name: "Kitchen & Serving", slug: "kitchen-serving", description: "Tajines, serveersets en keukenitems voor gastvrij tafelen.", sortOrder: 9, seed: "kitchen" },
    { name: "Cushions & Textiles", slug: "cushions-textiles", description: "Decoratieve kussens en luxe plaids met oosterse patronen.", sortOrder: 10, seed: "textiles" },
    { name: "Seasonal Collections", slug: "seasonal", description: "Seizoenscollecties — van Ramadan & Eid tot winterwarmte.", sortOrder: 11, seed: "seasonal" },
  ];

  const categories: Record<string, { id: string }> = {};
  for (const c of categoryData) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name, description: c.description, sortOrder: c.sortOrder, image: img(c.seed)[0] },
      create: { name: c.name, slug: c.slug, description: c.description, sortOrder: c.sortOrder, image: img(c.seed)[0] },
    });
    categories[c.slug] = { id: cat.id };
  }
  console.log(`Created ${Object.keys(categories).length} categories`);

  // ---------------------------------------------------------------------------
  // Products (36 oriental lifestyle items)
  // ---------------------------------------------------------------------------
  const products: SeedProduct[] = [
    // ---- Tea Experience ----
    {
      name: "Marokkaanse Theeglazen — Set van 6",
      slug: "marokkaanse-theeglazen-set-6",
      sku: "LAY-TEA-001",
      shortDesc: "Handgedecoreerde theeglazen met goudaccent.",
      description:
        "Authentieke Marokkaanse theeglazen, set van 6. Elk glas is handgedecoreerd met een subtiel goudkleurig patroon dat schittert bij kaarslicht. Perfect voor muntthee, maar even mooi voor water of dessert.\n\n- Set van 6 glazen (±200 ml)\n- Handgedecoreerd goudkleurig motief\n- Hittebestendig glas\n- Geschikt voor warme en koude dranken",
      descriptionFr: "Authentiques verres à thé marocains, lot de 6. Chaque verre est décoré à la main d'un motif doré subtil.",
      price: 34.95,
      comparePrice: 44.95,
      images: img("theeglazen", 3),
      colors: ["Goud", "Groen", "Amber", "Helder"],
      materials: ["Glas"],
      tags: ["theeglazen", "marokkaans", "theemoment", "set"],
      stock: 80,
      weight: 1200,
      featured: true,
      bestSeller: true,
      badge: "BESTSELLER",
      category: "tea-experience",
    },
    {
      name: "Oosterse Theepot — Gehamerd Messing",
      slug: "oosterse-theepot-gehamerd-messing",
      sku: "LAY-TEA-002",
      shortDesc: "Theepot in gehamerd messing met houten greep.",
      description:
        "Een sierlijke theepot in gehamerd messing, met een ergonomische houten greep die koel blijft. De gebogen schenktuit giet zonder druppelen — ideaal voor het ritueel van Marokkaanse muntthee.\n\n- Inhoud 1 liter\n- Gehamerd messing finish\n- Warmtebestendige houten greep\n- Ingebouwde zeef",
      price: 59.95,
      images: img("theepot", 3),
      colors: ["Messing", "Zilver"],
      materials: ["Messing", "Hout"],
      tags: ["theepot", "theemoment", "messing"],
      stock: 45,
      weight: 900,
      featured: true,
      badge: "NEW",
      newCollection: true,
      category: "tea-experience",
    },
    {
      name: "Muntthee Glazen met Onderzetters",
      slug: "muntthee-glazen-onderzetters",
      sku: "LAY-TEA-003",
      shortDesc: "Slanke theeglazen met messing onderzetters.",
      description:
        "Slanke theeglazen geleverd met bijpassende messing onderzetters. De combinatie van helder glas en warm metaal brengt direct souk-sfeer op tafel.\n\n- Set van 4 glazen + 4 onderzetters\n- Vaatwasbestendig glas",
      price: 39.95,
      images: img("muntthee", 2),
      colors: ["Goud", "Koper"],
      materials: ["Glas", "Messing"],
      tags: ["theeglazen", "onderzetter", "set"],
      stock: 60,
      weight: 1000,
      category: "tea-experience",
    },
    {
      name: "Theedoos met Vakken — Hout & Inlay",
      slug: "theedoos-vakken-hout-inlay",
      sku: "LAY-TEA-004",
      shortDesc: "Houten theedoos met fijn inlegwerk.",
      description:
        "Een elegante houten theedoos met geometrisch inlegwerk en zes vakken om losse thee of theezakjes stijlvol te bewaren.\n\n- 6 vakken\n- Handgemaakt inlegwerk\n- Magneetsluiting",
      price: 42.0,
      images: img("theedoos", 2),
      materials: ["Hout", "Parelmoer inlay"],
      tags: ["theedoos", "opbergen"],
      stock: 35,
      weight: 700,
      category: "tea-experience",
    },

    // ---- Candles & Lanterns ----
    {
      name: "Geurkaars Oud & Amber — Amberglas",
      slug: "geurkaars-oud-amber",
      sku: "LAY-CAN-001",
      shortDesc: "Sojawaskaars met warme oud-amber geur.",
      description:
        "Een sojawaskaars met de iconische warme combinatie van oud en amber. Brandt rustig en vult je huis met een diepe, sfeervolle gloed.\n\n- Natuurlijke sojawas\n- Brandduur ±45 uur\n- Herbruikbaar amberglas\n- Katoenen lont",
      price: 24.95,
      images: img("geurkaars-oud", 2),
      scents: ["Oud & Amber", "Musk", "Rozen & Saffraan"],
      materials: ["Sojawas", "Glas"],
      tags: ["geurkaars", "oud", "amber", "sfeer"],
      stock: 120,
      weight: 400,
      featured: true,
      bestSeller: true,
      badge: "BESTSELLER",
      category: "candles-lanterns",
    },
    {
      name: "Marokkaanse Lantaarn — Gietijzer & Glas",
      slug: "marokkaanse-lantaarn-gietijzer",
      sku: "LAY-CAN-002",
      shortDesc: "Lantaarn die warme lichtpatronen werpt.",
      description:
        "Een handbewerkte lantaarn in gietijzer met gekleurd glas. Plaats er een theelichtje in en de muren vullen zich met betoverende lichtpatronen — pure 1001-nachten sfeer.\n\n- Hoogte 35 cm\n- Geschikt voor theelicht of LED\n- Ophangbaar of staand",
      price: 49.95,
      comparePrice: 64.95,
      images: img("lantaarn", 3),
      colors: ["Zwart", "Antiek Goud", "Brons"],
      materials: ["Gietijzer", "Gekleurd glas"],
      tags: ["lantaarn", "licht", "sfeer", "marokkaans"],
      stock: 50,
      weight: 1500,
      featured: true,
      newCollection: true,
      badge: "NEW",
      category: "candles-lanterns",
    },
    {
      name: "Theelichthouders — Set van 3 Mozaïek",
      slug: "theelichthouders-mozaiek-set-3",
      sku: "LAY-CAN-003",
      shortDesc: "Mozaïek waxinehouders in warme tinten.",
      description:
        "Set van 3 mozaïek theelichthouders in oplopende maten. Het gekleurde glas tovert een warme gloed op elke tafel of vensterbank.",
      price: 29.95,
      images: img("theelicht", 2),
      colors: ["Amber Mix", "Terracotta Mix"],
      materials: ["Mozaïekglas"],
      tags: ["theelicht", "mozaiek", "set"],
      stock: 70,
      weight: 600,
      category: "candles-lanterns",
    },
    {
      name: "Geurkaars Rozen & Saffraan — 3 Lonten",
      slug: "geurkaars-rozen-saffraan-3-lonten",
      sku: "LAY-CAN-004",
      shortDesc: "Grote kaars met drie lonten, bloemig-warm.",
      description:
        "Een royale drie-lonts geurkaars met een bloemig-warme geur van rozen en saffraan. Vult grotere ruimtes moeiteloos met sfeer.\n\n- Brandduur ±60 uur\n- Drie katoenen lonten",
      price: 34.95,
      images: img("kaars-rozen", 2),
      scents: ["Rozen & Saffraan", "Oud & Amber", "Vijg & Cederhout"],
      materials: ["Sojawas", "Glas"],
      tags: ["geurkaars", "rozen", "saffraan"],
      stock: 65,
      weight: 700,
      category: "candles-lanterns",
    },

    // ---- Fragrance ----
    {
      name: "Amber Musk Parfumolie — 12 ml",
      slug: "amber-musk-parfumolie-12ml",
      sku: "LAY-FRA-001",
      shortDesc: "Alcoholvrije parfumolie, warm en langhoudend.",
      description:
        "Een alcoholvrije parfumolie met een warme, sensuele combinatie van amber en witte musk. Een klein beetje volstaat voor een geur die de hele dag meegaat.\n\n- 12 ml roller\n- Alcoholvrij\n- Langhoudend",
      price: 19.95,
      images: img("parfumolie", 2),
      scents: ["Amber Musk", "Witte Musk", "Oud Royal", "Rozen"],
      materials: ["Parfumolie"],
      tags: ["parfumolie", "musk", "amber", "geur"],
      stock: 150,
      weight: 80,
      featured: true,
      bestSeller: true,
      badge: "BESTSELLER",
      category: "fragrance",
    },
    {
      name: "Home Fragrance Spray — Oosterse Nacht",
      slug: "home-fragrance-spray-oosterse-nacht",
      sku: "LAY-FRA-002",
      shortDesc: "Roomspray met oud, amber en specerijen.",
      description:
        "Een luxueuze interieurspray die je woning in enkele seconden onderdompelt in een warme oosterse sfeer van oud, amber en zachte specerijen.\n\n- 100 ml\n- Tot 2 uur merkbaar in de ruimte",
      price: 22.95,
      images: img("home-spray", 2),
      scents: ["Oosterse Nacht", "Muntthee", "Vijg & Cederhout"],
      materials: ["Geurspray"],
      tags: ["home fragrance", "spray", "interieur"],
      stock: 90,
      weight: 200,
      newCollection: true,
      category: "fragrance",
    },
    {
      name: "Bakhoor Wierook — Oud Geschenkdoos",
      slug: "bakhoor-wierook-oud-geschenkdoos",
      sku: "LAY-FRA-003",
      shortDesc: "Traditionele bakhoor met oud-hars.",
      description:
        "Traditionele bakhoor in een elegante geschenkdoos. Verwarm een stukje op een wierookbrander en geniet van de rijke, warme geur van oud.\n\n- ±40 g bakhoor\n- Geschenkverpakking",
      price: 27.5,
      images: img("bakhoor", 2),
      scents: ["Oud", "Amber", "Rozen"],
      materials: ["Bakhoor"],
      tags: ["wierook", "bakhoor", "oud"],
      stock: 75,
      weight: 150,
      category: "fragrance",
    },
    {
      name: "Wierookhouder — Messing Halve Maan",
      slug: "wierookhouder-messing-halve-maan",
      sku: "LAY-FRA-004",
      shortDesc: "Sierlijke messing houder voor wierookstokjes.",
      description:
        "Een sierlijke wierookhouder in messing met een halve-maan vorm en uitgespaarde ornamenten die mee oplichten met de gloed. Vangt as netjes op.",
      price: 18.95,
      images: img("wierookhouder", 2),
      colors: ["Messing", "Antiek Zwart"],
      materials: ["Messing"],
      tags: ["wierook", "houder", "messing"],
      stock: 85,
      weight: 250,
      category: "fragrance",
    },

    // ---- Home Decor ----
    {
      name: "Wanddecoratie — Arabesk Houtsnijwerk",
      slug: "wanddecoratie-arabesk-houtsnijwerk",
      sku: "LAY-DEC-001",
      shortDesc: "Handgesneden arabesk wandpaneel.",
      description:
        "Een handgesneden houten wandpaneel met fijn arabesk-patroon. Werpt subtiele schaduwen en geeft elke muur direct oosterse allure.\n\n- 60 × 40 cm\n- Massief hout\n- Ophangsysteem inbegrepen",
      price: 79.0,
      comparePrice: 99.0,
      images: img("wanddecoratie", 3),
      colors: ["Naturel", "Walnoot", "Wit"],
      materials: ["Hout"],
      tags: ["wanddecoratie", "arabesk", "interieur"],
      stock: 30,
      weight: 2200,
      featured: true,
      category: "home-decor",
    },
    {
      name: "Handgemaakte Keramieken Schaaltjes — Set van 4",
      slug: "keramieken-schaaltjes-set-4",
      sku: "LAY-DEC-002",
      shortDesc: "Met de hand beschilderde schaaltjes.",
      description:
        "Set van 4 met de hand beschilderde keramieken schaaltjes, elk met een uniek oosters motief. Perfect voor olijven, dadels, nootjes of dips.\n\n- Ø 10 cm\n- Handbeschilderd — elk stuk uniek\n- Vaatwasbestendig",
      price: 32.95,
      images: img("schaaltjes", 3),
      colors: ["Blauw Mix", "Terracotta Mix", "Groen Mix"],
      materials: ["Keramiek"],
      tags: ["schaaltjes", "keramiek", "handgemaakt", "set"],
      stock: 95,
      weight: 900,
      bestSeller: true,
      category: "home-decor",
    },
    {
      name: "Spiegel met Messing Lijst — Ster",
      slug: "spiegel-messing-lijst-ster",
      sku: "LAY-DEC-003",
      shortDesc: "Stervormige spiegel met messing rand.",
      description:
        "Een stervormige spiegel met handgevormde messing rand. Een statement-stuk dat licht weerkaatst en je interieur warmte en diepte geeft.\n\n- Ø 50 cm\n- Messing afwerking",
      price: 89.0,
      images: img("spiegel", 2),
      colors: ["Messing", "Antiek Goud"],
      materials: ["Messing", "Glas"],
      tags: ["spiegel", "wanddecoratie", "messing"],
      stock: 25,
      weight: 2500,
      newCollection: true,
      badge: "NEW",
      category: "home-decor",
    },
    {
      name: "Decoratieve Vaas — Beldi Terracotta",
      slug: "decoratieve-vaas-beldi-terracotta",
      sku: "LAY-DEC-004",
      shortDesc: "Handgedraaide terracotta beldi-vaas.",
      description:
        "Een handgedraaide beldi-vaas in warme terracotta met een matte, aardse finish. Mooi solo of met gedroogde pampas.\n\n- Hoogte 28 cm\n- Handgedraaid aardewerk",
      price: 38.0,
      images: img("vaas", 2),
      colors: ["Terracotta", "Gebroken Wit", "Olijfgroen"],
      materials: ["Aardewerk"],
      tags: ["vaas", "terracotta", "beldi"],
      stock: 55,
      weight: 1300,
      category: "home-decor",
    },

    // ---- Tableware ----
    {
      name: "Gegraveerd Dienblad — Rond Messing",
      slug: "gegraveerd-dienblad-rond-messing",
      sku: "LAY-TAB-001",
      shortDesc: "Handgegraveerd rond serveerblad.",
      description:
        "Een handgegraveerd rond dienblad in messing met fijn bloemmotief. Serveer er thee en zoetigheden op, of gebruik het als sfeervol decoratie-element.\n\n- Ø 40 cm\n- Handgegraveerd\n- Antislip voetjes",
      price: 54.95,
      comparePrice: 69.95,
      images: img("dienblad", 3),
      colors: ["Messing", "Zilver", "Koper"],
      materials: ["Messing"],
      tags: ["dienblad", "serveren", "gegraveerd"],
      stock: 60,
      weight: 1400,
      featured: true,
      bestSeller: true,
      badge: "BESTSELLER",
      category: "tableware",
    },
    {
      name: "Gouden Serveerplateau — Ovaal",
      slug: "gouden-serveerplateau-ovaal",
      sku: "LAY-TAB-002",
      shortDesc: "Ovaal plateau met gouden finish.",
      description:
        "Een elegant ovaal serveerplateau met warme gouden finish en handgrepen. Brengt direct feestelijke allure op je tafel.\n\n- 45 × 30 cm\n- Roestvrij met gouden coating",
      price: 44.95,
      images: img("plateau", 2),
      colors: ["Goud", "Rosé Goud"],
      materials: ["Roestvrij staal"],
      tags: ["plateau", "serveren", "goud"],
      stock: 50,
      weight: 1100,
      newCollection: true,
      category: "tableware",
    },
    {
      name: "Tafelloper — Geometrisch Oosters Patroon",
      slug: "tafelloper-geometrisch-oosters",
      sku: "LAY-TAB-003",
      shortDesc: "Geweven tafelloper met kwastjes.",
      description:
        "Een geweven tafelloper met geometrisch oosters patroon en handgeknoopte kwastjes. Geeft je eettafel een warme, gastvrije uitstraling.\n\n- 180 × 40 cm\n- Katoenmix",
      price: 28.95,
      images: img("tafelloper", 2),
      colors: ["Terracotta", "Olijf", "Zand"],
      materials: ["Katoen"],
      tags: ["tafelloper", "textiel", "patroon"],
      stock: 80,
      weight: 400,
      category: "tableware",
    },

    // ---- Kitchen & Serving ----
    {
      name: "Tajine Serveerset — Handbeschilderd",
      slug: "tajine-serveerset-handbeschilderd",
      sku: "LAY-KIT-001",
      shortDesc: "Decoratieve handbeschilderde tajine.",
      description:
        "Een handbeschilderde tajine als blikvanger op tafel. Serveer er stoofgerechten in of gebruik hem als decoratief pronkstuk.\n\n- Ø 30 cm\n- Handbeschilderd aardewerk\n- Decoratief gebruik aanbevolen",
      price: 49.95,
      images: img("tajine", 3),
      colors: ["Blauw", "Geel", "Groen", "Terracotta"],
      materials: ["Aardewerk"],
      tags: ["tajine", "serveren", "keuken", "handbeschilderd"],
      stock: 40,
      weight: 2000,
      featured: true,
      category: "kitchen-serving",
    },
    {
      name: "Couscous Serveerschaal — Groot",
      slug: "couscous-serveerschaal-groot",
      sku: "LAY-KIT-002",
      shortDesc: "Ruime schaal met deksel om te delen.",
      description:
        "Een ruime serveerschaal met deksel, gemaakt om te delen. Houdt gerechten warm en brengt gezelligheid naar het midden van de tafel.\n\n- Ø 35 cm\n- Met deksel",
      price: 46.0,
      images: img("couscous", 2),
      colors: ["Gebroken Wit", "Terracotta"],
      materials: ["Aardewerk"],
      tags: ["schaal", "serveren", "delen"],
      stock: 35,
      weight: 2300,
      category: "kitchen-serving",
    },
    {
      name: "Olijf- & Dadelschaaltjes — Met Pitbakje",
      slug: "olijf-dadelschaaltjes-pitbakje",
      sku: "LAY-KIT-003",
      shortDesc: "Serveerschaaltje met apart pitbakje.",
      description:
        "Een praktisch serveerschaaltje met geïntegreerd pitbakje voor olijven en dadels. Gastvrijheid in zijn mooiste, eenvoudigste vorm.",
      price: 21.95,
      images: img("olijfschaal", 2),
      colors: ["Blauw", "Groen"],
      materials: ["Keramiek"],
      tags: ["schaaltje", "olijven", "dadels"],
      stock: 70,
      weight: 500,
      category: "kitchen-serving",
    },

    // ---- Hammam & Wellness ----
    {
      name: "Hammam Giftbox — Compleet Badritueel",
      slug: "hammam-giftbox-badritueel",
      sku: "LAY-HAM-001",
      shortDesc: "Zwarte zeep, kessa, ghassoul & arganolie.",
      description:
        "Een compleet hammam-ritueel in één giftbox: Marokkaanse zwarte zeep, een kessa-handschoen, ghassoul kleimasker en pure arganolie. Breng het verwennende ritueel van de hammam naar je eigen badkamer.\n\n- Zwarte zeep 200 g\n- Kessa exfoliërende handschoen\n- Ghassoul klei 100 g\n- Arganolie 30 ml\n- In luxe geschenkdoos",
      price: 44.95,
      comparePrice: 54.95,
      images: img("hammam-box", 3),
      materials: ["Verzorging"],
      tags: ["hammam", "giftbox", "wellness", "cadeau"],
      stock: 60,
      weight: 800,
      featured: true,
      bestSeller: true,
      badge: "BESTSELLER",
      category: "hammam-wellness",
    },
    {
      name: "Arganolie Skincare Set",
      slug: "arganolie-skincare-set",
      sku: "LAY-HAM-002",
      shortDesc: "Pure arganolie voor huid en haar.",
      description:
        "Een verzorgende set met pure, koudgeperste arganolie voor huid en haar, aangevuld met een nourishing bodybutter. Voedt, herstelt en geeft een natuurlijke glans.\n\n- Arganolie 50 ml\n- Bodybutter 100 ml",
      price: 32.95,
      images: img("argan", 2),
      scents: ["Naturel", "Amber"],
      materials: ["Verzorging"],
      tags: ["argan", "skincare", "wellness"],
      stock: 80,
      weight: 300,
      newCollection: true,
      category: "hammam-wellness",
    },
    {
      name: "Marokkaanse Zwarte Zeep — Eucalyptus",
      slug: "marokkaanse-zwarte-zeep-eucalyptus",
      sku: "LAY-HAM-003",
      shortDesc: "Reinigende beldi zeep met eucalyptus.",
      description:
        "Authentieke Marokkaanse zwarte zeep (savon beldi) verrijkt met eucalyptus. Reinigt diep en bereidt de huid voor op exfoliatie met een kessa-handschoen.\n\n- 250 g\n- Op basis van olijfolie",
      price: 14.95,
      images: img("zwarte-zeep", 2),
      scents: ["Eucalyptus", "Naturel", "Rozen"],
      materials: ["Verzorging"],
      tags: ["zwarte zeep", "hammam", "beldi"],
      stock: 110,
      weight: 280,
      category: "hammam-wellness",
    },

    // ---- Cushions & Textiles ----
    {
      name: "Decoratief Kussen — Oosters Borduurwerk",
      slug: "decoratief-kussen-oosters-borduurwerk",
      sku: "LAY-TEX-001",
      shortDesc: "Kussenhoes met fijn borduurwerk.",
      description:
        "Een decoratieve kussenhoes met fijn oosters borduurwerk en kwastjes in de hoeken. Voegt direct warmte en textuur toe aan je bank of bed.\n\n- 45 × 45 cm\n- Verborgen rits\n- Hoes (zonder vulling)",
      price: 26.95,
      images: img("kussen", 3),
      colors: ["Terracotta", "Olijfgroen", "Mosterd", "Gebroken Wit"],
      materials: ["Katoen", "Borduurwerk"],
      tags: ["kussen", "textiel", "borduurwerk"],
      stock: 100,
      weight: 350,
      featured: true,
      bestSeller: true,
      badge: "BESTSELLER",
      category: "cushions-textiles",
    },
    {
      name: "Luxe Plaid — Geweven Kwastjes",
      slug: "luxe-plaid-geweven-kwastjes",
      sku: "LAY-TEX-002",
      shortDesc: "Zachte geweven plaid met kwastjes.",
      description:
        "Een zachte, zwaar geweven plaid met handgeknoopte kwastjes. Perfect voor warme avonden met thee op de bank.\n\n- 130 × 170 cm\n- Katoenmix\n- Machine wasbaar 30°C",
      price: 49.95,
      comparePrice: 64.95,
      images: img("plaid", 2),
      colors: ["Zand", "Terracotta", "Olijf", "Antraciet"],
      materials: ["Katoen", "Wolmix"],
      tags: ["plaid", "textiel", "warmte"],
      stock: 70,
      weight: 1100,
      category: "cushions-textiles",
    },
    {
      name: "Pouf — Handgestikt Leer",
      slug: "pouf-handgestikt-leer",
      sku: "LAY-TEX-003",
      shortDesc: "Klassieke Marokkaanse leren pouf.",
      description:
        "Een klassieke handgestikte Marokkaanse pouf in echt leer. Dienst als voetenbankje, extra zit of sfeervol accent.\n\n- Ø 50 cm\n- Echt leer\n- Geleverd ongevuld",
      price: 89.0,
      images: img("pouf", 2),
      colors: ["Cognac", "Naturel", "Antiek Goud"],
      materials: ["Leer"],
      tags: ["pouf", "zit", "leer"],
      stock: 30,
      weight: 1500,
      newCollection: true,
      category: "cushions-textiles",
    },

    // ---- Gifts (incl. sfeerboxen) ----
    {
      name: "Sfeerbox “Arabian Night”",
      slug: "sfeerbox-arabian-night",
      sku: "LAY-GIF-001",
      shortDesc: "Kaars, parfumolie, theeglazen & dadels.",
      description:
        "Een complete sfeerbox die de magie van een Arabische nacht naar huis brengt: een oud-amber geurkaars, amber musk parfumolie, twee theeglazen en een doosje luxe dadels — verpakt in een elegante geschenkdoos.\n\n- Geurkaars Oud & Amber\n- Parfumolie Amber Musk 12 ml\n- 2 theeglazen\n- Luxe dadels 100 g",
      price: 64.95,
      comparePrice: 84.95,
      images: img("sfeerbox-arabian", 3),
      materials: ["Cadeaupakket"],
      tags: ["sfeerbox", "cadeau", "giftbox", "arabian night"],
      stock: 50,
      weight: 1200,
      featured: true,
      bestSeller: true,
      badge: "BESTSELLER",
      category: "gifts",
    },
    {
      name: "Sfeerbox “Moroccan Tea Moment”",
      slug: "sfeerbox-moroccan-tea-moment",
      sku: "LAY-GIF-002",
      shortDesc: "Theepot, glazen, muntthee & koekjes.",
      description:
        "Alles voor het perfecte Marokkaanse theemoment in één geschenkbox: een messing theepot, twee theeglazen, losse muntthee en traditionele amandelkoekjes.\n\n- Messing theepot\n- 2 theeglazen\n- Muntthee 100 g\n- Amandelkoekjes",
      price: 74.95,
      images: img("sfeerbox-tea", 3),
      materials: ["Cadeaupakket"],
      tags: ["sfeerbox", "cadeau", "theemoment", "giftbox"],
      stock: 45,
      weight: 1600,
      featured: true,
      newCollection: true,
      badge: "NEW",
      category: "gifts",
    },
    {
      name: "Cadeaupakket “Nieuw Huis”",
      slug: "cadeaupakket-nieuw-huis",
      sku: "LAY-GIF-003",
      shortDesc: "Warm welkomstcadeau voor een nieuw thuis.",
      description:
        "Een warm welkomstcadeau voor wie net verhuisd is: een geurkaars, home fragrance spray en een set keramieken schaaltjes. Breng meteen sfeer in het nieuwe huis.\n\n- Geurkaars\n- Home fragrance spray 100 ml\n- 2 keramieken schaaltjes",
      price: 54.95,
      images: img("cadeau-huis", 2),
      materials: ["Cadeaupakket"],
      tags: ["cadeau", "giftbox", "nieuw huis", "housewarming"],
      stock: 55,
      weight: 1000,
      category: "gifts",
    },
    {
      name: "Luxe Dadelbox — Geassorteerd",
      slug: "luxe-dadelbox-geassorteerd",
      sku: "LAY-GIF-004",
      shortDesc: "Premium dadels in geschenkdoos.",
      description:
        "Een selectie premium Medjool- en gevulde dadels in een elegante geschenkdoos. Het klassieke gastvrijheidscadeau, mooi om te geven en te delen.\n\n- ±400 g geassorteerde dadels\n- Luxe geschenkverpakking",
      price: 24.95,
      images: img("dadelbox", 2),
      materials: ["Delicatesse"],
      tags: ["dadels", "cadeau", "giftbox", "gastvrijheid"],
      stock: 90,
      weight: 500,
      category: "gifts",
    },

    // ---- Wedding & Henna Gifts ----
    {
      name: "Henna Night Giftbox",
      slug: "henna-night-giftbox",
      sku: "LAY-WED-001",
      shortDesc: "Henna, kaarsen & decoratie voor de henna-avond.",
      description:
        "Een feestelijke giftbox voor de henna-avond: natuurlijke henna, sfeerkaarsen, een sierschaaltje en decoratieve details — alles om er een onvergetelijke avond van te maken.\n\n- Natuurlijke henna\n- 2 sfeerkaarsen\n- Sierschaaltje\n- Decoratie",
      price: 49.95,
      images: img("henna-box", 3),
      materials: ["Cadeaupakket"],
      tags: ["henna", "bruiloft", "cadeau", "giftbox"],
      stock: 40,
      weight: 900,
      featured: true,
      category: "wedding-henna",
    },
    {
      name: "Bruiloft Bedankjes — Set van 10 Mini-Lantaarns",
      slug: "bruiloft-bedankjes-mini-lantaarns",
      sku: "LAY-WED-002",
      shortDesc: "Mini-lantaarntjes als bedankje voor gasten.",
      description:
        "Set van 10 charmante mini-lantaarntjes, ideaal als bedankje voor je gasten. Elk met een theelichtje voor een warme tafelsetting.\n\n- 10 stuks\n- Hoogte ±10 cm\n- Inclusief theelichtjes",
      price: 39.95,
      images: img("bedankjes", 2),
      colors: ["Goud", "Zilver", "Brons"],
      materials: ["Metaal", "Glas"],
      tags: ["bruiloft", "bedankjes", "lantaarn", "set"],
      stock: 35,
      weight: 1200,
      newCollection: true,
      category: "wedding-henna",
    },
    {
      name: "Bruidssuiker & Amandelen — Luxe Doosjes Set",
      slug: "bruidssuiker-amandelen-doosjes",
      sku: "LAY-WED-003",
      shortDesc: "Gevulde geschenkdoosjes voor gasten.",
      description:
        "Een set verfijnde geschenkdoosjes gevuld met gesuikerde amandelen, klaar om uit te delen aan je gasten. Klassieke zoetigheid met oosterse elegantie.\n\n- 12 doosjes\n- Gevuld met gesuikerde amandelen",
      price: 29.95,
      images: img("bruidssuiker", 2),
      colors: ["Goud", "Gebroken Wit"],
      materials: ["Delicatesse"],
      tags: ["bruiloft", "bedankjes", "amandelen"],
      stock: 50,
      weight: 600,
      category: "wedding-henna",
    },

    // ---- Seasonal ----
    {
      name: "Ramadan Sfeerbox — Lantaarn & Dadels",
      slug: "ramadan-sfeerbox-lantaarn-dadels",
      sku: "LAY-SEA-001",
      shortDesc: "Seizoensbox met lantaarn, kaars & dadels.",
      description:
        "Een seizoensgebonden sfeerbox vol warmte: een sierlantaarn, een geurkaars en luxe dadels. Brengt sfeer in huis tijdens bijzondere avonden.\n\n- Sierlantaarn\n- Geurkaars\n- Luxe dadels 200 g\n- Seizoenscollectie",
      price: 59.95,
      comparePrice: 74.95,
      images: img("ramadan-box", 3),
      materials: ["Cadeaupakket"],
      tags: ["seizoen", "ramadan", "sfeerbox", "cadeau"],
      stock: 60,
      weight: 1500,
      featured: true,
      newCollection: true,
      badge: "SEIZOEN",
      category: "seasonal",
    },
    {
      name: "Eid Tafeldecoratie Set",
      slug: "eid-tafeldecoratie-set",
      sku: "LAY-SEA-002",
      shortDesc: "Complete feesttafel-aankleding.",
      description:
        "Een complete set om je feesttafel sfeervol aan te kleden: tafelloper, theelichthouders en decoratieve accenten in warme, feestelijke tinten.\n\n- Tafelloper\n- 4 theelichthouders\n- Decoratieve accenten",
      price: 44.95,
      images: img("eid-set", 2),
      colors: ["Goud", "Terracotta"],
      materials: ["Textiel", "Glas"],
      tags: ["seizoen", "eid", "tafeldecoratie"],
      stock: 45,
      weight: 1000,
      category: "seasonal",
    },
    {
      name: "Winter Warmte Box — Plaid, Kaars & Thee",
      slug: "winter-warmte-box",
      sku: "LAY-SEA-003",
      shortDesc: "Cocooning-box voor koude avonden.",
      description:
        "Een cocooning-box voor koude avonden: een zachte plaid, een warme geurkaars en losse kruidenthee. Alles om je thuis te omhullen in warmte.\n\n- Luxe plaid\n- Geurkaars\n- Kruidenthee 100 g",
      price: 69.95,
      images: img("winter-box", 2),
      materials: ["Cadeaupakket"],
      tags: ["seizoen", "winter", "cocooning", "cadeau"],
      stock: 40,
      weight: 1600,
      newCollection: true,
      category: "seasonal",
    },
  ];

  let created = 0;
  for (const p of products) {
    const { category, ...rest } = p;
    await prisma.product.upsert({
      where: { slug: p.slug },
      update: { ...rest, categoryId: categories[category].id },
      create: { ...rest, categoryId: categories[category].id },
    });
    created++;
  }
  console.log(`Created ${created} products`);

  // ---------------------------------------------------------------------------
  // Coupons
  // ---------------------------------------------------------------------------
  const coupons = [
    { code: "WELKOM10", description: "10% korting voor nieuwe klanten", discountType: "PERCENTAGE", discountValue: 10, minOrder: 30, maxUses: 1000, active: true },
    { code: "ORIENT15", description: "15% korting vanaf €75", discountType: "PERCENTAGE", discountValue: 15, minOrder: 75, maxUses: 500, active: true },
    { code: "GIFT5", description: "€5 korting op cadeaus", discountType: "FIXED", discountValue: 5, minOrder: 25, maxUses: null, active: true },
  ];
  for (const c of coupons) {
    await prisma.couponCode.upsert({ where: { code: c.code }, update: c, create: c });
  }
  console.log(`Created ${coupons.length} coupons`);

  console.log("Seeding complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
