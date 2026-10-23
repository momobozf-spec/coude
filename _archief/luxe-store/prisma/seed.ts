import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

// SQLite client. Schema stores `images` as a JSON-encoded string, so we
// stringify here at write time.
const adapter = new PrismaLibSQL({ url: process.env.DATABASE_URL || "file:./prisma/dev.db" });
const raw = new PrismaClient({ adapter });
function stringifyArrays<T extends Record<string, unknown>>(d: T): T {
  const out: Record<string, unknown> = { ...d };
  if (Array.isArray(out.images)) out.images = JSON.stringify(out.images);
  return out as T;
}
const prisma = raw.$extends({
  query: {
    product: {
      async create({ args, query }) { args.data = stringifyArrays(args.data as Record<string, unknown>) as typeof args.data; return query(args); },
      async upsert({ args, query }) {
        args.create = stringifyArrays(args.create as Record<string, unknown>) as typeof args.create;
        args.update = stringifyArrays(args.update as Record<string, unknown>) as typeof args.update;
        return query(args);
      },
      async createMany({ args, query }) {
        if (Array.isArray(args.data)) args.data = args.data.map((d) => stringifyArrays(d as Record<string, unknown>)) as typeof args.data;
        return query(args);
      },
    },
  },
});

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123456", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@luxestore.com" },
    update: {},
    create: {
      email: "admin@luxestore.com",
      name: "Admin",
      password: adminPassword,
      role: "ADMIN",
    },
  });
  console.log("Created admin user:", admin.email);

  // Create categories
  const categories = await Promise.all([
    prisma.category.upsert({
      where: { slug: "clothing" },
      update: {},
      create: {
        name: "Clothing",
        slug: "clothing",
        description: "Premium clothing for every occasion",
        image:
          "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80",
      },
    }),
    prisma.category.upsert({
      where: { slug: "accessories" },
      update: {},
      create: {
        name: "Accessories",
        slug: "accessories",
        description: "Curated accessories to complete your look",
        image:
          "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
      },
    }),
    prisma.category.upsert({
      where: { slug: "home" },
      update: {},
      create: {
        name: "Home",
        slug: "home",
        description: "Elevate your living space",
        image:
          "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=800&q=80",
      },
    }),
    prisma.category.upsert({
      where: { slug: "electronics" },
      update: {},
      create: {
        name: "Electronics",
        slug: "electronics",
        description: "Premium tech for modern living",
        image:
          "https://images.unsplash.com/photo-1468495244123-6c6c332eeece?w=800&q=80",
      },
    }),
  ]);
  console.log(`Created ${categories.length} categories`);

  // Create products
  const products = [
    {
      name: "Merino Wool Sweater",
      slug: "merino-wool-sweater",
      description:
        "Crafted from the finest Australian merino wool, this sweater offers unparalleled softness and warmth. Features a relaxed fit with ribbed cuffs and hem. Machine washable for easy care.\n\nPerfect for layering or wearing on its own during cooler months.",
      price: 189.0,
      comparePrice: 249.0,
      images: [
        "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=800&q=80",
        "https://images.unsplash.com/photo-1576566588028-4147f3842f27?w=800&q=80",
      ],
      stock: 45,
      featured: true,
      categoryId: categories[0].id,
    },
    {
      name: "Classic Leather Belt",
      slug: "classic-leather-belt",
      description:
        "Hand-stitched Italian leather belt with brushed silver buckle. 35mm width, perfect for both casual and formal wear. Develops a beautiful patina over time.",
      price: 95.0,
      images: [
        "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80",
      ],
      stock: 80,
      featured: true,
      categoryId: categories[1].id,
    },
    {
      name: "Minimalist Watch",
      slug: "minimalist-watch",
      description:
        "Swiss-made quartz movement in a sleek 40mm stainless steel case. Sapphire crystal glass, genuine leather strap. Water resistant to 50m. A timeless piece for any collection.",
      price: 295.0,
      comparePrice: 395.0,
      images: [
        "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&q=80",
        "https://images.unsplash.com/photo-1524805444758-089113d48a6d?w=800&q=80",
      ],
      stock: 25,
      featured: true,
      categoryId: categories[1].id,
    },
    {
      name: "Ceramic Vase Set",
      slug: "ceramic-vase-set",
      description:
        "Set of 3 handcrafted ceramic vases in neutral tones. Each piece is unique with subtle variations in glaze. Perfect for fresh or dried arrangements.",
      price: 129.0,
      images: [
        "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=800&q=80",
      ],
      stock: 30,
      featured: true,
      categoryId: categories[2].id,
    },
    {
      name: "Linen Blend Trousers",
      slug: "linen-blend-trousers",
      description:
        "Relaxed-fit trousers in a luxe linen-cotton blend. Drawstring waist with elasticated back. Side pockets and one rear pocket. Perfect for warm weather.",
      price: 145.0,
      images: [
        "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80",
      ],
      stock: 60,
      featured: false,
      categoryId: categories[0].id,
    },
    {
      name: "Wireless Headphones",
      slug: "wireless-headphones",
      description:
        "Premium over-ear headphones with active noise cancellation. 30-hour battery life, USB-C charging. Memory foam ear cushions for all-day comfort. Hi-Res Audio certified.",
      price: 349.0,
      comparePrice: 449.0,
      images: [
        "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&q=80",
        "https://images.unsplash.com/photo-1484704849700-f032a568e944?w=800&q=80",
      ],
      stock: 40,
      featured: true,
      categoryId: categories[3].id,
    },
    {
      name: "Cotton Cashmere Scarf",
      slug: "cotton-cashmere-scarf",
      description:
        "Lightweight scarf in a premium cotton-cashmere blend. Generously sized for versatile styling. Finished with subtle fringe edges.",
      price: 85.0,
      images: [
        "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800&q=80",
      ],
      stock: 70,
      featured: false,
      categoryId: categories[1].id,
    },
    {
      name: "Aromatherapy Candle",
      slug: "aromatherapy-candle",
      description:
        "Hand-poured soy wax candle with essential oils of lavender, eucalyptus, and cedarwood. 60-hour burn time in a reusable ceramic vessel.",
      price: 48.0,
      images: [
        "https://images.unsplash.com/photo-1602028915047-37269d1a73f7?w=800&q=80",
      ],
      stock: 100,
      featured: true,
      categoryId: categories[2].id,
    },
    {
      name: "Portable Speaker",
      slug: "portable-speaker",
      description:
        "Compact Bluetooth speaker with surprisingly powerful 360-degree sound. Waterproof (IPX7), 12-hour battery life. Pairs with a second speaker for stereo sound.",
      price: 179.0,
      images: [
        "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800&q=80",
      ],
      stock: 55,
      featured: false,
      categoryId: categories[3].id,
    },
    {
      name: "Oversized Blazer",
      slug: "oversized-blazer",
      description:
        "Structured yet relaxed blazer in premium Italian wool. Single-breasted with notch lapels. Lined in silk. An effortlessly chic wardrobe staple.",
      price: 395.0,
      comparePrice: 495.0,
      images: [
        "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80",
      ],
      stock: 20,
      featured: true,
      categoryId: categories[0].id,
    },
    {
      name: "Throw Blanket",
      slug: "throw-blanket",
      description:
        "Oversized knit throw in 100% organic cotton. 150x200cm. Machine washable. Available in a range of neutral tones to complement any interior.",
      price: 165.0,
      images: [
        "https://images.unsplash.com/photo-1580301762395-21ce6d5d4bc4?w=800&q=80",
      ],
      stock: 35,
      featured: false,
      categoryId: categories[2].id,
    },
    {
      name: "Sunglasses",
      slug: "sunglasses",
      description:
        "Handcrafted acetate frame with polarized lenses. UV400 protection. Comes with a premium leather case. Timeless design for everyday wear.",
      price: 225.0,
      images: [
        "https://images.unsplash.com/photo-1572635196237-14b3f281503f?w=800&q=80",
      ],
      stock: 50,
      featured: true,
      categoryId: categories[1].id,
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { slug: product.slug },
      update: {},
      create: product,
    });
  }
  console.log(`Created ${products.length} products`);

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
