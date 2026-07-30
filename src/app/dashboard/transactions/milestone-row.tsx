"use client";

import { useTransition } from "react";
import { toggleMilestoneComplete, deleteMilestone } from "@/app/actions/transactions";

type MilestoneItem = { id: string; label: string; dueDate: Date; completed: boolean };

export function MilestoneRow({
  milestone,
  propertyAddress,
}: {
  milestone: MilestoneItem;
  propertyAddress?: string;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2 rounded-md bg-stone-50 p-2 text-xs">
      <input
        type="checkbox"
        checked={milestone.completed}
        disabled={isPending}
        onChange={(e) => startTransition(() => toggleMilestoneComplete(milestone.id, e.target.checked))}
      />
      <span className={`flex-1 ${milestone.completed ? "text-stone-400 line-through" : "text-stone-700"}`}>
        {milestone.label}
        {propertyAddress && <span className="text-stone-400"> — {propertyAddress}</span>}
      </span>
      <span className="shrink-0 text-stone-400">Due {milestone.dueDate.toLocaleDateString()}</span>
      <button
        disabled={isPending}
        onClick={() => startTransition(() => deleteMilestone(milestone.id))}
        className="shrink-0 text-stone-300 hover:text-red-600 disabled:opacity-50"
        title="Remove this milestone"
      >
        ✕
      </button>
    </div>
  );
}
