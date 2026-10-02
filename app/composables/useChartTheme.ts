import { formatMoney } from '#shared/utils/money'

/** Shared ECharts styling for the Snug Simple (warm light) theme. */
export function useChartTheme() {
  const { currency } = useFormat()

  const axisLabel = { color: '#6B655D', fontSize: 11 }
  const splitLine = { lineStyle: { color: '#E4DDD0' } }

  function moneyAxis() {
    return {
      type: 'value' as const,
      axisLabel: {
        ...axisLabel,
        formatter: (v: number) => formatMoney(v, currency.value, { compact: true }),
      },
      splitLine,
    }
  }

  function tooltip(): Record<string, unknown> {
    return {
      trigger: 'axis',
      backgroundColor: '#FFFCF7',
      borderColor: '#E4DDD0',
      textStyle: { color: '#1C1917', fontSize: 12 },
      valueFormatter: (v: unknown) => (typeof v === 'number' ? formatMoney(v, currency.value) : String(v ?? '')),
    }
  }

  const palette = [
    '#A8C5A8',
    '#E8A07A',
    '#A8B8C8',
    '#C8B8D8',
    '#F0E0A8',
    '#E8B0B0',
    '#D4C4A8',
    '#8FB8B0',
    '#C4A882',
    '#9A9388',
  ]

  return { axisLabel, splitLine, moneyAxis, tooltip, palette }
}
