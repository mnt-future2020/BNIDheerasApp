"use client";

import { CheckIcon, EyeIcon, XIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { assignRole, removeRole, setAdmin } from "@/actions/roles";
import { ConfirmButton } from "@/components/confirm-button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PERMISSION_ACTION_LABELS, PERMISSION_ACTIONS, type PermissionRow } from "@/lib/permissions";

type MemberOpt = { id: string; fullName: string; isAdmin: boolean; isChapterMember: boolean };
type RoleInfo = { key: string; label: string; fullAccess: boolean; can: PermissionRow[]; notWith: string[] };

export function RolesAdmin({
  meId,
  selectedTermId,
  members,
  assignments,
  roles,
  everything,
}: {
  meId: string;
  selectedTermId: string | null;
  members: MemberOpt[];
  assignments: { id: string; role: string; memberId: string }[];
  roles: RoleInfo[];
  /** Every permission, for full access (App admin and President). */
  everything: PermissionRow[];
}) {
  const [pending, start] = useTransition();
  const [memberId, setMemberId] = useState("");
  const [role, setRole] = useState("");
  const nameOf = (id: string) => members.find((m) => m.id === id)?.fullName ?? "Former member";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) toast.error((res as { error: string }).error);
      else if (ok) toast.success(ok);
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {selectedTermId ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Assign a role</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 sm:flex-row">
              <Select value={memberId} onValueChange={setMemberId}>
                <SelectTrigger className="w-full sm:w-56">
                  <SelectValue placeholder="Member" />
                </SelectTrigger>
                <SelectContent>
                  {members
                    .filter((m) => m.isChapterMember)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.key} value={r.key}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                disabled={pending || !memberId || !role}
                onClick={() => run(() => assignRole(selectedTermId, memberId, role), "Role assigned.")}
              >
                Assign
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Not a term role, but it's who runs the app, so it's listed with the roles. */}
          <Card>
            <CardContent className="py-3">
              <div className="mb-2 flex items-center gap-1 text-sm font-semibold">
                <span className="flex-1">
                  App admin<span className="ml-1.5 font-normal text-muted-foreground">· full access, every term</span>
                </span>
                <PermissionsButton title="App admin" note="Full access: everything in the app, in every term." can={everything} />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {members
                  .filter((m) => m.isAdmin)
                  .map((m) => (
                    <Badge key={m.id} variant="secondary">
                      {m.fullName}
                    </Badge>
                  ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Change who is an admin under App admins.</p>
            </CardContent>
          </Card>
          {roles.map((r) => {
            const holders = assignments.filter((a) => a.role === r.key);
            return (
              <Card key={r.key}>
                <CardContent className="py-3">
                  <div className="mb-2 flex items-center gap-1 text-sm font-semibold">
                    <span className="flex-1">
                      {r.label}
                      {r.fullAccess ? (
                        <span className="ml-1.5 font-normal text-muted-foreground">· full access, same as Admin</span>
                      ) : null}
                    </span>
                    <PermissionsButton
                      title={r.label}
                      note={r.fullAccess ? "Full access, the same as an app admin, for this term." : undefined}
                      can={r.fullAccess ? everything : r.can}
                      notWith={r.notWith}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {holders.length === 0 ? <span className="text-sm text-muted-foreground">Nobody</span> : null}
                    {holders.map((h) => (
                      <Badge key={h.id} variant="secondary" className="gap-0.5 pr-0.5">
                        {nameOf(h.memberId)}
                        <ConfirmButton
                          label=""
                          icon={<XIcon className="size-3" />}
                          ariaLabel={`Remove ${nameOf(h.memberId)}`}
                          className="size-5 p-0"
                          title={`Remove ${nameOf(h.memberId)} as ${r.label}?`}
                          description="Their permissions for this role end right away."
                          confirmLabel="Remove"
                          success="Role removed."
                          action={() => removeRole(h.id)}
                        />
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">App admins</CardTitle>
            <CardDescription>The President of the current term has the same access without this tick.</CardDescription>
          </CardHeader>
          <CardContent className="max-h-80 space-y-2 overflow-y-auto">
            {/* Current admins first, so they're visible without scrolling. */}
            {[...members]
              .sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin))
              .map((m) => (
                <AdminToggle key={m.id} member={m} disabled={m.id === meId} />
              ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** The eye icon on a role: a module per row, a tick per action. */
function PermissionsButton({
  title,
  note,
  can,
  notWith = [],
}: {
  title: string;
  note?: string;
  can: PermissionRow[];
  notWith?: string[];
}) {
  const [open, setOpen] = useState(false);
  // Only full access has nothing held back, and then the dash legend would mislead.
  const anyDenied = can.some((row) => PERMISSION_ACTIONS.some((a) => row.cells[a] === "no"));
  return (
    <>
      <Button variant="ghost" size="icon-sm" aria-label={`What ${title} can do`} onClick={() => setOpen(true)}>
        <EyeIcon />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{title}: what they can do</DialogTitle>
            <DialogDescription>
              {note ?? "Besides what every member can do (check in, events, profile, dance card, feedback):"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  {PERMISSION_ACTIONS.map((a) => (
                    <TableHead key={a} className="w-16 text-center">
                      {PERMISSION_ACTION_LABELS[a]}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {can.map((row) => (
                  <TableRow key={row.module}>
                    <TableCell className="whitespace-normal">
                      <div className="font-medium">{row.module}</div>
                      {row.note ? <div className="text-xs text-muted-foreground">{row.note}</div> : null}
                    </TableCell>
                    {PERMISSION_ACTIONS.map((a) => (
                      <TableCell key={a} className="text-center">
                        {row.cells[a] === "yes" ? (
                          <CheckIcon className="mx-auto size-4 text-primary" aria-label="Yes" />
                        ) : row.cells[a] === "no" ? (
                          <XIcon className="mx-auto size-4 text-muted-foreground" aria-label="No" />
                        ) : (
                          <span className="text-muted-foreground/50" aria-label="Not something this module does">
                            –
                          </span>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs text-muted-foreground">
            A – is an action the module doesn&apos;t have at all: a meeting is finalized, never created twice.
            {anyDenied ? " A ✕ is something this role can't do." : null}
          </p>
          {notWith.length ? (
            <p className="text-xs text-muted-foreground">
              Can&apos;t be held together with {notWith.join(" or ")}: one person can&apos;t both approve phones and mark
              attendance by hand.
            </p>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Admin tick with a confirmation: it grants or removes full access. */
function AdminToggle({ member: m, disabled }: { member: MemberOpt; disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const next = !m.isAdmin;
  return (
    <>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={m.isAdmin} disabled={disabled || pending} onCheckedChange={() => setOpen(true)} />
        {m.fullName}
      </label>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{next ? `Make ${m.fullName} an app admin?` : `Remove ${m.fullName}'s admin access?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {next
                ? "Admins can do everything in the app: members, roles, settings, attendance corrections and the audit log."
                : "They keep the permissions of any roles they hold this term."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              variant={next ? "default" : "destructive"}
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await setAdmin(m.id, next);
                  if (!res.ok) return void toast.error(res.error);
                  setOpen(false);
                  toast.success(next ? "Admin access granted." : "Admin access removed.");
                  router.refresh();
                })
              }
            >
              {next ? "Make admin" : "Remove admin"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
