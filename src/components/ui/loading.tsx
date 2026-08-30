"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingSpinner({
  className,
  label = "Loading",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div role="status" aria-live="polite" className="inline-flex items-center gap-2">
      <Loader2
        className={cn("h-6 w-6 animate-spin text-gold motion-reduce:animate-none", className)}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function PageLoader({ message = "Loading page" }: { message?: string }) {
  return (
    <div
      className="flex min-h-[400px] items-center justify-center"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <LoadingSpinner className="h-8 w-8" label={message} />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center" role="status">
      <h3 className="text-lg font-medium text-navy">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-gray-600">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
