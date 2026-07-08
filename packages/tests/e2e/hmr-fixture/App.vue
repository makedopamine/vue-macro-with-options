<template>
  <div id="value">{{ a }}</div>
</template>
<script setup lang="ts">
const { a } = defineProps<{ a?: number }>().withOptions({
  a: {
    default: 1,
  },
})
</script>
