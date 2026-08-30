import { clearSessionCookie } from "@/lib/auth/session";
import { apiSuccess } from "@/lib/api-helpers";

export async function POST() {
  await clearSessionCookie();
  return apiSuccess({ message: "Logged out successfully" });
}
