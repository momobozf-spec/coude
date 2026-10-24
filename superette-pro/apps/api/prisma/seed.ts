/**
 * Vult de database met één winkel, één scanner en een realistische catalogus.
 *
 *   npm run db:seed
 *
 * De device-sleutel wordt platte tekst afgedrukt: die hoort op de scanner,
 * alleen de SHA-256 gaat de database in.
 */
import { PrismaClient } from '@prisma/client';
import { isValidEan } from '../src/catalog/ean';

import { DEV_DEVICE_KEY, hashDeviceKey } from '../src/gate/dev-device-key';

// Demo-winkel met een publieke sleutel: nooit in productie. De API weigert ook
// te starten zolang een winkel deze sleutel gebruikt (`DevDeviceKeyCheck`).
if (process.env['NODE_ENV'] === 'production') {
  console.error('db:seed is een demo-seed (boetiek, publieke dev-scannersleutel) en draait niet met NODE_ENV=production.');
  process.exit(1);
}

const prisma = new PrismaClient();

const DEVICE_KEY = DEV_DEVICE_KEY;

async function main(): Promise<void> {
  const store = await prisma.store.upsert({
    where: { slug: 'antwerpen-zuid' },
    update: {},
    create: {
      name: 'Jamal & Jamila — Antwerpen Zuid',
      slug: 'antwerpen-zuid',
      address: 'Volkstraat 42',
      city: 'Antwerpen',
      vatNumber: 'BE 0123.456.789',
      mqttTopicPrefix: 'store/antwerpen-zuid',
      deviceKeyHash: hashDeviceKey(DEVICE_KEY),
      opensAtMinute: 6 * 60, // 06:00
      closesAtMinute: 23 * 60, // 23:00
      maxOccupancy: 6,
      // Blijft `false` zolang we op e-mail + wachtwoord draaien. Zet aan zodra
      // itsme aangesloten is — dan weigert de gate iedereen zonder sterke identiteit.
      requiresVerifiedIdentity: false,
    },
  });

  const categories = await Promise.all(
    [
      { slug: 'skincare', nameNl: 'Huidverzorging', nameFr: 'Soins de la peau', sortOrder: 1 },
      { slug: 'interieur', nameNl: 'Interieur', nameFr: 'Décoration', sortOrder: 2 },
      { slug: 'gift-sets', nameNl: 'Geschenksets', nameFr: 'Coffrets cadeaux', sortOrder: 3 },
      { slug: 'delicatessen', nameNl: 'Delicatessen', nameFr: 'Épicerie fine', sortOrder: 4 },
    ].map((data) => prisma.category.upsert({ where: { slug: data.slug }, update: {}, create: data })),
  );

  const bySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  /**
   * Let op de BTW-tarieven. Skincare, decoratie en kaarsen: 21%. Voeding: 6%.
   * Dit is exact waarom `vat` op het product zit en niet op de categorie — de
   * geschenkset hieronder bevat allebei en moet één tarief kiezen (21%, want de
   * hoofdzaak van de levering is cosmetica).
   */
  const products = [
    {
      sku: 'JJ-SK-001',
      barcode: '5412345000013',
      nameNl: 'Arganolie Serum — 30 ml',
      nameFr: 'Sérum à l’huile d’argan — 30 ml',
      priceInclCents: 3450,
      vat: 'VAT_21' as const,
      categoryId: bySlug['skincare']!,
    },
    {
      sku: 'JJ-SK-002',
      barcode: '5412345000020',
      nameNl: 'Rozenwater Tonic — 100 ml',
      nameFr: 'Tonique à l’eau de rose — 100 ml',
      priceInclCents: 1995,
      vat: 'VAT_21' as const,
      categoryId: bySlug['skincare']!,
    },
    {
      sku: 'JJ-SK-003',
      barcode: '5412345000037',
      nameNl: 'Ghassoul Kleimasker — 200 g',
      nameFr: 'Masque à l’argile Ghassoul — 200 g',
      priceInclCents: 2250,
      vat: 'VAT_21' as const,
      categoryId: bySlug['skincare']!,
    },
    {
      sku: 'JJ-IN-001',
      barcode: '5412345000044',
      nameNl: 'Geurkaars Oud & Amber',
      nameFr: 'Bougie parfumée Oud & Ambre',
      priceInclCents: 1250,
      vat: 'VAT_21' as const,
      categoryId: bySlug['interieur']!,
    },
    {
      sku: 'JJ-IN-002',
      barcode: '5412345000051',
      nameNl: 'Handgedreven Messing Theeglas',
      nameFr: 'Verre à thé en laiton martelé',
      priceInclCents: 1850,
      vat: 'VAT_21' as const,
      categoryId: bySlug['interieur']!,
    },
    {
      sku: 'JJ-GS-001',
      barcode: '5412345000068',
      nameNl: 'Geschenkset “Layali” — Serum & Kaars',
      nameFr: 'Coffret « Layali » — Sérum & Bougie',
      priceInclCents: 4500,
      vat: 'VAT_21' as const,
      categoryId: bySlug['gift-sets']!,
    },
    // Voeding: 6%. Dit is de reden dat een kasbon twee BTW-blokken kan hebben.
    {
      sku: 'JJ-DE-001',
      barcode: '5412345000075',
      nameNl: 'Medjoul Dadels — 250 g',
      nameFr: 'Dattes Medjoul — 250 g',
      priceInclCents: 795,
      vat: 'VAT_6' as const,
      categoryId: bySlug['delicatessen']!,
    },
    {
      sku: 'JJ-DE-002',
      barcode: '5412345000082',
      nameNl: 'Muntthee — 100 g',
      nameFr: 'Thé à la menthe — 100 g',
      priceInclCents: 650,
      vat: 'VAT_6' as const,
      categoryId: bySlug['delicatessen']!,
    },
  ];

  // De catalogus weigert barcodes met een fout controlecijfer, dus de seed mag
  // ze niet aanleveren. Zonder deze check schrijf je een product weg dat je
  // daarna nooit meer kunt scannen.
  for (const product of products) {
    if (!isValidEan(product.barcode)) {
      throw new Error(`Seed bevat een ongeldige EAN-13: ${product.barcode} (${product.sku})`);
    }
  }

  for (const product of products) {
    const created = await prisma.product.upsert({
      where: { sku: product.sku },
      // Wél bijwerken, niet `{}`: anders houdt een bestaande rij zijn oude
      // barcode en prijs, en draai je de seed voor niets.
      update: {
        barcode: product.barcode,
        nameNl: product.nameNl,
        nameFr: product.nameFr,
        priceInclCents: product.priceInclCents,
        vat: product.vat,
        active: true,
      },
      create: product,
    });

    await prisma.inventory.upsert({
      where: { storeId_productId: { storeId: store.id, productId: created.id } },
      update: {},
      create: { storeId: store.id, productId: created.id, quantity: 25 },
    });
  }

  console.log(`\n✓ Winkel:     ${store.name}`);
  console.log(`  storeId:    ${store.id}`);
  console.log(`  DEVICE_KEY: ${DEVICE_KEY}`);
  console.log(`\n✓ ${products.length} producten, ${categories.length} categorieën, voorraad 25/stuk\n`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
