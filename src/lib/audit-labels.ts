/**
 * The audit log is read by the Head Table, not by developers, so each action
 * key gets a plain sentence. Anything not listed falls back to a tidied-up
 * version of the key, so a new action is still readable before it lands here.
 */
const LABELS: Record<string, string> = {
  // Attendance
  "attendance.sheet": "Entered PALMS",
  "attendance.remove": "Removed an attendance record",
  "absence.followup": "Noted an absence follow-up",
  "substitute.register": "Registered a substitute",
  "substitute.confirm": "Confirmed a substitute arrived",
  // Phones
  "device.register": "Registered a phone",
  "device.register_blocked": "A phone was blocked from registering",
  "device.approve": "Approved a phone",
  "device.reject": "Rejected a phone",
  "device.revoke": "Removed a phone",
  // Venue screen
  "kiosk.pairing_code": "Made a venue screen code",
  "kiosk.paired": "Paired a venue screen",
  "kiosk.pair_failed": "A venue screen code was refused",
  "kiosk.revoke": "Removed a venue screen",
  // Meetings
  "meeting.create": "Created a meeting",
  "meeting.update": "Edited a meeting",
  "meeting.generate_weekly": "Created the weekly meetings",
  "meeting.cancel": "Cancelled a meeting",
  "meeting.restore": "Restored a meeting",
  "meeting.delete": "Deleted a meeting",
  "meeting.clear_attendance": "Cleared a meeting's attendance",
  "meeting.finalize": "Finalized a meeting",
  "meeting.reopen": "Reopened a meeting for corrections",
  "meeting.headcount": "Saved the headcount",
  "meeting.visitors": "Saved the visitors",
  "venue.create": "Added a venue",
  "venue.update": "Edited a venue",
  // Can't attend
  "leave.medical": "Asked for medical leave",
  "leave.informed": "Said they can't attend",
  "leave.record": "Wrote down that a member can't attend",
  "leave.approve": "Approved medical leave",
  "leave.reject": "Rejected medical leave",
  "leave.cancel": "Took back a can't-attend",
  // Members
  "member.create": "Added a member",
  "member.update": "Edited a member",
  "member.active": "Reactivated a member",
  "member.inactive": "Deactivated a member",
  "member.import_csv": "Imported members from CSV",
  "member.password_set": "A member chose their password",
  "member.password_change": "A member changed their password",
  "member.password_reset": "Reset a member's password",
  // Recognitions
  "awards.save_draft": "Saved a recognitions draft",
  "awards.publish": "Published the recognitions",
  "awards.unpublish": "Unpublished the recognitions",
  "awards.clear": "Cleared the recognitions",
  // Forms
  "form.create": "Made a form",
  "form.update": "Edited a form",
  "form.pause": "Stopped a form taking answers",
  "form.reopen": "Opened a form again",
  "form.delete": "Deleted a form and its answers",
  "form.response_delete": "Deleted one answer to a form",
  // Quiz
  "quiz.create": "Made a quiz",
  "quiz.update": "Edited a quiz",
  "quiz.questions": "Saved a quiz's questions",
  "quiz.open": "Opened a quiz for joining",
  "quiz.start": "Started a quiz",
  "quiz.end": "Finished a quiz",
  "quiz.reset": "Reset a quiz and cleared its players",
  "quiz.delete": "Deleted a quiz",
  // Events
  "calendar.create": "Added an event",
  "calendar.update": "Edited an event",
  "calendar.delete": "Deleted an event",
  // Feedback
  "feedback.submit": "Sent feedback",
  "feedback.review": "Answered feedback",
  "feedback.delete": "Deleted feedback",
  // Roles, tenures and settings
  "role.assign": "Gave someone a role",
  "role.remove": "Took a role away",
  "term.create": "Created a tenure",
  "term.update": "Edited a tenure",
  "term.delete": "Deleted a tenure",
  "settings.chapter_admin": "Changed the Chapter Admin",
  "settings.default_password": "Changed the default password",
};

export function auditLabel(action: string): string {
  const known = LABELS[action];
  if (known) return known;
  // e.g. "meeting.some_new_thing" → "Meeting · some new thing"
  const [group, ...rest] = action.split(".");
  const tail = rest.join(".").replace(/_/g, " ");
  const head = group.charAt(0).toUpperCase() + group.slice(1);
  return tail ? `${head} · ${tail}` : head;
}

/**
 * The one thing the row is about, pulled out of what was saved — a member's
 * name, a meeting's title. Keeps the line short where the full before/after
 * would be a wall of JSON.
 */
export function auditSubject(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  for (const key of ["member", "name", "fullName", "title", "label", "who"]) {
    const found = v[key];
    if (typeof found === "string" && found.trim()) return found.trim();
  }
  return null;
}
