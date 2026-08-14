import { formatMoney } from '#shared/utils/money'

/** Shared ECharts styling for the dark theme. */
export function useChartTheme() {
  const { currency } = useFormat()

  const axisLabel = { color: '#8b8b94', fontSize: 11 }
  const splitLine = { lineStyle: { color: '#212126' } }

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
      backgroundColor: '#17171a',
      borderColor: '#2a2a30',
      textStyle: { color: '#e4e4e7', fontSize: 12 },
      valueFormatter: (v: unknown) => (typeof v === 'number' ? formatMoney(v, currency.value) : String(v ?? '')),
    }
  }

  const palette = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4', '#ef4444', '#84cc16', '#f97316', '#64748b']

  return { axisLabel, splitLine, moneyAxis, tooltip, palette }
}
