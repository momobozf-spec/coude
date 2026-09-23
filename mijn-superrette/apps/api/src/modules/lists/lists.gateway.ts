import { Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { TokenService, type AuthUser } from '../../common/auth.js';
import { ListEventsService } from '../../common/list-events.service.js';
import { ListsService } from './lists.service.js';

/**
 * Realtime shared lists over Socket.IO (namespace /realtime).
 * Clients authenticate with their access token and join `list:<id>` rooms
 * after a membership check. Every list mutation is broadcast to the room;
 * with Redis configured, the Socket.IO Redis adapter fans out across API
 * instances.
 */
@WebSocketGateway({ namespace: '/realtime', cors: { origin: true, credentials: true } })
export class ListsGateway implements OnGatewayConnection, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('ListsGateway');
  @WebSocketServer() server!: Namespace;
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly tokens: TokenService,
    private readonly lists: ListsService,
    private readonly events: ListEventsService,
  ) {}

  onModuleInit(): void {
    this.unsubscribe = this.events.subscribe((event) => {
      if (!this.server) return;
      this.server.to(`list:${event.listId}`).emit(event.type, { listId: event.listId, actorId: event.actorId, ...event.payload });
      // Removed members stop receiving updates immediately.
      if (event.type === 'member.left' && typeof event.payload.userId === 'string') {
        this.server.in(`user:${event.payload.userId}`).socketsLeave(`list:${event.listId}`);
      }
      if (event.type === 'list.deleted') this.server.in(`list:${event.listId}`).socketsLeave(`list:${event.listId}`);
    });
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = (client.handshake.auth as { token?: string } | undefined)?.token;
    try {
      if (!token) throw new Error('missing token');
      const user = await this.tokens.verifyAccessToken(token);
      client.data.user = user;
      await client.join(`user:${user.id}`);
    } catch {
      client.emit('error', { code: 'UNAUTHENTICATED' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage('list.join')
  async join(@ConnectedSocket() client: Socket, @MessageBody() body: { listId?: string }): Promise<{ ok: boolean; error?: string }> {
    const user = client.data.user as AuthUser | undefined;
    if (!user || typeof body?.listId !== 'string') return { ok: false, error: 'BAD_REQUEST' };
    try {
      await this.lists.requireRole(body.listId, user.id, 'VIEWER');
      await client.join(`list:${body.listId}`);
      return { ok: true };
    } catch {
      this.logger.debug(`join refused for ${user.id} on ${body.listId}`);
      return { ok: false, error: 'NOT_FOUND' };
    }
  }

  @SubscribeMessage('list.leave')
  async leave(@ConnectedSocket() client: Socket, @MessageBody() body: { listId?: string }): Promise<{ ok: boolean }> {
    if (typeof body?.listId === 'string') await client.leave(`list:${body.listId}`);
    return { ok: true };
  }
}
