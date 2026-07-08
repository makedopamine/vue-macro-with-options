export function applyPropOptions(props: Record<string, Record<string, any>>, options: Record<string, Record<string, any>>) {
  for (const key of Object.keys(options)) {
    if (!Object.hasOwn(props, key)) continue
    Object.assign(props[key], options[key])
  }
  return props
}
