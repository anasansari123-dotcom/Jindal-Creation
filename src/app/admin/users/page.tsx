"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageLoader, EmptyState } from "@/components/ui/loading";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { Plus, Pencil } from "lucide-react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userSchema, createUserSchema, type UserInput } from "@/lib/validations";
import { PERMISSIONS, type Permission } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

interface User {
  _id: string;
  name: string;
  email: string;
  role: "MAIN_ADMIN" | "STAFF_ADMIN";
  permissions: string[];
  isActive: boolean;
  createdAt: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<UserInput>({
    resolver: zodResolver(userSchema) as Resolver<UserInput>,
    defaultValues: { role: "STAFF_ADMIN", isActive: true, permissions: [] },
  });

  const role = watch("role");

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me", { credentials: "include" }),
      fetch("/api/users", { credentials: "include" }),
    ]).then(async ([meRes, usersRes]) => {
      if (meRes.status === 401 || usersRes.status === 401) {
        router.replace("/login?redirect=/admin/users");
        return;
      }
      const me = await meRes.json();
      const usersData = await usersRes.json();
      setCurrentUser(me.user || null);
      setUsers(usersData.users || []);
      setLoading(false);
    });
  }, [router]);

  const isMainAdmin = currentUser?.role === "MAIN_ADMIN";

  const openCreate = () => {
    setEditUser(null);
    setSelectedPermissions(["dashboard"]);
    reset({ role: "STAFF_ADMIN", isActive: true, permissions: ["dashboard"] });
    setDialogOpen(true);
  };

  const openEdit = (user: User) => {
    setEditUser(user);
    setSelectedPermissions(user.permissions as Permission[] || []);
    reset({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      password: "",
      permissions: (user.permissions || []) as Permission[],
    });
    setDialogOpen(true);
  };

  const togglePermission = (perm: Permission) => {
    setSelectedPermissions((prev) => {
      const next = prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm];
      setValue("permissions", next);
      return next;
    });
  };

  const onSubmit = async (data: UserInput) => {
    setSubmitting(true);
    try {
      const payload = {
        ...data,
        email: data.email.trim().toLowerCase(),
        permissions: data.role === "STAFF_ADMIN" ? selectedPermissions : [],
      };

      const authExpired = () => {
        toast("Session expired — please login again", "error");
        router.replace("/login?redirect=/admin/users");
      };

      if (editUser) {
        const newPassword = payload.password?.trim() ?? "";
        const res = await fetch("/api/users", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            id: editUser._id,
            name: payload.name,
            isActive: payload.isActive,
            permissions: payload.permissions,
            ...(newPassword ? { password: newPassword } : {}),
          }),
        });
        if (res.status === 401) {
          authExpired();
          return;
        }
        const result = await res.json();
        if (!res.ok) {
          toast(result.error || "Failed to update user", "error");
          return;
        }
        toast(
          newPassword ? "User updated — new password is active for login" : "User updated",
          "success"
        );
        router.refresh();
      } else {
        const parsed = createUserSchema.safeParse(payload);
        if (!parsed.success) {
          toast(parsed.error.issues[0].message, "error");
          return;
        }

        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(parsed.data),
        });
        if (res.status === 401) {
          authExpired();
          return;
        }
        const result = await res.json();
        if (!res.ok) {
          toast(result.error, "error");
          return;
        }
        toast(
          `User created — ${parsed.data.email} can login with the password you set`,
          "success"
        );
      }
      setDialogOpen(false);
      const usersRes = await fetch("/api/users", { credentials: "include" });
      const usersData = await usersRes.json();
      setUsers(usersData.users || []);
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageLoader />;

  if (!isMainAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Users</h1>
          <p className="text-sm text-gray-500">User management</p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Only Main Admin can manage users.</p>
            <p className="text-sm text-gray-400 mt-2">Contact your administrator for access changes.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Users</h1>
          <p className="text-sm text-gray-500">Manage admin accounts and permissions</p>
        </div>
        <Button variant="gold" onClick={openCreate}>
          <Plus className="h-4 w-4" /> Create User
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {users.length === 0 ? (
            <EmptyState title="No users" description="Create admin users to get started" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="pb-3 font-medium">Name</th>
                    <th className="pb-3 font-medium">Email</th>
                    <th className="pb-3 font-medium">Role</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Permissions</th>
                    <th className="pb-3 font-medium">Created</th>
                    <th className="pb-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user._id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-3 font-medium">{user.name}</td>
                      <td className="py-3">{user.email}</td>
                      <td className="py-3">
                        <Badge variant={user.role === "MAIN_ADMIN" ? "gold" : "default"}>
                          {user.role === "MAIN_ADMIN" ? "Main Admin" : "Staff Admin"}
                        </Badge>
                      </td>
                      <td className="py-3">
                        <StatusBadge status={user.isActive ? "active" : "inactive"} />
                      </td>
                      <td className="py-3 text-gray-500 max-w-xs truncate">
                        {user.role === "MAIN_ADMIN"
                          ? "All"
                          : user.permissions.join(", ") || "None"}
                      </td>
                      <td className="py-3 text-gray-500">{formatDate(user.createdAt)}</td>
                      <td className="py-3">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editUser ? "Edit User" : "Create User"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input {...register("name")} />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <Label>Email *</Label>
              <Input {...register("email")} type="email" disabled={!!editUser} />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <Label>{editUser ? "New Password (leave blank to keep)" : "Password *"}</Label>
              <Input {...register("password")} type="password" />
              {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <Label>Role</Label>
              <Select {...register("role")} disabled={!!editUser && editUser.role === "MAIN_ADMIN"}>
                <option value="STAFF_ADMIN">Staff Admin</option>
                <option value="MAIN_ADMIN">Main Admin</option>
              </Select>
            </div>
            <div>
              <Label>Active</Label>
              <Select
                value={String(watch("isActive"))}
                onChange={(e) => setValue("isActive", e.target.value === "true")}
              >
                <option value="true">Active</option>
                <option value="false">Inactive</option>
              </Select>
            </div>
            {(role === "STAFF_ADMIN" || editUser?.role === "STAFF_ADMIN") && (
              <div>
                <Label>Permissions</Label>
                <p className="text-xs text-gray-500 mt-1 mb-2">
                  Required for Staff Admin. User can login after creation with email + password above.
                </p>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {PERMISSIONS.map((perm) => (
                    <label key={perm} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(perm)}
                        onChange={() => togglePermission(perm)}
                        className="h-4 w-4 accent-gold"
                      />
                      <span className="capitalize">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" variant="gold" disabled={submitting}>
                {submitting ? "Saving..." : editUser ? "Update User" : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
