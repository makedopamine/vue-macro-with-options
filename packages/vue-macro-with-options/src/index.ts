import { parseSync, visitorKeys } from 'oxc-parser'
import * as _compiler from 'vue/compiler-sfc'
import { decode, encode, } from '@jridgewell/sourcemap-codec'

import type { CallExpression, Expression, MemberExpression, Program } from 'oxc-parser'
import { SourceMap } from 'module'

function getPropertyName(property: any) {
    if (property.key?.type === 'Identifier') {
        return property.key.name
    }
    if (property.key?.type === 'StringLiteral') {
        return property.key.value
    }
    return null
}

function preserveLineBreaksAsSpaces(code: string) {
    return code.replace(/[^\r\n]/g, ' ')
}

const _compileScript = _compiler.compileScript
const compileScript: typeof _compiler.compileScript = (descriptor, compilerOptions) => {
    const scriptSetup = descriptor.scriptSetup
    // withOptions marco is only valid in setup script and can only be used with type-based defineProps
    if (!scriptSetup) {
        return _compileScript(descriptor, compilerOptions)
    }

    const { program: setupProgram } = parseSync(descriptor.filename, scriptSetup.content, { lang: 'ts' })
    const withOptionsCall = findWithOptionsCall(setupProgram)
    // No withOptions macro call found, return the vue compiler result directly
    if (!withOptionsCall) {
        return _compileScript(descriptor, compilerOptions)
    }

    const definePropsCall = withOptionsCall.callee.object
    // replace .withOptions() with spaces to keep the original code positions
    // keep line breaks unchanged so subsequent line mappings remain stable
    const content = scriptSetup.content.slice(0, definePropsCall.end)
        + preserveLineBreaksAsSpaces(scriptSetup.content.slice(definePropsCall.end, withOptionsCall.end))
        + scriptSetup.content.slice(withOptionsCall.end)
    const source = descriptor.source.slice(0, scriptSetup.loc.start.offset)
        + content
        + descriptor.source.slice(scriptSetup.loc.end.offset)
    // Pass the modified source to the vue compiler: it cannot handle the withOptions macro,
    // so the macro must be removed before compilation
    const transformedDescriptor = {
        ...descriptor,
        source,
        scriptSetup: {
            ...scriptSetup,
            content,
        },
    }
    const result = _compileScript(transformedDescriptor, compilerOptions)
    if (result) {
        // The vue plugin decides whether a script needs a hot update by comparing scriptSetupAst
        // between consecutive compilations. The macro is removed before compilation, so the compiled
        // AST lacks it and changes to its arguments (or adding/removing it) go unnoticed. Replacing
        // the AST with the original one (macro included) lets the vue plugin detect macro changes
        // the same way it detects any other script change.
        result.scriptSetupAst = setupProgram.body as any
    }
    const withOptionsArg = withOptionsCall.arguments[0]
    if (!withOptionsArg) {
        return result
    }

    if (!result) {
        return result
    }

    const options = scriptSetup.content.slice(withOptionsArg.start, withOptionsArg.end)

    // 1. Parse the script using oxc-parser to get the AST
    // Parse the compiled output again to locate the runtime props that the vue compiler
    // generated from the type-only props
    const { program } = parseSync(descriptor.filename, result.content, { lang: 'ts' })
    // The vue plugin decides whether genDefaultAs is false or true based on a few conditions:
    // - If the SFC has a <style> block, genDefaultAs is always false so style-related
    //   properties can be attached to the component object.
    // - If it only has template and script, the environment matters: in dev, genDefaultAs is
    //   false so the render function can be hot-updated separately.
    // - Otherwise render is inlined into the setup function, which the vue compiler can generate
    //   better: render accesses setup variables directly without wrapping the setup return value,
    //   producing a smaller result.
    const componentCall = compilerOptions.genDefaultAs
        ? program.body.flatMap(node => {
            if (node.type !== 'VariableDeclaration') {
                return []
            }
            return node.declarations
                .filter(declaration => declaration.id.type === 'Identifier'
                    && declaration.id.name === compilerOptions.genDefaultAs
                    && declaration.init?.type === 'CallExpression')
                .map(declaration => declaration.init)
        })[0]
        : program.body.find(node => node.type === 'ExportDefaultDeclaration')?.declaration
    if (!componentCall || componentCall.type !== 'CallExpression') {
        return result
    }

    const componentOptions = componentCall.arguments[0]
    if (!componentOptions || componentOptions.type !== 'ObjectExpression') {
        return result
    }

    const propsProperty = componentOptions.properties.find(property => {
        return property.type === 'Property' && getPropertyName(property) === 'props'
    })
    if (!propsProperty || propsProperty.type !== 'Property') {
        return result
    }

    const propsValue = propsProperty.value
    if (!propsValue.start || !propsValue.end) {
        return result
    }

    const originalContent = result.content
    // Extract the props snippet emitted by the vue compiler so it can be merged with the
    // withOptions argument into the complete props definition
    const propsSource = originalContent.slice(propsValue.start, propsValue.end)
    // Import the runtime applyPropOptions helper, which applies the withOptions argument
    // onto the props snippet emitted by the vue compiler
    const prefix = `import { applyPropOptions as __applyPropOptions } from 'vue-macro-with-options/runtime'\n`
    // Build the merged props snippet that replaces the original one
    const mergedPropsSource = `__applyPropOptions(${propsSource}, ${options})`
    // 1. Insert the import statement at the beginning of the script
    // 2. Replace the props snippet with the merged one
    const generatedContent = prefix
        + originalContent.slice(0, propsValue.start)
        + mergedPropsSource
        + originalContent.slice(propsValue.end)
    if (result.map) {
        // 1. Fix how the generated code shifts the line numbers of the original mappings
        // Two places add lines: the import statement and the withOptions argument
        // Handle the lines added by the withOptions argument first
        const decodedMappings = decode(result.map.mappings)
        const withOptionsArgLines = getLineStarts(options)
        // The line containing propsValue.end is the starting line of the options
        const propsValueEndLocation = getLocation(getLineStarts(originalContent), propsValue.end)
        // Insert (number of option lines - 1) empty rows into the mappings
        for (let i = 1; i < withOptionsArgLines.length; i++) {
            decodedMappings.splice(propsValueEndLocation.line + i, 0, [])
        }
        // Handle the line added by the import statement
        decodedMappings.splice(0, 0, [])
        // 2. Map the withOptions argument back to its original positions in the SFC
        // Use each AST node's start offset to map the argument back to the SFC source:
        // [generated line, generated column, original line, original column]
        const originalLines = getLineStarts(descriptor.source)
        const generatedLines = getLineStarts(generatedContent)
        const originalStart = scriptSetup.loc.start.offset + withOptionsArg.start
        const generatedStart = prefix.length + propsValue.end + `__applyPropOptions(`.length + ', '.length
        const visit = (node: any) => {
            if(node === null) return
            
            const offset = node.start - withOptionsArg.start
            const generatedLocation = getLocation(generatedLines, generatedStart + offset)
            const originalLocation =  getLocation(originalLines, originalStart + offset)
            // A parent node and its first child may share the same start (e.g. a Property and its key),
            // producing duplicate columns, so dedupe them
            const segments = decodedMappings[generatedLocation.line]
            if (segments.at(-1)?.[0] !== generatedLocation.column) {
                segments.push([generatedLocation.column, 0, originalLocation.line, originalLocation.column])
            }
            for (const key of visitorKeys[node.type]) {
                const child = node[key]
                if (Array.isArray(child)) {
                    for (const item of child) {
                        visit(item)
                    }
                } else {
                    visit(child)
                }
            }
        }
        visit(withOptionsArg)
        result.map.mappings = encode(decodedMappings)
        // The mappings now point at the original SFC source instead of the code with the
        // withOptions macro removed, so set sourcesContent[0] to the original SFC source
        result.map.sourcesContent![0] = descriptor.source
    }
    result.content = generatedContent
    return result
}

