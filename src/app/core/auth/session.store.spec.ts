import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';

import type { Account } from '../models/api.models';
import { SessionStore } from './session.store';

const TOKEN_KEY = 'translator.access_token';

const ACCOUNT: Account = {
  id: '01a0eea2-221c-70cd-83d0-56e95a65c37b',
  full_name: 'Client Demo',
  email: 'devs.trisnasejati@gmail.com',
  role: 'client',
  status: 'active',
  max_rpm: 60,
  max_rpd: 5000,
  created_at: '2026-09-29T19:26:38.000Z',
  updated_at: '2026-09-29T19:26:38.000Z',
};

describe('SessionStore', () => {
  let store: SessionStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    store = TestBed.inject(SessionStore);
  });

  it('starts anonymous when nothing is stored', () => {
    expect(store.isAuthenticated()).toBe(false);
    expect(store.account()).toBeNull();
    expect(store.role()).toBeNull();
    expect(store.isAdmin()).toBe(false);
  });

  it('stores the token, expiry and account and mirrors them to localStorage', () => {
    store.setSession('token-abc', ACCOUNT, '2026-10-01T02:29:36.000Z');

    expect(store.isAuthenticated()).toBe(true);
    expect(store.token()).toBe('token-abc');
    expect(store.role()).toBe('client');
    expect(store.isAdmin()).toBe(false);
    expect(store.expiresAt()).toBe('2026-10-01T02:29:36.000Z');
    expect(localStorage.getItem(TOKEN_KEY)).toBe('token-abc');
    expect(JSON.parse(localStorage.getItem('translator.account')!)).toMatchObject({
      id: ACCOUNT.id,
    });
  });

  it('reports an expired token', () => {
    store.setSession('stale', ACCOUNT, '2000-01-01T00:00:00.000Z');
    expect(store.isExpired()).toBe(true);

    store.setSession('fresh', ACCOUNT, '2999-01-01T00:00:00.000Z');
    expect(store.isExpired()).toBe(false);
  });

  it('refreshes the cached profile without touching the token', () => {
    store.setSession('token-abc', ACCOUNT, '2026-10-01T02:29:36.000Z');
    store.setAccount({ ...ACCOUNT, full_name: 'Renamed', role: 'admin' });

    expect(store.token()).toBe('token-abc');
    expect(store.account()?.full_name).toBe('Renamed');
    expect(store.isAdmin()).toBe(true);
  });

  it('clears everything on logout', () => {
    store.setSession('token-abc', ACCOUNT, '2026-10-01T02:29:36.000Z');
    store.clear();

    expect(store.isAuthenticated()).toBe(false);
    expect(store.token()).toBeNull();
    expect(store.account()).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem('translator.account')).toBeNull();
  });
});
