<script setup lang="ts">
const colorMode = useColorMode()
colorMode.preference = 'light'
</script>

<template>
  <UApp :toaster="{ position: 'top-center', duration: 3000 }">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
