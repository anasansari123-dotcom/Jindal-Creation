/** Shared JWT secret — fails in production if unset */
export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET environment variable is required in production");
    }
    return new TextEncoder().encode("dev-only-jwt-secret-not-for-production");
  }
  return new TextEncoder().encode(secret);
}
