import {
  AfterViewInit,
  Directive,
  ElementRef,
  OnDestroy,
  inject,
  input,
  output,
} from '@angular/core';

import { toDateInputValue } from '../../../core/utils/format';

/**
 * Initialises flatpickr (bundled from `templates/assets/vendor/flatpickr`) on a
 * native `<input>` and emits the picked day as `YYYY-MM-DD`.
 *
 * Using a directive instead of `ngModel` keeps the host input usable by plain
 * Angular forms and by signal based filters alike:
 *
 * ```html
 * <input class="form-control" appDatePicker (dateChange)="from.set($event)" />
 * ```
 */
@Directive({
  selector: 'input[appDatePicker]',
})
export class DatePicker implements AfterViewInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private instance: FlatpickrInstance | null = null;

  /** Placeholder shown when the field is empty. */
  readonly placeholder = input<string>('YYYY-MM-DD');
  /** Upper bound (inclusive) as `YYYY-MM-DD`. */
  readonly maxDate = input<string>();
  /** Lower bound (inclusive) as `YYYY-MM-DD`. */
  readonly minDate = input<string>();

  /** Emitted with `YYYY-MM-DD`, or an empty string when cleared. */
  readonly dateChange = output<string>();

  ngAfterViewInit(): void {
    const element = this.host.nativeElement;
    element.placeholder = element.placeholder || this.placeholder();

    if (typeof flatpickr === 'undefined') {
      // Vendor script missing: fall back to a plain date input.
      element.type = 'date';
      element.addEventListener('change', this.onNativeChange);
      return;
    }

    this.instance = flatpickr(element, {
      dateFormat: 'Y-m-d',
      allowInput: true,
      disableMobile: true,
      maxDate: this.maxDate(),
      minDate: this.minDate(),
      onChange: (_dates, dateStr) => this.dateChange.emit(dateStr),
    });
  }

  ngOnDestroy(): void {
    this.instance?.destroy();
    this.instance = null;
    this.host.nativeElement.removeEventListener('change', this.onNativeChange);
  }

  private readonly onNativeChange = (): void => {
    this.dateChange.emit(this.host.nativeElement.value);
  };
}

/** Utility used by screens that turn a picked day into an ISO 8601 bound. */
export function startOfDay(value: string): string | undefined {
  return value ? `${value}T00:00:00.000Z` : undefined;
}

/** Inclusive end-of-day bound for `date_to`. */
export function endOfDay(value: string): string | undefined {
  return value ? `${value}T23:59:59.999Z` : undefined;
}

/** Today as `YYYY-MM-DD`, handy for a picker default. */
export function today(): string {
  return toDateInputValue(new Date());
}
