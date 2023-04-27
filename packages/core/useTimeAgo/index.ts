import type { MaybeRefOrGetter, Pausable } from '@vueuse/shared'
import { toValue } from '@vueuse/shared'
import type { ComputedRef } from 'vue-demi'
import { computed } from 'vue-demi'
import { useNow } from '../useNow'

export type UseTimeAgoFormatter<T = number> = (value: T, isPast: boolean) => string

// TODO: Consider using this type instead: Intl.RelativeTimeFormatUnit
export type UseTimeAgoUnitNamesDefault = 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year'

export interface UseTimeAgoMessagesBuiltIn {
  justNow: string
  past: string | UseTimeAgoFormatter<string>
  future: string | UseTimeAgoFormatter<string>
  invalid: string
}

export type UseTimeAgoMessages<UnitNames extends string = UseTimeAgoUnitNamesDefault>
  = UseTimeAgoMessagesBuiltIn
  & Record<UnitNames, string | UseTimeAgoFormatter<number>>

export interface FormatTimeAgoOptions<UnitNames extends string = UseTimeAgoUnitNamesDefault> {
  /**
   * Maximum unit (of diff in milliseconds) to display the full date instead of relative
   *
   * @default undefined
   */
  max?: UnitNames | number

  /**
   * Formatter for full date
   */
  fullDateFormatter?: (date: Date) => string

  locale?: string

  relativeTimeOptions?: Intl.RelativeTimeFormatOptions

  /**
   * Minimum display time unit (default is minute)
   *
   * @default false
   */
  showSecond?: boolean

  /**
   * Rounding method to apply.
   *
   * @default 'round'
   */
  rounding?: 'round' | 'ceil' | 'floor' | number

  /**
   * Custom units
   */
  units?: UseTimeAgoUnit<UseTimeAgoUnitNamesDefault>[]
}
export interface UseTimeAgoOptions<Controls extends boolean, UnitNames extends string = UseTimeAgoUnitNamesDefault> extends FormatTimeAgoOptions<UnitNames> {
  /**
   * Expose more controls
   *
   * @default false
   */
  controls?: Controls

  /**
   * Intervals to update, set 0 to disable auto update
   *
   * @default 30_000
   */
  updateInterval?: number
}

export interface UseTimeAgoUnit<Unit extends string = UseTimeAgoUnitNamesDefault> {
  max: number
  value: number
  name: Unit
}

const DEFAULT_UNITS: UseTimeAgoUnit<UseTimeAgoUnitNamesDefault>[] = [
  { max: 60000, value: 1000, name: 'second' },
  { max: 2760000, value: 60000, name: 'minute' },
  { max: 72000000, value: 3600000, name: 'hour' },
  { max: 518400000, value: 86400000, name: 'day' },
  { max: 2419200000, value: 604800000, name: 'week' },
  { max: 28512000000, value: 2592000000, name: 'month' },
  { max: Infinity, value: 31536000000, name: 'year' },
]

function DEFAULT_FORMATTER(date: Date) {
  return date.toISOString().slice(0, 10)
}

export type UseTimeAgoReturn<Controls extends boolean = false> = Controls extends true ? { timeAgo: ComputedRef<string> } & Pausable : ComputedRef<string>

/**
 * Reactive time ago formatter.
 *
 * @see https://vueuse.org/useTimeAgo
 * @param options
 */
export function useTimeAgo<UnitNames extends string = UseTimeAgoUnitNamesDefault>(time: MaybeRefOrGetter<Date | number | string>, options?: UseTimeAgoOptions<false, UnitNames>): UseTimeAgoReturn<false>
export function useTimeAgo<UnitNames extends string = UseTimeAgoUnitNamesDefault>(time: MaybeRefOrGetter<Date | number | string>, options: UseTimeAgoOptions<true, UnitNames>): UseTimeAgoReturn<true>
export function useTimeAgo<UnitNames extends string = UseTimeAgoUnitNamesDefault>(time: MaybeRefOrGetter<Date | number | string>, options: UseTimeAgoOptions<boolean, UnitNames> = {}) {
  const {
    controls: exposeControls = false,
    updateInterval = 30_000,
  } = options

  const { now, ...controls } = useNow({ interval: updateInterval, controls: true })
  const timeAgo = computed(() => formatTimeAgo(new Date(toValue(time)), options, toValue(now.value)))

  if (exposeControls) {
    return {
      timeAgo,
      ...controls,
    }
  }
  else {
    return timeAgo
  }
}

export function formatTimeAgo<UnitNames extends string = UseTimeAgoUnitNamesDefault>(from: Date, options: FormatTimeAgoOptions<UnitNames> = {}, now: Date | number = Date.now()): string {
  const {
    max,
    fullDateFormatter = DEFAULT_FORMATTER,
    units = DEFAULT_UNITS,
    showSecond = false,
    rounding = 'round',
    locale = 'ar',
    relativeTimeOptions = { numeric: 'auto' },
  } = options

  const rtf = new Intl.RelativeTimeFormat(locale, relativeTimeOptions)

  const roundFn = typeof rounding === 'number'
    ? (n: number) => +n.toFixed(rounding)
    : Math[rounding]

  const diff = +now - +from
  const absDiff = Math.abs(diff)

  function getValue(diff: number, unit: UseTimeAgoUnit) {
    return roundFn(Math.abs(diff) / unit.value)
  }

  function format(diff: number, unit: UseTimeAgoUnit) {
    const val = getValue(diff, unit)
    const past = diff > 0
    return rtf.format(past ? -val : val, unit.name)
  }

  // less than a minute
  if (absDiff < 60000 && !showSecond)
    return rtf.format(0, 'second')

  if (typeof max === 'number' && absDiff > max)
    return fullDateFormatter(new Date(from))

  if (typeof max === 'string') {
    const unitMax = units.find(i => i.name === max)?.max
    if (unitMax && absDiff > unitMax)
      return fullDateFormatter(new Date(from))
  }

  for (const [idx, unit] of units.entries()) {
    const val = getValue(diff, unit)
    if (val <= 0 && units[idx - 1])
      return format(diff, units[idx - 1])
    if (absDiff < unit.max)
      return format(diff, unit)
  }

  return ''// TODO: make this dynamic
}
