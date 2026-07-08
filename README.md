# vue-macro-with-options

Add runtime props options (`default`, `validator`, ...) to type-based `defineProps<T>()` inside Vue SFCs using `<script setup lang="ts">`.

```vue
<script setup lang="ts">
const props = defineProps<{ a?: number, b?: string }>().withOptions({
  a: {
    default: 1,
    validator: (v: number) => v > 0,
  },
  b: {
    default: 'hello',
    validator: (v: string) => v.length > 3,
  },
})
</script>
```

## Install

```bash
pnpm add -D vue-macro-with-options
```

## Usage

### 1. Configure Vite

Pass the custom `compiler` to `@vitejs/plugin-vue`:

```ts
// vite.config.ts
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
import { compiler } from 'vue-macro-with-options'

export default defineConfig({
  plugins: [
    vue({
      compiler,
    }),
  ],
})
```

### 2. Include the type declaration

The package ships a `macros-global.d.ts` type declaration that augments Vue's `defineProps` with `.withOptions`. Add it to the `include` list in your `tsconfig.json`:

```jsonc
// tsconfig.json
{
  "include": [
    "vue-macro-with-options/macros-global.d.ts"
  ]
}
```
### 3. Use it in a component

```vue
<template>
  <p>a: {{ a }}</p>
  <p>b: {{ b }}</p>
</template>

<script setup lang="ts">
defineProps<{ a?: number }>().withOptions({
  a: { default: 10, validator: (v) => v > 0 },
})
</script>
```

The options can also live in a separate file — the macro argument accepts any expression:

```ts
// options.ts
export const options = {
  foo: {
    default: 'bar',
    validator: (value: string) => value.length > 0,
  },
}
```

```vue
<script setup lang="ts">
import { options } from './options.ts'

defineProps<{ foo: string }>().withOptions(options)
</script>
```

## Supported options

The type declaration exposes `default` and `validator`:

| Option | Description |
| --- | --- |
| `default` | Default value, or a factory returning it. Applied by Vue when the prop is absent |
| `validator` | Validation function. Vue warns in development when it returns `false` |

Merging is done with `Object.assign`, so at runtime you can pass any Vue prop option (e.g. `required`) — they just aren't exposed in the type.

