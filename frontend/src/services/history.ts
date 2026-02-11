// src/services/history.ts
import type { Sender } from '../types';

export interface ChatMessage {
  id: string;
  sender: Sender;
  text: string;
  ts: number;
}

function makeId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class History {
  private items: ChatMessage[] = [];

  add(sender: Sender, text: string): ChatMessage {
    const msg: ChatMessage = { id: makeId(), sender, text, ts: Date.now() };
    this.items.push(msg);
    return msg;
  }

  getAll(): ChatMessage[] {
    return this.items;
  }

  getLast(limit: number): ChatMessage[] {
    return this.items.slice(-limit);
  }

  clear(): void {
    this.items = [];
  }
}

export const history = new History();