/**
 * Conversation Manager tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ConversationManager } from '../../../src/chat/conversation.js';
import { createMessage } from '../../../src/chat/message.js';

describe('ConversationManager', () => {
  let manager: ConversationManager;

  beforeEach(() => {
    manager = new ConversationManager();
  });

  describe('create', () => {
    it('should create a conversation with defaults', () => {
      const conv = manager.create();
      expect(conv.id).toBeDefined();
      expect(conv.messages).toEqual([]);
      expect(conv.metadata.messageCount).toBe(0);
      expect(conv.createdAt).toBeGreaterThan(0);
    });

    it('should create a conversation with custom options', () => {
      const conv = manager.create({
        id: 'custom-id',
        title: 'Test Chat',
        systemPrompt: 'Be helpful',
        tags: ['test'],
        model: 'gpt-4o',
      });
      expect(conv.id).toBe('custom-id');
      expect(conv.metadata.title).toBe('Test Chat');
      expect(conv.metadata.systemPrompt).toBe('Be helpful');
      expect(conv.metadata.tags).toEqual(['test']);
    });
  });

  describe('get', () => {
    it('should return a conversation by ID', () => {
      const conv = manager.create({ id: 'test-1' });
      expect(manager.get('test-1')).toBe(conv);
    });

    it('should return undefined for unknown ID', () => {
      expect(manager.get('unknown')).toBeUndefined();
    });
  });

  describe('getOrCreate', () => {
    it('should return existing conversation', () => {
      const conv = manager.create({ id: 'existing' });
      expect(manager.getOrCreate('existing')).toBe(conv);
    });

    it('should create new if not found', () => {
      const conv = manager.getOrCreate('new-id', { systemPrompt: 'Hello' });
      expect(conv.id).toBe('new-id');
    });
  });

  describe('list', () => {
    it('should list all conversations', () => {
      manager.create({ id: 'a' });
      manager.create({ id: 'b' });
      expect(manager.list().length).toBe(2);
    });

    it('should filter by tags', () => {
      manager.create({ id: 'a', tags: ['important'] });
      manager.create({ id: 'b', tags: ['casual'] });
      const result = manager.list({ tags: ['important'] });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('a');
    });

    it('should paginate', () => {
      for (let i = 0; i < 5; i++) {
        manager.create({ id: `conv-${i}` });
      }
      const page = manager.list({ limit: 2, offset: 1 });
      expect(page.length).toBe(2);
    });
  });

  describe('addMessage', () => {
    it('should add a message to a conversation', () => {
      manager.create({ id: 'conv-1' });
      const msg = createMessage('user', 'Hello');
      manager.addMessage('conv-1', msg);
      const conv = manager.get('conv-1');
      expect(conv?.messages.length).toBe(1);
      expect(conv?.metadata.messageCount).toBe(1);
    });

    it('should throw for unknown conversation', () => {
      const msg = createMessage('user', 'Hello');
      expect(() => manager.addMessage('unknown', msg)).toThrow('Conversation not found');
    });

    it('should update token count', () => {
      manager.create({ id: 'conv-1' });
      manager.addMessage('conv-1', createMessage('user', 'Hello'));
      const conv = manager.get('conv-1');
      expect(conv?.metadata.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('getMessages', () => {
    it('should return messages', () => {
      manager.create({ id: 'conv-1' });
      manager.addMessage('conv-1', createMessage('user', 'Hello'));
      manager.addMessage('conv-1', createMessage('assistant', 'Hi'));
      const messages = manager.getMessages('conv-1');
      expect(messages.length).toBe(2);
    });

    it('should filter by role', () => {
      manager.create({ id: 'conv-1' });
      manager.addMessage('conv-1', createMessage('user', 'Hello'));
      manager.addMessage('conv-1', createMessage('assistant', 'Hi'));
      const messages = manager.getMessages('conv-1', { roles: ['user'] });
      expect(messages.length).toBe(1);
    });

    it('should return empty for unknown conversation', () => {
      expect(manager.getMessages('unknown').length).toBe(0);
    });
  });

  describe('updateMetadata', () => {
    it('should update metadata', () => {
      manager.create({ id: 'conv-1' });
      manager.updateMetadata('conv-1', { title: 'Updated' });
      expect(manager.get('conv-1')?.metadata.title).toBe('Updated');
    });

    it('should throw for unknown conversation', () => {
      expect(() => manager.updateMetadata('unknown', {})).toThrow();
    });
  });

  describe('delete', () => {
    it('should delete a conversation', () => {
      manager.create({ id: 'conv-1' });
      expect(manager.delete('conv-1')).toBe(true);
      expect(manager.get('conv-1')).toBeUndefined();
    });

    it('should return false for unknown', () => {
      expect(manager.delete('unknown')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all conversations', () => {
      manager.create({ id: 'a' });
      manager.create({ id: 'b' });
      manager.clear();
      expect(manager.size).toBe(0);
    });
  });

  describe('export/import', () => {
    it('should export a conversation as JSON', () => {
      manager.create({ id: 'conv-1', title: 'Test' });
      const json = manager.export('conv-1');
      expect(json).toBeDefined();
      expect(JSON.parse(json!).id).toBe('conv-1');
    });

    it('should import a conversation from JSON', () => {
      const conv = manager.create({ id: 'conv-1', title: 'Test' });
      const json = manager.export('conv-1')!;
      manager.clear();
      const imported = manager.import(json);
      expect(imported.id).toBe('conv-1');
      expect(manager.get('conv-1')).toBeDefined();
    });

    it('should return undefined for unknown export', () => {
      expect(manager.export('unknown')).toBeUndefined();
    });
  });
});
