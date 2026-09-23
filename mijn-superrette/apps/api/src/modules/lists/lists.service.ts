import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { and, asc, count, desc, eq, gt, inArray, isNull, sql } from 'drizzle-orm';
import {
  listActivity,
  listInvites,
  listItemSelections,
  listMembers,
  productVariants,
  retailerProducts,
  shoppingListItems,
  shoppingLists,
  users,
  type Database,
} from '@superrette/database';
import type { ListMemberRole } from '@superrette/domain';
import type {
  CreateListInput,
  CreateListItemInput,
  InviteDto,
  InvitePreviewDto,
  ItemSelectionInput,
  ListActivityDto,
  ShoppingListDetailDto,
  ShoppingListDto,
  ShoppingListItemDto,
  UpdateListItemInput,
} from '@superrette/validation';
import type { AppConfig } from '../../config/config.js';
import { EntitlementsService } from '../../common/core.services.js';
import { notFound, versionConflict } from '../../common/errors.js';
import { ListEventsService } from '../../common/list-events.service.js';
import { CONFIG, DB } from '../../common/tokens.js';

type ItemRow = typeof shoppingListItems.$inferSelect;
const ROLE_RANK: Record<ListMemberRole, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 };
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
const INVITE_TTL_MS = 7 * 86_400_000;

/**
 * Shopping lists, items, household sharing and activity. Every mutation
 * checks list membership, bumps an optimistic-concurrency version and emits
 * a realtime event to all members.
 */
@Injectable()
export class ListsService {
  constructor(
    @Inject(DB) private readonly db: Database,
    @Inject(CONFIG) private readonly config: AppConfig,
    private readonly events: ListEventsService,
    private readonly entitlements: EntitlementsService,
  ) {}

  /** Membership check. Non-members get 404 so list ids do not leak. */
  async requireRole(listId: string, userId: string, minimum: ListMemberRole): Promise<ListMemberRole> {
    const [m] = await this.db
      .select({ role: listMembers.role })
      .from(listMembers)
      .where(and(eq(listMembers.listId, listId), eq(listMembers.userId, userId)));
    if (!m) throw notFound('List');
    if (ROLE_RANK[m.role] < ROLE_RANK[minimum])
      throw new ForbiddenException({ code: 'FORBIDDEN', message: `Requires ${minimum} role` });
    return m.role;
  }

  private async displayName(userId: string): Promise<string> {
    const [u] = await this.db.select({ name: users.displayName }).from(users).where(eq(users.id, userId));
    return u?.name ?? '?';
  }