function getLineStarts(code: string) {
    const starts = [0]
    for (let index = 0; index < code.length; index++) {
        if (code[index] === '\n') {
            starts.push(index + 1)
        }
    }
    return starts
}

function getLocation(lineStarts: number[], offset: number) {
    let line = lineStarts.length - 1
    while (line > 0 && lineStarts[line] > offset) {
        line--
    }
    return {
        line,
        column: offset - lineStarts[line],
    }
}

function findWithOptionsCall(program: Program): (CallExpression & { callee: MemberExpression }) | undefined {
    for (const statement of program.body) {
        // defineProps<T>().withOptions()
        if (statement?.type === 'ExpressionStatement') {
            const call = isWithOptionsCall(statement.expression)
            if (call) {
                return call
            }
        }
        // const props = defineProps<T>().withOptions()
        else if (statement?.type === 'VariableDeclaration') {
            for (const declaration of statement.declarations) {
                const call = isWithOptionsCall(declaration.init)
                if (call) {
                    return call
                }
            }
        }
    }
}

function isWithOptionsCall(node: Expression | null) {
    if (node?.type === 'CallExpression'
        && node.callee.type === 'MemberExpression'
        && node.callee.property.type === 'Identifier'
        && node.callee.property.name === 'withOptions'
        && node.callee.object.type === 'CallExpression'
        && node.callee.object.callee.type === 'Identifier'
        && node.callee.object.callee.name === 'defineProps') {
        return node as CallExpression & { callee: MemberExpression }
    }
}

export const compiler: typeof _compiler = {
    ..._compiler,
    compileScript
}



