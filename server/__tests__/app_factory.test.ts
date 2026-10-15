import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app, { createApp } from '../app.js';

describe('Phase B: Express App Factory', () => {
  it('exports a valid Express application without side-effects', () => {
    expect(app).toBeDefined();
    expect(typeof app.use).toBe('function');
  });

  it('creates isolated app instances using createApp()', () => {
    const instance = createApp();
    expect(instance).toBeDefined();
    expect(typeof instance.listen).toBe('function');
  });

  it('handles /api/health requests correctly', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });

  it('returns 404 JSON for unknown /api routes', async () => {
    const res = await request(app).get('/api/non-existent-route-xyz');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'NOT_FOUND' });
  });
});
