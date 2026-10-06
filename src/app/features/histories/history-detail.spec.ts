import { signal } from '@angular/core';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthService } from '../../core/services/auth.service';
import { HistoryService } from '../../core/services/history.service';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import type { History } from '../../core/models/api.models';
import { HistoryDetail } from './history-detail';

const HISTORY: History = {
  id: '01a11099-00a0-7100-c0ff-ee0000000001',
  account_id: '01a0eea2-221c-70cd-83d0-56e95a65c37b',
  account: {
    id: '01a0eea2-221c-70cd-83d0-56e95a65c37b',
    full_name: 'Client',
    email: 'client@example.com',
  },
  driver_id: 'gemini-3.8-flash',
  driver: { id: 'gemini-3.8-flash', name: 'Gemini Flash', type: 'ai', status: 'active' },
  translate_from: 'id',
  translate_to: 'en',
  reference_id: 'INV-2026-0001',
  reference_content: 'Selamat pagi',
  translated_content: 'Good morning',
  status: 'translated',
  requested_at: '2026-10-01T00:00:00.000Z',
  translated_at: '2026-10-01T00:00:05.000Z',
  callback_status: 'close',
  callback_retry: 0,
  callback_at: null,
};

function setup() {
  const detail = vi.fn(() => of(HISTORY));

  TestBed.configureTestingModule({
    imports: [HistoryDetail],
    providers: [
      provideRouter([]),
      { provide: HistoryService, useValue: { detail } },
      { provide: AuthService, useValue: { isAdmin: signal(false) } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
      { provide: ConfirmService, useValue: { ask: vi.fn(() => Promise.resolve(true)) } },
    ],
  });

  return detail;
}

describe('HistoryDetail', () => {
  /**
   * Regression: the constructor used to call the fetch, reading the
   * `withComponentInputBinding()` input before Angular assigned it. That threw
   * NG0950, the router aborted the navigation and the user was sent back to the
   * list (or left with an empty outlet).
   */
  it('is created before the route-bound id exists, then loads once it is set', async () => {
    const detail = setup();

    let fixture: ComponentFixture<HistoryDetail> | undefined;
    expect(() => {
      fixture = TestBed.createComponent(HistoryDetail);
    }).not.toThrow();

    fixture?.componentRef.setInput('id', HISTORY.id);
    fixture?.detectChanges();
    await fixture?.whenStable();

    expect(detail).toHaveBeenCalledTimes(1);
    expect(detail).toHaveBeenCalledWith(HISTORY.id);
  });

  it('reloads when the :id input changes, because the router reuses the component', async () => {
    const detail = setup();

    const fixture = TestBed.createComponent(HistoryDetail);
    fixture.componentRef.setInput('id', HISTORY.id);
    fixture.detectChanges();
    await fixture.whenStable();

    fixture.componentRef.setInput('id', '01a11099-00a0-7100-c0ff-ee0000000002');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(detail).toHaveBeenCalledTimes(2);
    expect(detail).toHaveBeenLastCalledWith('01a11099-00a0-7100-c0ff-ee0000000002');
  });
});
