/**
 * Loads everything under content/ into the database.
 *
 * The content folder is the source of truth: this script never invents data, it
 * only validates and mirrors. Validation happens BEFORE any write, so a broken
 * payload fails the seed instead of shipping a game that crashes for a child.
 *
 *   npm run seed
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { PrismaClient, type AssetKind, type GameEngine } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  contentGameSchema,
  contentPackSchema,
  findIncompleteTranslations,
} from "../src/lib/content-schemas";
import { checkGameInvariants, parseGameData } from "../src/lib/game-schemas";

const db = new PrismaClient();
const CONTENT_DIR = resolve(process.cwd(), "content");

const DEMO_EMAIL = "demo@noorclub.app";
const DEMO_PASSWORD = "Test1234!";

class SeedError extends Error {}

/**
 * A pack opens on the first of its own month, always.
 *
 * Deriving this instead of reading it from the JSON is what keeps the monthly
 * rhythm honest: a date nudged forward once to make something testable is
 * exactly the kind of edit that survives into production and opens September's
 * pack in August.
 */
function releaseDateFor(pack: { year: number; month: number }): Date {
  const override = process.env.SEED_RELEASE_OVERRIDE === "true";

  if (override) {
    if (process.env.NODE_ENV === "production") {
      throw new SeedError(
        "SEED_RELEASE_OVERRIDE mag niet aanstaan in productie — dat opent elk pakket meteen en breekt het maandritme.",
      );
    }
    // Everything open, for local work and for demos. Never reachable in prod.
    return new Date(0);
  }

  return new Date(Date.UTC(pack.year, pack.month - 1, 1, 0, 0, 0, 0));
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as unknown;
  } catch (error) {
    throw new SeedError(`${path} is geen geldige JSON: ${String(error)}`);
  }
}

function loadPack(dir: string) {
  const packPath = join(CONTENT_DIR, dir, "pack.json");
  const parsed = contentPackSchema.safeParse(readJson(packPath));

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new SeedError(
      `${packPath}: ${issue ? `${issue.path.join(".")} — ${issue.message}` : "ongeldig"}`,
    );
  }

  const gamesDir = join(CONTENT_DIR, dir, "games");
  const gameFiles = readdirSync(gamesDir).filter((file) => file.endsWith(".json"));

  const games = gameFiles.map((file) => {
    const gamePath = join(gamesDir, file);
    const result = contentGameSchema.safeParse(readJson(gamePath));

    if (!result.success) {
      const issue = result.error.issues[0];
      throw new SeedError(
        `${gamePath}: ${issue ? `${issue.path.join(".")} — ${issue.message}` : "ongeldig"}`,
      );
    }

    // The payload must satisfy its engine's schema *and* the cross-field
    // invariants (correctIndex in range, wordbuild letters sufficient, ...).
    const payload = parseGameData(result.data.engine, result.data.data);
    const invariant = checkGameInvariants(payload);
    if (invariant !== null) {
      throw new SeedError(`${gamePath}: ${invariant}`);
    }

    const incomplete = findIncompleteTranslations(result.data.data);
    if (incomplete.length > 0) {
      throw new SeedError(`${gamePath}: onvolledige vertalingen — ${incomplete.join("; ")}`);
    }

    return result.data;
  });

  if (games.length === 0) {
    throw new SeedError(`${gamesDir}: geen spellen gevonden`);
  }

  const duplicateSlugs = games
    .map((game) => game.slug)
    .filter((slug, index, all) => all.indexOf(slug) !== index);
  if (duplicateSlugs.length > 0) {
    throw new SeedError(`${dir}: dubbele game slug ${duplicateSlugs.join(", ")}`);
  }

  return { pack: parsed.data, games };
}

