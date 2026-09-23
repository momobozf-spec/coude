import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

export interface ListEvent {
  listId: string;
  type: 'item.upserted' | 'item.deleted' | 'list.updated' | 'list.deleted' | 'activity' | 'member.joined' | 'member.left';
  payload: Record<string, unknown>;
  actorId: string | null;
}

/** In-process event bus between list mutations and the realtime gateway. */
@Injectable()
export class ListEventsService {
  private readonly emitter = new EventEmitter();
  emit(event: ListEvent): void {
    this.emitter.emit('event', event);
  }
  subscribe(listener: (event: ListEvent) => void): () => void {
    this.emitter.on('event', listener);
    return () => this.emitter.off('event', listener);
  }
}
