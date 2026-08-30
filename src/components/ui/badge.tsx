import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "danger" | "gold" | "secondary";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        {
          "bg-navy/10 text-navy": variant === "default",
          "bg-green-100 text-green-800": variant === "success",
          "bg-amber-100 text-amber-800": variant === "warning",
          "bg-red-100 text-red-800": variant === "danger",
          "bg-gold/20 text-navy": variant === "gold",
          "bg-gray-100 text-gray-700": variant === "secondary",
        },
        className
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, BadgeProps["variant"]> = {
    PENDING: "warning",
    CONFIRMED: "default",
    VERIFIED: "gold",
    DISPATCHED: "success",
    COMPLETED: "success",
    UNPAID: "danger",
    PARTIAL: "warning",
    PAID: "success",
    "Fully Paid": "success",
    Pending: "warning",
    "Advance": "gold",
    "Dispatch Bill": "warning",
    "Final Bill": "success",
    "No Bills": "secondary",
    "In Stock": "success",
    "Low Stock": "warning",
    "Out of Stock": "danger",
    active: "success",
    inactive: "secondary",
  };
  return (
    <Badge variant={variants[status] || "default"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