async function seedPack(dir: string) {
  const { pack, games } = loadPack(dir);

  const packRow = await db.pack.upsert({
    where: { slug: pack.slug },
    create: {
      slug: pack.slug,
      month: pack.month,
      year: pack.year,
      releaseAt: releaseDateFor(pack),
      isFree: pack.isFree,
      titles: pack.titles,
      descriptions: pack.descriptions,
      coverUrl: pack.coverUrl,
    },
    update: {
      month: pack.month,
      year: pack.year,
      releaseAt: releaseDateFor(pack),
      isFree: pack.isFree,
      titles: pack.titles,
      descriptions: pack.descriptions,
      coverUrl: pack.coverUrl,
    },
  });

  // Assets carry no child progress, so replacing them wholesale is safe and
  // keeps the database an exact mirror of the folder.
  await db.asset.deleteMany({ where: { packId: packRow.id } });
  for (const asset of pack.assets) {
    await db.asset.create({
      data: {
        kind: asset.kind as AssetKind,
        titles: asset.titles,
        fileUrl: asset.fileUrl,
        ageBand: asset.ageBand,
        packId: packRow.id,
      },
    });
  }

  for (const badge of pack.badges) {
    await db.badge.upsert({
      where: { slug: badge.slug },
      create: {
        slug: badge.slug,
        titles: badge.titles,
        iconUrl: badge.iconUrl,
        packId: packRow.id,
      },
      update: {
        titles: badge.titles,
        iconUrl: badge.iconUrl,
        packId: packRow.id,
      },
    });
  }

  // Games are upserted rather than replaced: deleting a Game cascades to
  // GamePlay, which would erase every child's history on a re-seed.
  for (const game of games) {
    await db.game.upsert({
      where: { slug: game.slug },
      create: {
        slug: game.slug,
        engine: game.engine as GameEngine,
        titles: game.titles,
        ageBand: game.ageBand,
        xp: game.xp,
        order: game.order,
        data: game.data as object,
        packId: packRow.id,
      },
      update: {
        engine: game.engine as GameEngine,
        titles: game.titles,
        ageBand: game.ageBand,
        xp: game.xp,
        order: game.order,
        data: game.data as object,
        packId: packRow.id,
      },
    });
  }

  await db.game.deleteMany({
    where: { packId: packRow.id, slug: { notIn: games.map((game) => game.slug) } },
  });

  console.log(
    `  ✔ ${pack.slug} — ${games.length} spellen, ${pack.assets.length} assets, ${pack.badges.length} badge(s)${pack.isFree ? ", gratis" : ""}`,
  );
}

async function seedDemoUser() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  const user = await db.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      name: "Demo ouder",
      passwordHash,
      locale: "nl",
    },
    update: { passwordHash },
  });

  const children = [
    { name: "Yusuf", avatar: "fox", ageBand: "4-6" },
    { name: "Maryam", avatar: "owl", ageBand: "7-9" },
  ];

  for (const child of children) {
    const existing = await db.child.findFirst({
      where: { userId: user.id, name: child.name },
      select: { id: true },
    });

    if (existing) {
      await db.child.update({ where: { id: existing.id }, data: child });
    } else {
      await db.child.create({ data: { ...child, userId: user.id } });
    }
  }

  console.log(`  ✔ ${DEMO_EMAIL} / ${DEMO_PASSWORD} — ${children.length} kinderen`);
}

async function main() {
  console.log("Noor Club seed");

  const dirs = readdirSync(CONTENT_DIR)
    .filter((entry) => statSync(join(CONTENT_DIR, entry)).isDirectory())
    .sort();

  if (dirs.length === 0) {
    throw new SeedError("content/ is leeg");
  }

  console.log(`\nPakketten (${dirs.length}):`);
  for (const dir of dirs) {
    await seedPack(dir);
  }

  console.log("\nTestgebruiker:");
  await seedDemoUser();

  console.log("\nKlaar.");
}

main()
  .catch((error: unknown) => {
    if (error instanceof SeedError) {
      console.error(`\nSeed afgebroken: ${error.message}`);
    } else {
      console.error("\nSeed mislukt:", error);
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
