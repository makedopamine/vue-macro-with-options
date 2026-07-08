<template>
    <div></div>
</template>
<script setup lang="ts">
import { options } from './external-options.ts'
defineProps<{ foo: string }>().withOptions(options)
</script>