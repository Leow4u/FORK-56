export async function resolve(specifier, context, nextResolve) {
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    !/\.(?:[cm]?js|[cm]?ts|json|node)$/.test(specifier)
  ) {
    return nextResolve(`${specifier}.ts`, context)
  }
  return nextResolve(specifier, context)
}
