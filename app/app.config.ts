export default defineAppConfig({
  ui: {
    colors: {
      primary: 'emerald',
      neutral: 'zinc',
    },
    button: {
      slots: {
        base: 'font-medium',
      },
    },
    card: {
      slots: {
        root: 'rounded-2xl',
      },
    },
  },
})
