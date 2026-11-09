import type { Database } from '../../db/Database';
import type { EntityLink, EntityRef, LinkableType } from '../../domain/admin';
import type { Clock } from '../Clock';

/** Explicit relationships between administrative entities (§133). */
export class LinkService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async link(from: EntityRef, to: EntityRef, relation = 'related'): Promise<void> {
    if (from.type === to.type && from.id === to.id) return;
    await this.db.links.link(from, to, relation, this.clock.nowISO());
  }

  unlink(from: EntityRef, to: EntityRef): Promise<void> {
    return this.db.links.unlink(from, to);
  }

  linksOf(ref: EntityRef, type?: LinkableType): Promise<EntityLink[]> {
    return this.db.links.linksOf(ref, type);
  }

  linkedIds(ref: EntityRef, type: LinkableType): Promise<string[]> {
    return this.db.links.linkedIds(ref, type);
  }

  removeAll(ref: EntityRef): Promise<void> {
    return this.db.links.removeAll(ref);
  }
}
