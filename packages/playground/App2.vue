<template>
a: {{ a }}
b: {{ b }}
</template>
<script setup lang="ts">
 const props = withDefaults(defineProps<{ a?: number, b?: string}>(), {
    a: 1,
    b: 'hello3'
 })


</script>