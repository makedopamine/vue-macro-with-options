<template>
    <div></div>
</template>
<script setup lang="ts">
defineProps<{ foo: string }>().withOptions({foo: {
    default: 'bar',
    validator: (value: string) => value.length > 0
}})
</script>