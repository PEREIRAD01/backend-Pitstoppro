export function todayMidnight(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function calcOverdue(dueDate: Date | null | undefined, today: Date): { isOverdue: boolean; daysOverdue: number } {
  if (!dueDate) return { isOverdue: false, daysOverdue: 0 };
  const due = new Date(dueDate);
  const isOverdue = due < today;
  const daysOverdue = isOverdue ? Math.floor((today.getTime() - due.getTime()) / 86400000) : 0;
  return { isOverdue, daysOverdue };
}
