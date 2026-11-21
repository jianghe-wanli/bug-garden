import type { GameEvent } from './types';

type Listener = (e: GameEvent) => void;

export class EventBus {
  private listeners: Listener[] = [];
  on(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }
  emit(e: GameEvent): void {
    for (const l of this.listeners) l(e);
  }
}
