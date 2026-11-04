// Reproduce a deployed function that does not include the optional browser SDK.
export function resolve(specifier, context, nextResolve) {
  if (specifier === "@vercel/analytics" || specifier.startsWith("@vercel/analytics/")) {
    const error = new Error("Cannot find package '@vercel/analytics'");
    error.code = "ERR_MODULE_NOT_FOUND";
    throw error;
  }
  return nextResolve(specifier, context);
}
