export default defineAppConfig({
  ui: {
    colors: {
      // Charcoal CTAs; sage/terracotta accents come from CSS utilities.
      primary: 'stone',
      neutral: 'stone',
      success: 'green',
      warning: 'amber',
      error: 'rose',
      info: 'sky',
    },
    button: {
      slots: {
        base: 'font-semibold rounded-full',
      },
    },
    card: {
      slots: {
        // Soft rectangle — not capsule/gumdrop. Keep pills on buttons/inputs only.
        root: 'rounded-2xl ring-1 ring-[var(--snug-border)] bg-[var(--snug-surface)] shadow-[0_8px_24px_-12px_rgba(28,25,23,0.12)]',
      },
    },

    input: {
      slots: {
        base: 'rounded-2xl',
      },
    },
    select: {
      slots: {
        base: 'rounded-2xl',
      },
    },
    textarea: {
      slots: {
        base: 'rounded-2xl',
      },
    },
    badge: {
      slots: {
        base: 'rounded-full',
      },
    },
    modal: {
      slots: {
        content: 'rounded-2xl',
      },
    },
    drawer: {
      slots: {
        content: 'rounded-t-2xl',
      },
    },
  },
})
