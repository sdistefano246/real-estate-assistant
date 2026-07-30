const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * A reasonable starting checklist for a standard US residential purchase —
 * not tuned to any specific brokerage's actual process yet (see Phase 3 task
 * list, 3B open decision). The agent can delete or add to these once the
 * transaction exists; nothing here is locked.
 */
export function buildDefaultMilestones(contractDate: Date, closingDate: Date) {
  return [
    { label: "Inspection period ends", dueDate: new Date(contractDate.getTime() + 10 * DAY_MS) },
    { label: "Financing contingency deadline", dueDate: new Date(contractDate.getTime() + 21 * DAY_MS) },
    { label: "Appraisal deadline", dueDate: new Date(contractDate.getTime() + 21 * DAY_MS) },
    { label: "Closing", dueDate: closingDate },
  ];
}
