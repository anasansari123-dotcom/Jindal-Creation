import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/connect";
import { User } from "@/lib/models";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { createUserSchema } from "@/lib/validations";
import { logActivity } from "@/lib/activity";
import { createToken, setSessionCookie } from "@/lib/auth/session";
import { toSessionUser } from "@/lib/auth/load-user";
import type { Permission } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("users", request);
  if (auth instanceof Response) return auth;

  try {
    await connectDB();
    const users = await User.find().select("-password").sort({ createdAt: -1 }).lean();
    return apiSuccess({ users });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("users", request);
  if (auth instanceof Response) return auth;

  if (auth.user.role !== "MAIN_ADMIN") {
    return apiError("Only Main Admin can create users", 403);
  }

  try {
    const body = await request.json();
    const parsed = createUserSchema.safeParse({
      ...body,
      email: typeof body.email === "string" ? body.email.trim().toLowerCase() : body.email,
      permissions: Array.isArray(body.permissions) ? body.permissions : [],
    });
    if (!parsed.success) {
      return apiError(parsed.error.issues[0].message, 400);
    }

    await connectDB();
    const existing = await User.findOne({ email: parsed.data.email.toLowerCase() });
    if (existing) return apiError("Email already in use", 400);

    const hashedPassword = await bcrypt.hash(parsed.data.password, 12);
    const user = await User.create({
      ...parsed.data,
      email: parsed.data.email.toLowerCase(),
      password: hashedPassword,
      permissions: parsed.data.role === "MAIN_ADMIN" ? [] : parsed.data.permissions,
    });

    await logActivity(
      auth.user,
      "Admin Created",
      `Created admin user ${user.name}`,
      user._id.toString(),
      "user"
    );

    const { password: _, ...safeUser } = user.toObject();
    return apiSuccess({ user: safeUser }, 201);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth("users", request);
  if (auth instanceof Response) return auth;

  if (auth.user.role !== "MAIN_ADMIN") {
    return apiError("Only Main Admin can update users", 403);
  }

  try {
    const body = await request.json();
    const { id, ...updates } = body;
    if (!id) return apiError("User ID is required", 400);

    await connectDB();
    const user = await User.findById(id);
    if (!user) return apiError("User not found", 404);

    if (user.role === "STAFF_ADMIN" && updates.permissions) {
      user.permissions = updates.permissions as Permission[];
    }
    if (updates.name) user.name = updates.name;
    if (updates.isActive !== undefined) user.isActive = updates.isActive;

    const newPassword =
      typeof updates.password === "string" ? updates.password.trim() : "";
    if (newPassword) {
      if (newPassword.length < 6) {
        return apiError("Password must be at least 6 characters", 400);
      }
      user.password = await bcrypt.hash(newPassword, 12);
    }

    await user.save();

    if (auth.user.id === user._id.toString()) {
      const sessionUser = toSessionUser(user);
      const token = await createToken(sessionUser);
      await setSessionCookie(token);
    }

    await logActivity(
      auth.user,
      updates.permissions ? "Permission Updated" : "Admin Updated",
      `Updated admin user ${user.name}`,
      user._id.toString(),
      "user"
    );

    const { password: _, ...safeUser } = user.toObject();
    return apiSuccess({ user: safeUser });
  } catch (error) {
    return apiError(error);
  }
}
