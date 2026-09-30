import { Injectable, signal } from '@angular/core';

export type ToastVariant = 'success' | 'danger' | 'warning' | 'info';

export interface Toast {
  id: number;
  variant: ToastVariant;
  title: string;
  message: string;
}

const DEFAULT_DURATION = 5000;

/**
 * Transient feedback for API results, rendered by `ToastHostComponent`.
 *
 * Only one host is mounted (in `MainLayoutComponent` and the login screen), so
 * the service simply keeps an array of active toasts in a signal.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly toastsSignal = signal<Toast[]>([]);
  private nextId = 1;

  readonly toasts = this.toastsSignal.asReadonly();

  success(title: string, message: string): void {
    this.show('success', title, message);
  }

  error(title: string, message: string): void {
    this.show('danger', title, message);
  }

  warning(title: string, message: string): void {
    this.show('warning', title, message);
  }

  info(title: string, message: string): void {
    this.show('info', title, message);
  }

  /** Shows a toast and removes it after `duration` ms. */
  show(variant: ToastVariant, title: string, message: string, duration = DEFAULT_DURATION): void {
    const toast: Toast = { id: this.nextId++, variant, title, message };

    this.toastsSignal.update((toasts) => [...toasts, toast]);
    setTimeout(() => this.dismiss(toast.id), duration);
  }

  dismiss(id: number): void {
    this.toastsSignal.update((toasts) => toasts.filter((toast) => toast.id !== id));
  }
}
