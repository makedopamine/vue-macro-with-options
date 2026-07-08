import { describe, expect, test } from 'vitest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { rolldown } from 'rolldown'
import vue from '@vitejs/plugin-vue'
import { decode } from '@jridgewell/sourcemap-codec'
import { compiler } from 'vue-macro-with-options'

const files = (await fs.readdir('./compile/fixtures')).filter((file) => file.endsWith('.vue'))

describe('fixtures', () => {
  test.each(files)('%s', async (file) => {
    if (!file.endsWith('.vue')) {
      return
    }

    const bundle = await rolldown({
      input: `compile/fixtures/${file}`,
      plugins: [
        vue({
          compiler,
        }),
      ],
      external: ['vue', /^vue-macro-with-options/],
    })
    const { output } = await bundle.generate({
      format: 'es',
    })
    expect(output[0].code).toMatchSnapshot()
  })

  test('merges props when compiler generates a named component', async () => {
    const filename = path.resolve('compile/fixtures/inline-options.vue')
    const source = await fs.readFile(filename, 'utf8')
    const descriptor = compiler.parse(source, { filename }).descriptor
    const result = compiler.compileScript(descriptor, {
      id: 'foo',
      genDefaultAs: '_sfc_main',
    })

    expect(result.content).toMatchSnapshot()
  })

  test('maps options tokens to the original SFC columns', async () => {
    const filename = path.resolve('compile/fixtures/inline-options.vue')
    const source = await fs.readFile(filename, 'utf8')
    const descriptor = compiler.parse(source, { filename }).descriptor
    const result = compiler.compileScript(descriptor, {
      id: 'foo',
      genDefaultAs: '_sfc_main',
      sourceMap: true,
    })
    const mappings = decode(result.map!.mappings)

    const locate = (code: string, offset: number) => {
      const before = code.slice(0, offset)
      return { line: before.split('\n').length - 1, column: offset - (before.lastIndexOf('\n') + 1) }
    }

    for (const token of ['validator', 'length', "'bar'"]) {
      const generated = locate(result.content, result.content.indexOf(token))
      const original = locate(source, source.indexOf(token))
      const segment = mappings[generated.line].filter(([column]) => column <= generated.column).at(-1)

      expect(segment?.slice(2)).toEqual([original.line, original.column])
    }

    for (const segments of mappings) {
      const columns = segments.map(([column]) => column)
      expect(columns).toEqual([...new Set(columns)])
    }
  })
})
