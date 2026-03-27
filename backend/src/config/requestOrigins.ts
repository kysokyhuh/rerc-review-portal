const DEFAULT_ALLOWED_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173";

export function getAllowedOrigins() {
  const configuredOrigins = [
    process.env.CORS_ORIGINS || DEFAULT_ALLOWED_ORIGINS,
    process.env.APP_BASE_URL || "",
  ];

  return Array.from(
    new Set(
      configuredOrigins
        .flatMap((value) => value.split(","))
        .map((origin) => origin.trim())
        .filter(Boolean)
    )
  );
}

export function extractRequestOrigin(value?: string | null) {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

export function getTrustedRequestOrigin(headers: {
  origin?: string | null;
  referer?: string | null;
}) {
  return (
    extractRequestOrigin(headers.origin) ??
    extractRequestOrigin(headers.referer)
  );
}
