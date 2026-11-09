/**
 * De enige plek waar de Prisma-implementaties aan elkaar geknoopt worden.
 * Services vragen om `Repositories`, niet om deze functie — zodat een test
 * dezelfde services met in-memory implementaties kan draaien.
 */
import { prisma } from "../prisma.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import type { Repositories } from "./interfaces.js";
import { PrismaUserRepository } from "./prisma/userRepository.js";
import { PrismaSearchRepository } from "./prisma/searchRepository.js";
import { PrismaSearchRunRepository } from "./prisma/searchRunRepository.js";
import { PrismaPropertyRepository } from "./prisma/propertyRepository.js";
import { PrismaSearchMatchRepository } from "./prisma/searchMatchRepository.js";
import { PrismaNotificationRepository } from "./prisma/notificationRepository.js";

export function createRepositories(client: PrismaClient = prisma): Repositories {
  return {
    users: new PrismaUserRepository(client),
    searches: new PrismaSearchRepository(client),
    searchRuns: new PrismaSearchRunRepository(client),
    properties: new PrismaPropertyRepository(client),
    matches: new PrismaSearchMatchRepository(client),
    notifications: new PrismaNotificationRepository(client),
  };
}

export type { Repositories } from "./interfaces.js";
