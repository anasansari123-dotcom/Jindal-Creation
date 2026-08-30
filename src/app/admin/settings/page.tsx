"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageLoader } from "@/components/ui/loading";
import { Pagination } from "@/components/ui/pagination";
import { toast } from "@/components/ui/toast";
import { Plus, Trash2, Save } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { DEFAULT_CATEGORIES } from "@/lib/constants";

interface Settings {
  whatsappNumber: string;
  companyName: string;
  companyTagline: string;
  categories: string[];
}

interface ActivityLog {
  _id: string;
  action: string;
  details: string;
  userName: string;
  createdAt: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>({
    whatsappNumber: "",
    companyName: "",
    companyTagline: "",
    categories: DEFAULT_CATEGORIES,
  });
  const [newCategory, setNewCategory] = useState("");
  const [currentUser, setCurrentUser] = useState<{ role: string } | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [logPage, setLogPage] = useState(1);
  const [logTotalPages, setLogTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isMainAdmin = currentUser?.role === "MAIN_ADMIN";

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ])
      .then(([me, settingsData]) => {
        setCurrentUser(me.user || null);
        if (settingsData.settings) setSettings(settingsData.settings);
      })
      .catch(() => toast("Settings load nahi ho payi", "error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!isMainAdmin) return;
    fetch(`/api/activity-logs?page=${logPage}`)
      .then((r) => r.json())
      .then((d) => {
        setLogs(d.logs || []);
        setLogTotalPages(d.pagination?.totalPages || 1);
      })
      .catch(() => {});
  }, [isMainAdmin, logPage]);

  const handleSave = async () => {
    if (!isMainAdmin) {
      toast("Only Main Admin can update settings", "error");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const result = await res.json();
      if (!res.ok) {
        toast(result.error, "error");
        return;
      }
      toast("Settings saved", "success");
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed || settings.categories.includes(trimmed)) return;
    setSettings((s) => ({ ...s, categories: [...s.categories, trimmed] }));
    setNewCategory("");
  };

  const removeCategory = (cat: string) => {
    setSettings((s) => ({ ...s, categories: s.categories.filter((c) => c !== cat) }));
  };

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-navy">Settings</h1>
          <p className="text-sm text-gray-500">Company configuration and preferences</p>
        </div>
        {isMainAdmin && (
          <Button variant="gold" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle>Company Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Company Name</Label>
              <Input
                value={settings.companyName}
                onChange={(e) => setSettings((s) => ({ ...s, companyName: e.target.value }))}
                disabled={!isMainAdmin}
              />
            </div>
            <div>
              <Label>Tagline</Label>
              <Input
                value={settings.companyTagline}
                onChange={(e) => setSettings((s) => ({ ...s, companyTagline: e.target.value }))}
                disabled={!isMainAdmin}
              />
            </div>
            <div>
              <Label>WhatsApp Number</Label>
              <Input
                value={settings.whatsappNumber}
                onChange={(e) => setSettings((s) => ({ ...s, whatsappNumber: e.target.value }))}
                placeholder="919548000895"
                disabled={!isMainAdmin}
              />
              <p className="text-xs text-gray-400 mt-1">Country code, no + or spaces</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Product Categories</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {settings.categories.map((cat) => (
                <span
                  key={cat}
                  className="inline-flex items-center gap-1 rounded-full bg-gold/10 px-3 py-1 text-sm text-navy"
                >
                  {cat}
                  {isMainAdmin && (
                    <button onClick={() => removeCategory(cat)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {isMainAdmin && (
              <div className="flex gap-2">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="New category"
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
                />
                <Button type="button" variant="outline" onClick={addCategory}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {isMainAdmin && (
        <Card>
          <CardHeader><CardTitle>Activity Logs</CardTitle></CardHeader>
          <CardContent>
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No activity logs</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-gray-500">
                        <th className="pb-3 font-medium">Date</th>
                        <th className="pb-3 font-medium">Action</th>
                        <th className="pb-3 font-medium">Description</th>
                        <th className="pb-3 font-medium">By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log._id} className="border-b last:border-0">
                          <td className="py-3 text-gray-500">{formatDateTime(log.createdAt)}</td>
                          <td className="py-3 font-medium">{log.action}</td>
                          <td className="py-3 text-gray-500">{log.details || "—"}</td>
                          <td className="py-3">{log.userName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination page={logPage} totalPages={logTotalPages} total={0} onPageChange={setLogPage} />
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
