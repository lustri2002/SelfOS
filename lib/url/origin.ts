export function getPublicOrigin(request: Request) {
  const configuredOrigin = process.env.APP_ORIGIN || process.env.NEXT_PUBLIC_APP_ORIGIN;
  if (configuredOrigin) return configuredOrigin.replace(/\/$/, "");

  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`;

  return new URL(request.url).origin;
}
