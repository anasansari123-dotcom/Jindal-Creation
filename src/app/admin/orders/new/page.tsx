import { redirect } from "next/navigation";

/** Legacy order creation — redirect to dispatch bill flow */
export default function LegacyNewOrderPage() {
  redirect("/admin/dispatch/new");
}
