/**
 * Ambient declarations for the third-party libraries loaded as global scripts
 * through `angular.json` (`bootstrap`, `flatpickr`, `ApexCharts`) and for the
 * template helper `assets/js/theme.js`.
 *
 * Only the surface actually used by the panel is typed here.
 */

/* -------------------------------------------------------------------------- */
/* Bootstrap                                                                   */
/* -------------------------------------------------------------------------- */

interface BootstrapModalInstance {
  show(): void;
  hide(): void;
  dispose(): void;
}

interface BootstrapModalConstructor {
  new (
    element: Element,
    options?: { backdrop?: boolean | 'static'; keyboard?: boolean; focus?: boolean },
  ): BootstrapModalInstance;
  getInstance(element: Element): BootstrapModalInstance | null;
  getOrCreateInstance(
    element: Element,
    options?: { backdrop?: boolean | 'static' },
  ): BootstrapModalInstance;
}

interface BootstrapDropdownInstance {
  show(): void;
  hide(): void;
  dispose(): void;
}

interface BootstrapDropdownConstructor {
  getOrCreateInstance(element: Element): BootstrapDropdownInstance;
}

interface BootstrapTooltipInstance {
  dispose(): void;
}

interface BootstrapTooltipConstructor {
  new (element: Element, options?: Record<string, unknown>): BootstrapTooltipInstance;
  getOrCreateInstance(
    element: Element,
    options?: Record<string, unknown>,
  ): BootstrapTooltipInstance;
  getInstance(element: Element): BootstrapTooltipInstance | null;
}

interface BootstrapGlobal {
  Modal: BootstrapModalConstructor;
  Dropdown: BootstrapDropdownConstructor;
  Tooltip: BootstrapTooltipConstructor;
}

declare const bootstrap: BootstrapGlobal;

interface Window {
  bootstrap?: BootstrapGlobal;
  /** Exposed by `assets/js/theme.js`. */
  Theme?: {
    toggle(): void;
    setDark(): void;
    setLight(): void;
    isDark(): boolean;
    getTheme(): 'light' | 'dark';
  };
  /** Exposed by `assets/js/main.js`. */
  toggleFullscreen?: () => void;
}

/* -------------------------------------------------------------------------- */
/* Flatpickr                                                                   */
/* -------------------------------------------------------------------------- */

interface FlatpickrInstance {
  setDate(dates: string | string[], triggerChange?: boolean): void;
  clear(): void;
  destroy(): void;
  set(option: string, value: unknown): void;
  readonly selectedDates: Date[];
}

interface FlatpickrOptions {
  dateFormat?: string;
  altInput?: boolean;
  altFormat?: string;
  allowInput?: boolean;
  enableTime?: boolean;
  time_24hr?: boolean;
  maxDate?: string | Date;
  minDate?: string | Date;
  defaultDate?: string | Date;
  disableMobile?: boolean;
  onChange?: (selectedDates: Date[], dateStr: string, instance: FlatpickrInstance) => void;
}

interface FlatpickrConstructor {
  new (element: Element | string, options?: FlatpickrOptions): FlatpickrInstance;
  (element: Element | string, options?: FlatpickrOptions): FlatpickrInstance;
}

declare const flatpickr: FlatpickrConstructor;

/* -------------------------------------------------------------------------- */
/* ApexCharts                                                                  */
/* -------------------------------------------------------------------------- */

interface ApexChartsOptions {
  chart?: Record<string, unknown>;
  series?: unknown[];
  labels?: string[];
  colors?: string[];
  xaxis?: Record<string, unknown>;
  yaxis?: Record<string, unknown>;
  legend?: Record<string, unknown>;
  tooltip?: Record<string, unknown>;
  dataLabels?: Record<string, unknown>;
  stroke?: Record<string, unknown>;
  fill?: Record<string, unknown>;
  grid?: Record<string, unknown>;
  plotOptions?: Record<string, unknown>;
  markers?: Record<string, unknown>;
  title?: Record<string, unknown>;
  subtitle?: Record<string, unknown>;
  responsive?: unknown[];
  noData?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ApexChartsInstance {
  render(): Promise<void>;
  updateOptions(
    options: ApexChartsOptions,
    redrawPaths?: boolean,
    animate?: boolean,
  ): Promise<void>;
  updateSeries(series: unknown[], animate?: boolean): Promise<void>;
  destroy(): void;
}

interface ApexChartsConstructor {
  new (element: Element | string, options: ApexChartsOptions): ApexChartsInstance;
}

declare const ApexCharts: ApexChartsConstructor;
