import { describe, it, expect } from 'vitest';
import { normalizeApiUrl } from '../utils/api';

describe('Base URL Normalization (normalizeApiUrl)', () => {
  describe('Relative Mode (empty or undefined base URL)', () => {
    it('returns leading slash endpoint when baseUrl is empty string', () => {
      expect(normalizeApiUrl('', '/api/auth/session')).toBe('/api/auth/session');
    });

    it('adds leading slash to relative endpoint when baseUrl is empty string', () => {
      expect(normalizeApiUrl('', 'api/config')).toBe('/api/config');
    });

    it('handles undefined baseUrl cleanly', () => {
      expect(normalizeApiUrl(undefined, '/api/leaderboard')).toBe('/api/leaderboard');
    });

    it('handles whitespace-only baseUrl as relative mode', () => {
      expect(normalizeApiUrl('   ', '/api/round/start')).toBe('/api/round/start');
    });
  });

  describe('Absolute Mode (with backend base URL)', () => {
    it('combines base URL without trailing slash and endpoint with leading slash without double slashes', () => {
      expect(normalizeApiUrl('https://api.neonorbit.com', '/api/auth/session')).toBe(
        'https://api.neonorbit.com/api/auth/session'
      );
    });

    it('strips single trailing slash from base URL', () => {
      expect(normalizeApiUrl('https://api.neonorbit.com/', '/api/config')).toBe(
        'https://api.neonorbit.com/api/config'
      );
    });

    it('strips multiple trailing slashes from base URL', () => {
      expect(normalizeApiUrl('https://api.neonorbit.com///', 'api/round/submit')).toBe(
        'https://api.neonorbit.com/api/round/submit'
      );
    });

    it('handles port numbers and path prefixes in base URL', () => {
      expect(normalizeApiUrl('http://localhost:3000', '/api/leaderboard?scope=global')).toBe(
        'http://localhost:3000/api/leaderboard?scope=global'
      );
      expect(normalizeApiUrl('https://api.neonorbit.com/v1/', '/api/config')).toBe(
        'https://api.neonorbit.com/v1/api/config'
      );
    });
  });
});