  private async itemDto(row: ItemRow): Promise<ShoppingListItemDto> {
    let preferredVariantName: string | null = null;
    if (row.preferredVariantId) {
      const [v] = await this.db
        .select({ name: productVariants.displayName })
        .from(productVariants)
        .where(eq(productVariants.id, row.preferredVariantId));
      preferredVariantName = v?.name ?? null;
    }
    return {
      id: row.id,
      title: row.title,
      quantity: row.quantity,
      preferredVariantId: row.preferredVariantId,
      preferredVariantName,
      preferredBrand: row.preferredBrand,
      notes: row.notes,
      categorySlug: row.categorySlug,
      checked: row.checked,
      checkedBy: row.checkedBy,
      position: row.position,
      version: row.version,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async touch(listId: string): Promise<void> {
    await this.db
      .update(shoppingLists)
      .set({ updatedAt: new Date(), version: sql`${shoppingLists.version} + 1` })
      .where(eq(shoppingLists.id, listId));
  }

  private async activity(
    listId: string,
    userId: string,
    type: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const actorName = await this.displayName(userId);
    const [row] = await this.db
      .insert(listActivity)
      .values({ listId, userId, type, payload: { ...payload, actorName } })
      .returning();
    this.events.emit({
      listId,
      type: 'activity',
      actorId: userId,
      payload: {
        id: row!.id,
        type,
        userDisplayName: actorName,
        payload: row!.payload,
        createdAt: row!.createdAt.toISOString(),
      },
    });
  }

  // ── Lists ──────────────────────────────────────────────────────────────

  async lists(userId: string): Promise<ShoppingListDto[]> {
    const rows = await this.db
      .select({ l: shoppingLists, role: listMembers.role })
      .from(listMembers)
      .innerJoin(shoppingLists, eq(shoppingLists.id, listMembers.listId))
      .where(eq(listMembers.userId, userId))
      .orderBy(desc(shoppingLists.updatedAt));
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.l.id);
    const itemCounts = await this.db
      .select({
        listId: shoppingListItems.listId,
        total: count(),
        checked: sql<number>`count(*) filter (where ${shoppingListItems.checked})::int`,
      })
      .from(shoppingListItems)
      .where(inArray(shoppingListItems.listId, ids))
      .groupBy(shoppingListItems.listId);
    const memberCounts = await this.db
      .select({ listId: listMembers.listId, n: count() })
      .from(listMembers)
      .where(inArray(listMembers.listId, ids))
      .groupBy(listMembers.listId);
    return rows.map(({ l, role }) => {
      const c = itemCounts.find((x) => x.listId === l.id);
      return {
        id: l.id,
        name: l.name,
        kind: l.kind,
        icon: l.icon,
        role,
        itemCount: c?.total ?? 0,
        checkedCount: c?.checked ?? 0,
        memberCount: memberCounts.find((x) => x.listId === l.id)?.n ?? 1,
        updatedAt: l.updatedAt.toISOString(),
      };
    });
  }

  async create(userId: string, input: CreateListInput): Promise<ShoppingListDto> {
    const [{ value: owned } = { value: 0 }] = await this.db
      .select({ value: count() })
      .from(shoppingLists)
      .where(eq(shoppingLists.ownerId, userId));
    await this.entitlements.requireWithinLimit(userId, 'shopping_lists', owned);
    const list = await this.db.transaction(async (tx) => {
      const [l] = await tx
        .insert(shoppingLists)
        .values({ ownerId: userId, name: input.name, kind: input.kind, icon: input.icon ?? null })
        .returning();
      await tx.insert(listMembers).values({ listId: l!.id, userId, role: 'OWNER' });
      return l!;
    });
    return (await this.lists(userId)).find((l) => l.id === list.id)!;
  }

  async detail(listId: string, userId: string): Promise<ShoppingListDetailDto> {
    await this.requireRole(listId, userId, 'VIEWER');
    const summary = (await this.lists(userId)).find((l) => l.id === listId);
    if (!summary) throw notFound('List');
    const items = await this.db
      .select()
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, listId))
      .orderBy(asc(shoppingListItems.checked), asc(shoppingListItems.position), asc(shoppingListItems.createdAt));
    const members = await this.db
      .select({ userId: listMembers.userId, displayName: users.displayName, role: listMembers.role })
      .from(listMembers)
      .innerJoin(users, eq(users.id, listMembers.userId))
      .where(eq(listMembers.listId, listId))
      .orderBy(asc(listMembers.joinedAt));
    return { ...summary, items: await Promise.all(items.map((i) => this.itemDto(i))), members };
  }

  async rename(listId: string, userId: string, input: Partial<CreateListInput>): Promise<ShoppingListDto> {
    await this.requireRole(listId, userId, 'EDITOR');
    await this.db
      .update(shoppingLists)
      .set({
        ...(input.name ? { name: input.name } : {}),
        ...(input.kind ? { kind: input.kind } : {}),
        ...(input.icon !== undefined ? { icon: input.icon } : {}),
        updatedAt: new Date(),
      })
      .where(eq(shoppingLists.id, listId));
    const dto = (await this.lists(userId)).find((l) => l.id === listId)!;
    this.events.emit({ listId, type: 'list.updated', actorId: userId, payload: { list: dto } });
    return dto;
  }

  async remove(listId: string, userId: string): Promise<void> {
    await this.requireRole(listId, userId, 'OWNER');
    await this.db.delete(shoppingLists).where(eq(shoppingLists.id, listId));
    this.events.emit({ listId, type: 'list.deleted', actorId: userId, payload: {} });
  }

  // ── Items ──────────────────────────────────────────────────────────────

  async addItem(listId: string, userId: string, input: CreateListItemInput): Promise<ShoppingListItemDto> {
    await this.requireRole(listId, userId, 'EDITOR');
    const [{ max } = { max: 0 }] = await this.db
      .select({ max: sql<number>`coalesce(max(${shoppingListItems.position}), -1)::int + 1` })
      .from(shoppingListItems)
      .where(eq(shoppingListItems.listId, listId));
    const [row] = await this.db
      .insert(shoppingListItems)
      .values({
        listId,
        title: input.title,
        quantity: input.quantity,
        preferredVariantId: input.preferredVariantId ?? null,
        preferredBrand: input.preferredBrand ?? null,
        notes: input.notes ?? null,
        categorySlug: input.categorySlug ?? null,
        position: max,
        createdBy: userId,
        updatedBy: userId,
      })
      .returning();
    const dto = await this.itemDto(row!);
    await this.touch(listId);
    this.events.emit({ listId, type: 'item.upserted', actorId: userId, payload: { item: dto } });
    await this.activity(listId, userId, 'ITEM_ADDED', { item: dto.title });
    return dto;
  }

  /**
   * Optimistic concurrency: the client sends the version it last saw. A stale
   * version returns 409 with the current item so the client can reconcile.
   */
  async updateItem(
    listId: string,
    itemId: string,
    userId: string,
    input: UpdateListItemInput,
  ): Promise<ShoppingListItemDto> {
    await this.requireRole(listId, userId, 'EDITOR');
    const now = new Date();
    const [row] = await this.db
      .update(shoppingListItems)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.quantity !== undefined ? { quantity: input.quantity } : {}),
        ...(input.preferredVariantId !== undefined ? { preferredVariantId: input.preferredVariantId } : {}),
        ...(input.preferredBrand !== undefined ? { preferredBrand: input.preferredBrand } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.categorySlug !== undefined ? { categorySlug: input.categorySlug } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
        ...(input.checked !== undefined
          ? { checked: input.checked, checkedBy: input.checked ? userId : null, checkedAt: input.checked ? now : null }
          : {}),
        version: sql`${shoppingListItems.version} + 1`,
        updatedBy: userId,
        updatedAt: now,
      })
      .where(
        and(
          eq(shoppingListItems.id, itemId),
          eq(shoppingListItems.listId, listId),
          eq(shoppingListItems.version, input.version),
        ),
      )
      .returning();
    if (!row) {
      const [current] = await this.db
        .select()
        .from(shoppingListItems)
        .where(and(eq(shoppingListItems.id, itemId), eq(shoppingListItems.listId, listId)));
      if (!current) throw notFound('Item');
      throw versionConflict(await this.itemDto(current));
    }
    // A different preferred product invalidates per-retailer product choices.
    if (input.preferredVariantId !== undefined)
      await this.db.delete(listItemSelections).where(eq(listItemSelections.itemId, itemId));
    const dto = await this.itemDto(row);
    await this.touch(listId);
    this.events.emit({ listId, type: 'item.upserted', actorId: userId, payload: { item: dto } });
    if (input.checked !== undefined)
      await this.activity(listId, userId, input.checked ? 'ITEM_CHECKED' : 'ITEM_UNCHECKED', { item: dto.title });
    return dto;
  }

  async deleteItem(listId: string, itemId: string, userId: string): Promise<void> {
    await this.requireRole(listId, userId, 'EDITOR');
    const [row] = await this.db
      .delete(shoppingListItems)
      .where(and(eq(shoppingListItems.id, itemId), eq(shoppingListItems.listId, listId)))
      .returning();
    if (!row) throw notFound('Item');
    await this.touch(listId);
    this.events.emit({ listId, type: 'item.deleted', actorId: userId, payload: { itemId } });
    await this.activity(listId, userId, 'ITEM_REMOVED', { item: row.title });
  }

  /** "Wijzig product": choose the retailer product for an item at one retailer (null resets). */
  async setSelection(listId: string, itemId: string, userId: string, input: ItemSelectionInput): Promise<void> {
    await this.requireRole(listId, userId, 'EDITOR');
    const [item] = await this.db
      .select({ id: shoppingListItems.id })
      .from(shoppingListItems)
      .where(and(eq(shoppingListItems.id, itemId), eq(shoppingListItems.listId, listId)));
    if (!item) throw notFound('Item');
    if (input.retailerProductId === null) {
      await this.db
        .delete(listItemSelections)
        .where(and(eq(listItemSelections.itemId, itemId), eq(listItemSelections.retailerId, input.retailerId)));
    } else {
      const [rp] = await this.db
        .select({ retailerId: retailerProducts.retailerId })
        .from(retailerProducts)
        .where(eq(retailerProducts.id, input.retailerProductId));
      if (!rp || rp.retailerId !== input.retailerId)
        throw new NotFoundException({ code: 'NOT_FOUND', message: 'Retailer product not found for this retailer' });
      await this.db
        .insert(listItemSelections)
        .values({
          itemId,
          retailerId: input.retailerId,
          retailerProductId: input.retailerProductId,
          selectedBy: userId,
        })
        .onConflictDoUpdate({
          target: [listItemSelections.itemId, listItemSelections.retailerId],
          set: { retailerProductId: input.retailerProductId, selectedBy: userId, createdAt: new Date() },
        });
    }
    await this.touch(listId);
    this.events.emit({ listId, type: 'list.updated', actorId: userId, payload: { reason: 'selection' } });
  }

  async selections(listId: string): Promise<Map<string, string>> {
    const rows = await this.db
      .select({
        itemId: listItemSelections.itemId,
        retailerId: listItemSelections.retailerId,
        rp: listItemSelections.retailerProductId,
      })
      .from(listItemSelections)
      .innerJoin(shoppingListItems, eq(shoppingListItems.id, listItemSelections.itemId))
      .where(eq(shoppingListItems.listId, listId));
    return new Map(rows.map((r) => [`${r.itemId}:${r.retailerId}`, r.rp]));
  }

  async activityFeed(listId: string, userId: string): Promise<ListActivityDto[]> {
    await this.requireRole(listId, userId, 'VIEWER');
    const rows = await this.db
      .select()
      .from(listActivity)
      .where(eq(listActivity.listId, listId))
      .orderBy(desc(listActivity.createdAt))
      .limit(50);
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      userDisplayName: typeof r.payload.actorName === 'string' ? r.payload.actorName : null,
      payload: r.payload,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  // ── Sharing ────────────────────────────────────────────────────────────

  async createInvite(listId: string, userId: string, role: 'EDITOR' | 'VIEWER'): Promise<InviteDto> {
    await this.requireRole(listId, userId, 'OWNER');
    await this.entitlements.require(userId, 'shared_lists');
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    await this.db.insert(listInvites).values({ listId, tokenHash: sha256(token), role, createdBy: userId, expiresAt });
    return { token, url: `${this.config.publicAppUrl}/invite/${token}`, expiresAt: expiresAt.toISOString() };
  }

  private async findInvite(token: string) {
    const [invite] = await this.db
      .select({ i: listInvites, listName: shoppingLists.name, invitedBy: users.displayName })
      .from(listInvites)
      .innerJoin(shoppingLists, eq(shoppingLists.id, listInvites.listId))
      .innerJoin(users, eq(users.id, listInvites.createdBy))
      .where(eq(listInvites.tokenHash, sha256(token)));
    return invite;
  }

  async previewInvite(token: string): Promise<InvitePreviewDto> {
    const invite = await this.findInvite(token);
    if (!invite) throw notFound('Invite');
    const valid = !invite.i.acceptedAt && !invite.i.revokedAt && invite.i.expiresAt > new Date();
    return {
      listId: invite.i.listId,
      listName: invite.listName,
      invitedBy: invite.invitedBy,
      role: invite.i.role,
      valid,
    };
  }

  /** Single-use invitation: accepting it atomically consumes it. */
  async acceptInvite(token: string, userId: string): Promise<ShoppingListDto> {
    const listId = await this.db.transaction(async (tx) => {
      const [consumed] = await tx
        .update(listInvites)
        .set({ acceptedBy: userId, acceptedAt: new Date() })
        .where(
          and(
            eq(listInvites.tokenHash, sha256(token)),
            isNull(listInvites.acceptedAt),
            isNull(listInvites.revokedAt),
            gt(listInvites.expiresAt, new Date()),
          ),
        )
        .returning();
      if (!consumed) throw new NotFoundException({ code: 'INVITE_INVALID', message: 'Invite expired or already used' });
      await tx
        .insert(listMembers)
        .values({ listId: consumed.listId, userId, role: consumed.role })
        .onConflictDoNothing();
      return consumed.listId;
    });
    await this.activity(listId, userId, 'MEMBER_JOINED', {});
    this.events.emit({ listId, type: 'member.joined', actorId: userId, payload: { userId } });
    return (await this.lists(userId)).find((l) => l.id === listId)!;
  }

  /** Owner removes a member, or a member leaves. The owner cannot leave (delete or transfer instead). */
  async removeMember(listId: string, memberId: string, userId: string): Promise<void> {
    const role = await this.requireRole(listId, userId, 'VIEWER');
    if (memberId !== userId && role !== 'OWNER')
      throw new ForbiddenException({ code: 'FORBIDDEN', message: 'Only the owner can remove members' });
    const [target] = await this.db
      .select({ role: listMembers.role })
      .from(listMembers)
      .where(and(eq(listMembers.listId, listId), eq(listMembers.userId, memberId)));
    if (!target) throw notFound('Member');
    if (target.role === 'OWNER')
      throw new ForbiddenException({ code: 'OWNER_CANNOT_LEAVE', message: 'The owner cannot leave the list' });
    await this.db.delete(listMembers).where(and(eq(listMembers.listId, listId), eq(listMembers.userId, memberId)));
    this.events.emit({ listId, type: 'member.left', actorId: userId, payload: { userId: memberId } });
  }
}
