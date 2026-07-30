"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LEAD_STATUSES, LEAD_STATUS_LABELS } from "@/lib/lead-status";

export function LeadFilters({ currentStatus, currentQuery }: { currentStatus: string; currentQuery: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(currentQuery);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParams(next: { status?: string; q?: string }) {
    const params = new URLSearchParams(searchParams.toString());
    const status = next.status ?? currentStatus;
    const q = next.q ?? currentQuery;

    if (status && status !== "all") params.set("status", status);
    else params.delete("status");

    if (q) params.set("q", q);
    else params.delete("q");

    router.push(`${pathname}?${params.toString()}`);
  }

  function onQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParams({ q: value }), 300);
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search name, email, or phone…"
        className="w-64 rounded-md border border-stone-300 px-3 py-1.5 text-sm"
      />

      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => updateParams({ status: "all" })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !currentStatus
              ? "bg-teal-900 text-white"
              : "border border-stone-300 text-stone-600 hover:bg-stone-50"
          }`}
        >
          All
        </button>
        {LEAD_STATUSES.map((status) => (
          <button
            key={status}
            onClick={() => updateParams({ status })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              currentStatus === status
                ? "bg-teal-900 text-white"
                : "border border-stone-300 text-stone-600 hover:bg-stone-50"
            }`}
          >
            {LEAD_STATUS_LABELS[status]}
          </button>
        ))}
      </div>
    </div>
  );
}
