import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/models";
import { createToken, setSessionCookie } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations";
import { apiError, apiSuccess } from "@/lib/api-helpers";
import { logActivity } from "@/lib/activity";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    await connectDB();
    const user = await User.findOne({
      email: parsed.data.email.toLowerCase(),
      isActive: true,
    });

    if (!user) {
      return apiError("Invalid email or password", 401);
    }

    const valid = await bcrypt.compare(parsed.data.password, user.password);
    if (!valid) {
      return apiError("Invalid email or password", 401);
    }

    const sessionUser = {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role as "MAIN_ADMIN" | "STAFF_ADMIN",
      permissions: Array.from(user.permissions || []) as import("@/lib/constants").Permission[],
    };

    const token = await createToken(sessionUser);
    await setSessionCookie(token);

    // Non-blocking — don't fail login if activity log fails
    logActivity(sessionUser, "Admin Login", `Logged in as ${user.name}`).catch(
      () => {}
    );

    return apiSuccess({
      user: sessionUser,
      message: "Login successful",
    });
  } catch (error) {
    return apiError(error);
  }
}
