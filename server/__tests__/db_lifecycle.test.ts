import { describe, it, expect } from 'vitest';
import * as db from '../db.js';

describe('Database Lifecycle & isDbActive Tests', () => {
  it('1. Manages setDbConnected and isDbActive correctly', () => {
    db.setDbConnected(false);
    expect(db.isDbActive()).toBe(false);

    db.setDbConnected(true);
    if (db.pool) {
      expect(db.isDbActive()).toBe(true);
    } else {
      expect(db.isDbActive()).toBe(false);
    }
  });
});
