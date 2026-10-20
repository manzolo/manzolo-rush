import { pathToFileURL } from 'node:url';
export function resolve(specifier, context, nextResolve) {
    if (specifier === 'three' && process.env.THREE_MODULE)
        return { url: pathToFileURL(process.env.THREE_MODULE).href, shortCircuit: true };
    return nextResolve(specifier, context);
}
