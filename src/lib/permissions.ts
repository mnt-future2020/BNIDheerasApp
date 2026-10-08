/**
 * Roles are assigned per term (they rotate every six months). Capabilities are
 * what the code checks. Admin is a technical super-user with every capability,
 * and the President of the current term has exactly the same access.
 */
export const ROLES = {
  president: "President",
  vice_president: "Vice President",
  secretary_treasurer: "Secretary / Treasurer",
  lvh: "LVH Team",
  attendance_coordinator: "Attendance Coordinator",
  event_coordinator: "Event Coordinator",
  feature_presentation_coordinator: "Feature Presentation Coordinator",
} as const;

export type Role = keyof typeof ROLES;
export const ROLE_KEYS = Object.keys(ROLES) as Role[];

export const CAPABILITIES = [
  "kiosk.run",
  "attendance.manual",
  "devices.approve",
  "meeting.finalize",
  "palms.view",
  "meetings.manage",
  "meetings.remove",
  "visitors.manage",
  "awards.manage",
  "calendar.manage",
  "feedback.manage",
  "forms.manage",
  "quiz.manage",
  "members.manage",
  "members.reset_password",
  "roles.manage",
  "settings.manage",
  "audit.view",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export const PERMISSION_ACTIONS = ["view", "create", "edit", "delete"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View",
  create: "Create",
  edit: "Edit",
  delete: "Delete",
};

type PermissionModule = {
  /** The part of the app, named the way the chapter talks about it. */
  module: string;
  /** What the row covers when the four words don't say it: approve, finalize, scan. */
  note?: string;
  /** The capability each action needs. An action left out is one the module doesn't have. */
  does: Partial<Record<PermissionAction, Capability>>;
};

/**
 * The permissions grid behind the eye icon: a module per row, a tick per action.
 * Every capability appears at least once (tests/helpers.test.ts checks that), so
 * the grid stays the full picture of what a role can do.
 */
export const PERMISSION_MODULES: PermissionModule[] = [
  {
    module: "Meetings & venues",
    note: "Schedule a weekly series or one meeting, edit it, add venues while scheduling",
    does: { view: "meetings.manage", create: "meetings.manage", edit: "meetings.manage", delete: "meetings.remove" },
  },
  {
    module: "Cancelling a meeting",
    note: "Call one off, put it back, or delete it outright — the same hands as deleting",
    does: { edit: "meetings.remove", delete: "meetings.remove" },
  },
  {
    module: "Visitors",
    note: "Who visited a meeting, and how many",
    does: { view: "visitors.manage", create: "visitors.manage", edit: "visitors.manage" },
  },
  {
    module: "PALMS",
    note: "Enter a meeting's PALMS by hand with the headcount, and see its summary and report",
    does: { view: "palms.view", create: "attendance.manual", edit: "attendance.manual" },
  },
  {
    module: "Finalizing a meeting",
    note: "Lock PALMS from the summary once the visitor count is in, and reopen it to correct a status",
    does: { edit: "meeting.finalize" },
  },
  {
    module: "Venue screen & visitors",
    note: "Put the check-in QR on the venue screen, pair a screen, and record who visited",
    does: { view: "kiosk.run", create: "kiosk.run", edit: "kiosk.run" },
  },
  {
    module: "Members' phones",
    note: "Approve or reject a phone for check-in, from the member's Action list",
    does: { view: "devices.approve", edit: "devices.approve" },
  },
  {
    module: "Weekly recognitions",
    note: "Pick the winners, publish, unpublish, and see the leaderboard",
    does: { view: "awards.manage", create: "awards.manage", edit: "awards.manage", delete: "awards.manage" },
  },
  {
    module: "Events calendar",
    note: "Events, trainings and presentation slots, with types of your own",
    does: { view: "calendar.manage", create: "calendar.manage", edit: "calendar.manage", delete: "calendar.manage" },
  },
  {
    module: "Suggestions & feedback",
    note: "Consider one or not; either way the member is told",
    does: { view: "feedback.manage", edit: "feedback.manage", delete: "feedback.manage" },
  },
  {
    module: "Forms",
    note: "Write a form, share its link, read the answers — and delete an answer or the form itself",
    does: { view: "forms.manage", create: "forms.manage", edit: "forms.manage", delete: "forms.manage" },
  },
  {
    module: "Quiz",
    note: "Write a quiz with its questions, share the join link, host it live, and delete one that wasn't played",
    does: { view: "quiz.manage", create: "quiz.manage", edit: "quiz.manage", delete: "quiz.manage" },
  },
  {
    module: "Members",
    note: "Add, edit, import from CSV, and deactivate instead of deleting",
    does: { view: "members.manage", create: "members.manage", edit: "members.manage", delete: "members.manage" },
  },
  {
    module: "Member passwords",
    note: "Reset a forgotten one to the default",
    does: { edit: "members.reset_password" },
  },
  {
    module: "Roles, terms & app admins",
    does: { view: "roles.manage", create: "roles.manage", edit: "roles.manage", delete: "roles.manage" },
  },
  {
    module: "Settings",
    note: "The members' default sign-in password",
    does: { view: "settings.manage", edit: "settings.manage" },
  },
  { module: "Audit log", does: { view: "audit.view" } },
];

/**
 * One cell of the grid. "none" and "no" must stay apart: nobody creates an LVH
 * desk, so showing full access a row of crosses would read as if something were
 * being held back.
 */
export type PermissionCell = "yes" | "no" | "none";
export type PermissionRow = { module: string; note?: string; cells: Record<PermissionAction, PermissionCell> };

/** The grid for one set of capabilities, with the modules it can't touch at all left out. */
export function permissionGrid(caps: ReadonlySet<Capability>): PermissionRow[] {
  const rows = PERMISSION_MODULES.map((m) => ({
    module: m.module,
    note: m.note,
    cells: Object.fromEntries(
      PERMISSION_ACTIONS.map((a) => {
        const cap = m.does[a];
        return [a, cap === undefined ? "none" : caps.has(cap) ? "yes" : "no"];
      }),
    ) as Record<PermissionAction, PermissionCell>,
  }));
  return rows.filter((row) => PERMISSION_ACTIONS.some((a) => row.cells[a] === "yes"));
}

/**
 * The Head Table: every capability, the same as an Admin (chapter decisions D7
 * and D11). They can also reset each other's password and the Admin's, so any
 * of them can take over any account; every action is audit-logged instead.
 */
export const FULL_ACCESS_ROLES: Role[] = ["president", "vice_president", "secretary_treasurer"];

const ROLE_CAPS: Record<Role, readonly Capability[]> = {
  president: CAPABILITIES,
  vice_president: CAPABILITIES,
  secretary_treasurer: CAPABILITIES,
  // Visitors, and nothing else. They open a meeting to record who came as a
  // guest; the meeting itself is not theirs to create, edit, cancel or delete,
  // and neither is PALMS, the summary or the venue screen's QR.
  lvh: ["visitors.manage"],
  // PALMS and the summary that reads it back. The meeting itself is somebody
  // else's: no creating, editing, cancelling or deleting, and no visitors.
  attendance_coordinator: ["attendance.manual", "palms.view"],
  // The calendar, and the forms that go with what is on it — a registration or
  // a feedback form for an event is the Event Coordinator's to write and read.
  event_coordinator: ["calendar.manage", "forms.manage"],
  // A feature presentation is a calendar slot, so the calendar is what this
  // role needs: booking the week, naming the presenter, moving it. The quiz
  // that runs in the slot is theirs too — writing it and hosting it live.
  feature_presentation_coordinator: ["calendar.manage", "quiz.manage"],
};

/** The capabilities one role gives, in the order of CAPABILITIES. */
export function roleCapabilities(role: Role): Capability[] {
  return CAPABILITIES.filter((c) => ROLE_CAPS[role].includes(c));
}

/** Admin, or the Head Table of the current term: every capability and the same exemptions. */
export function hasFullAccess(roles: readonly Role[], isAdmin: boolean): boolean {
  return isAdmin || roles.some((r) => FULL_ACCESS_ROLES.includes(r));
}

export function capabilitiesFor(roles: readonly Role[], isAdmin: boolean): Set<Capability> {
  if (hasFullAccess(roles, isAdmin)) return new Set(CAPABILITIES);
  const caps = new Set<Capability>();
  // Roles removed from the app may still sit in old terms' data: they give nothing.
  for (const role of roles) for (const cap of ROLE_CAPS[role] ?? []) caps.add(cap);
  return caps;
}

/**
 * Separation of duties: the people who approve devices must not be able to
 * mark attendance manually, otherwise one person could approve a proxy phone
 * and also cover for it at the door. Admin and the President hold every
 * capability by design, so the rule doesn't apply to them; their actions are
 * audit-logged instead.
 *
 * Only the Head Table approves devices now, so no pair of term roles trips
 * this; it stays as the guard for the day another role is given devices.approve.
 */
export function roleConflict(roles: readonly Role[]): string | null {
  if (hasFullAccess(roles, false)) return null;
  const caps = capabilitiesFor(roles, false);
  if (caps.has("devices.approve") && caps.has("attendance.manual")) {
    return "One person can't both approve devices and do manual check-ins.";
  }
  return null;
}

/**
 * True when `actor` holds every capability `target` holds. Resetting someone's
 * password to the shared default lets you sign in as them, so a Head Table
 * member may only reset people who can't do more than they can (a VP can't
 * reset the President or the Secretary, for example).
 */
export function capsCover(actor: ReadonlySet<Capability>, target: ReadonlySet<Capability>): boolean {
  for (const cap of target) if (!actor.has(cap)) return false;
  return true;
}

export function isRole(value: string): value is Role {
  return value in ROLES;
}
