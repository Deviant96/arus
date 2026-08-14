<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-default text-default px-4 py-10">
    <div class="flex items-center gap-2.5 mb-8">
      <span class="flex items-center justify-center size-10 rounded-2xl bg-primary/15 text-primary">
        <UIcon name="i-lucide-waves" class="size-5" />
      </span>
      <span class="font-semibold text-xl tracking-tight">Arus</span>
    </div>
    <slot />
    <p class="mt-10 text-xs text-dimmed">
      Fast personal spending tracker — expenses, installments, budgets & reports.
    </p>
  </div>
</template>
