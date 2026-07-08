<template>
a: {{ a }}
b: {{ b }}
</template>
<script setup lang="ts">
const props = defineProps<{ a?: number, b?: string}>().withOptions({
    a: {
        default: 1,
        validator: (value: number) => {
            let a = 1
            let b = 2
            let c = 4
            return value > 0
        }
    },
    b: {
        default: 'hello3',
        validator: (value: string) => {
            let d = 4; let e = 5; let f = 6;
            return value.length > 7
        }
    }
})

let c = 2
let d = () => {
    c++
}
d()
</script>