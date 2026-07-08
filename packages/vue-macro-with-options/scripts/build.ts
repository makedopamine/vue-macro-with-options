import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { rolldown } from 'rolldown'
import { dts } from 'rolldown-plugin-dts'

const outputDirectory = 'dist'

await rm(outputDirectory, { recursive: true, force: true })
await mkdir(outputDirectory, { recursive: true })

const packageManifest = JSON.parse(await readFile('package.json', 'utf8'))

await writeFile(
    `${outputDirectory}/package.json`,
    JSON.stringify({
        name: packageManifest.name,
        version: packageManifest.version,
        description: packageManifest.description,
        keywords: packageManifest.keywords,
        license: packageManifest.license,
        type: packageManifest.type,
        sideEffects: packageManifest.sideEffects,
        engines: packageManifest.engines,
        dependencies: packageManifest.dependencies,
        peerDependencies: packageManifest.peerDependencies,
    }, null, 2) + '\n',
)

await writeFile(
    `${outputDirectory}/README.md`,
    await readFile('../../README.md', 'utf8'),
)

await writeFile(
    `${outputDirectory}/macros-global.d.ts`,
    await readFile('src/macros-global.d.ts', 'utf8'),
)

const bundle = await rolldown({
    input: {
        index: 'src/index.ts',
        runtime: 'src/runtime.ts',
    },
    plugins: [dts()],
    external: ['vue/compiler-sfc', 'oxc-parser', '@jridgewell/sourcemap-codec'],
})

await bundle.write({
    dir: outputDirectory,
    format: 'es',
    entryFileNames: '[name].js',
})
