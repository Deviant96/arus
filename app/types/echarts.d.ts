import type { DefineComponent } from 'vue'

declare module 'vue' {
  export interface GlobalComponents {
    VChart: DefineComponent<{ option: unknown, autoresize?: boolean }, {}, {}>
  }
}

export {}
