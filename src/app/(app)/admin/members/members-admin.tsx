"use client";

import { CheckIcon, CopyIcon, EyeIcon, PencilIcon, PlusIcon, SearchIcon, UploadIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { addMember, type ImportReport, importMembersCsv, setMemberStatus, updateMember } from "@/actions/members";
import { ConfirmButton } from "@/components/confirm-button";
import { ApproveDeviceButton, RevokeDeviceButton } from "@/components/device-buttons";
import { PaginationButtons } from "@/components/pagination";
import { PasswordButton } from "@/components/password-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Row = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  businessName: string | null;
  category: string | null;
  status: "active" | "inactive";
  joinedOn: string | null;
  isAdmin: boolean;
  isChapterMember: boolean;
  /** Their check-in phone: the one waiting for approval, else the approved one. */
  phoneDevice: { id: string; status: "pending" | "approved"; label: string; code: string } | null;
};

const PAGE_SIZE = 25;
export type Filter = "active" | "inactive" | "all" | "waiting";
export const isFilter = (v: string): v is Filter => v === "active" || v === "inactive" || v === "all" || v === "waiting";
const FILTER_LABELS: Record<Filter, string> = {
  active: "Active",
  inactive: "Inactive",
  all: "All",
  waiting: "Phone waiting",
};

/** Someone who registered a phone that nobody has approved yet. */
const isWaiting = (m: Row) => m.phoneDevice?.status === "pending";

export function MembersAdmin({
  members,
  meId,
  canApproveDevices,
  initialFilter = "active",
}: {
  members: Row[];
  meId: string;
  /** Device approval is a separate capability, so the option is hidden without it. */
  canApproveDevices: boolean;
  /** From ?filter=, so a link can open straight on the phones waiting. */
  initialFilter?: Filter;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Row | "new" | null>(null);
  const [viewing, setViewing] = useState<Row | null>(null);
  // The id, not the row: approving a phone re-renders this list, and the open
  // dialog has to show the new state instead of the row it was opened with.
  const [actingId, setActingId] = useState<string | null>(null);
  const acting = actingId === null ? null : (members.find((m) => m.id === actingId) ?? null);
  const [importOpen, setImportOpen] = useState(false);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter(
      (m) =>
        (filter === "all" || (filter === "waiting" ? isWaiting(m) : m.status === filter)) &&
        (!q || [m.fullName, m.email, m.phone, m.businessName, m.category].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [members, query, filter]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const counts: Record<Filter, number> = {
    active: members.filter((m) => m.status === "active").length,
    inactive: members.filter((m) => m.status === "inactive").length,
    all: members.length,
    waiting: members.filter(isWaiting).length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-56 flex-1">
          <SearchIcon className="absolute top-2 left-2.5 size-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search members"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <Button onClick={() => setEditing("new")}>
          <PlusIcon /> Add member
        </Button>
        <Button variant="outline" onClick={() => setImportOpen(true)}>
          <UploadIcon /> Import CSV
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {(["active", "inactive", "all", "waiting"] as const)
          // Without the capability the phone column is empty, so the filter would always read (0).
          .filter((f) => f !== "waiting" || canApproveDevices)
          .map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => {
                setFilter(f);
                setPage(1);
              }}
            >
              {FILTER_LABELS[f]} ({counts[f]})
            </Button>
          ))}
      </div>
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="hidden md:table-cell">Business</TableHead>
              <TableHead className="text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-6 text-center text-sm text-muted-foreground">
                  No members found.
                </TableCell>
              </TableRow>
            ) : null}
            {shown.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1 font-medium">
                    {m.fullName}
                    {m.isAdmin ? <Badge variant="outline">admin</Badge> : null}
                    {isWaiting(m) ? <Badge>phone waiting</Badge> : null}
                  </div>
                  <div className="text-xs text-muted-foreground md:hidden">{m.businessName}</div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div>{m.businessName}</div>
                  <div className="text-xs text-muted-foreground">{m.category}</div>
                </TableCell>
                <TableCell>
                  <div className="flex justify-center">
                    <Button variant="outline" size="sm" aria-label={`Actions for ${m.fullName}`} onClick={() => setActingId(m.id)}>
                      Action
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationButtons
        className="mt-0"
        page={current}
        pageCount={pageCount}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
      {acting ? (
        <ActionsDialog
          row={acting}
          isMe={acting.id === meId}
          canApproveDevices={canApproveDevices}
          onClose={() => setActingId(null)}
          onView={() => {
            setActingId(null);
            setViewing(acting);
          }}
          onEdit={() => {
            setActingId(null);
            setEditing(acting);
          }}
        />
      ) : null}
      {editing ? <MemberDialog row={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
      {viewing ? <ContactDialog row={viewing} onClose={() => setViewing(null)} /> : null}
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

/**
 * Everything you can do to one member. Four icons never fitted the row on a
 * phone, so the row carries one button and the choices live here.
 *
 * View and Edit take over from this dialog; Password and Deactivate ask their
 * own question on top of it, so cancelling comes back to this list.
 */
function ActionsDialog({
  row,
  isMe,
  canApproveDevices,
  onClose,
  onView,
  onEdit,
}: {
  row: Row;
  /** You can't deactivate yourself. */
  isMe: boolean;
  canApproveDevices: boolean;
  onClose: () => void;
  onView: () => void;
  onEdit: () => void;
}) {
  const item = "w-full justify-start";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row.fullName}</DialogTitle>
          <DialogDescription>{row.businessName ?? "Choose what to do."}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-0.5">
          <Button variant="ghost" size="sm" className={item} onClick={onView}>
            <EyeIcon /> View contact
          </Button>
          <Button variant="ghost" size="sm" className={item} onClick={onEdit}>
            <PencilIcon /> Edit details
          </Button>
          {row.status === "active" ? <PasswordButton memberId={row.id} name={row.fullName} className={item} /> : null}
          {isMe ? null : row.status === "active" ? (
            <ConfirmButton
              label="Deactivate"
              className={item}
              icon={<UserXIcon />}
              title={`Deactivate ${row.fullName}?`}
              description="They're signed out everywhere, can't sign in, and are no longer expected at meetings. Their history stays, and you can reactivate them later."
              success={`${row.fullName} deactivated.`}
              action={() => setMemberStatus(row.id, "inactive")}
            />
          ) : (
            <ConfirmButton
              label="Reactivate"
              className={item}
              icon={<UserCheckIcon />}
              title={`Reactivate ${row.fullName}?`}
              description="They can sign in again and are expected at meetings."
              success={`${row.fullName} reactivated.`}
              action={() => setMemberStatus(row.id, "active")}
              destructive={false}
            />
          )}
        </div>
        {canApproveDevices ? <PhoneActions row={row} /> : null}
      </DialogContent>
    </Dialog>
  );
}

/** The check-in phone, approved or removed without leaving the member. */
function PhoneActions({ row }: { row: Row }) {
  const d = row.phoneDevice;
  return (
    <div className="border-t pt-3">
      <p className="px-2 pb-1.5 text-xs text-muted-foreground">
        {d?.status === "pending" ? (
          <>
            Phone waiting for approval · <b className="font-mono tracking-widest">{d.code}</b> · {d.label}
          </>
        ) : d ? (
          `Approved phone · ${d.label}`
        ) : (
          "No phone registered for check-in."
        )}
      </p>
      {d?.status === "pending" ? (
        <div className="grid gap-2">
          <ApproveDeviceButton id={d.id} name={row.fullName} code={d.code} className="w-full" />
          <RevokeDeviceButton id={d.id} name={row.fullName} pending className="w-full" />
        </div>
      ) : d ? (
        <RevokeDeviceButton id={d.id} name={row.fullName} className="w-full justify-start" />
      ) : null}
    </div>
  );
}

/** The eye icon on a member: their email and mobile, each copied by tapping it. */
function ContactDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row.fullName}</DialogTitle>
          <DialogDescription>{row.businessName ?? "Tap a value to copy it."}</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd>
            <CopyValue value={row.email} label="Email" />
          </dd>
          <dt className="text-muted-foreground">Mobile</dt>
          <dd>
            {row.phone ? <CopyValue value={row.phone} label="Mobile" /> : <span className="text-muted-foreground">Not saved</span>}
          </dd>
        </dl>
      </DialogContent>
    </Dialog>
  );
}

/** Shows a value and copies it to the clipboard when tapped. */
function CopyValue({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title={`Copy ${label.toLowerCase()}`}
      className="-mx-1.5 flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left font-medium break-all hover:bg-muted"
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        toast.success(`${label} copied.`);
      }}
    >
      <span className="flex-1">{value}</span>
      {copied ? <CheckIcon className="size-3.5 shrink-0 text-muted-foreground" /> : <CopyIcon className="size-3.5 shrink-0 text-muted-foreground" />}
    </button>
  );
}

function MemberDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const [pending, start] = useTransition();
  // Not on the form any more, but both are overwritten on every save, so the
  // stored values have to be sent back: new members join the chapter today.
  const isChapterMember = row?.isChapterMember ?? true;
  function submit(formData: FormData) {
    const input = {
      fullName: String(formData.get("fullName") ?? ""),
      email: String(formData.get("email") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      businessName: String(formData.get("businessName") ?? ""),
      category: String(formData.get("category") ?? ""),
      joinedOn: row?.joinedOn ?? "",
    };
    start(async () => {
      const res = row ? await updateMember(row.id, input, isChapterMember) : await addMember(input, isChapterMember);
      if (!res.ok) return void toast.error(res.error);
      toast.success(row ? "Member updated." : "Member added. Tap Password next to their name to send their login on WhatsApp.");
      onClose();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{row ? `Edit ${row.fullName}` : "Add member"}</DialogTitle>
          <DialogDescription>
            The mobile number is their login ID. New members start on the default password and choose their own at the
            first sign-in.
          </DialogDescription>
        </DialogHeader>
        <form action={submit} className="grid gap-3">
          <Field name="fullName" label="Full name" defaultValue={row?.fullName} required />
          <Field name="email" label="Email" type="email" defaultValue={row?.email} required />
          <Field name="phone" label="Mobile" defaultValue={row?.phone ?? ""} />
          <Field name="businessName" label="Business name" defaultValue={row?.businessName ?? ""} />
          <Field name="category" label="Category / classification" defaultValue={row?.category ?? ""} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field(props: { name: string; label: string; type?: string; defaultValue?: string; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`f-${props.name}`}>{props.label}</Label>
      <Input
        id={`f-${props.name}`}
        name={props.name}
        type={props.type ?? "text"}
        defaultValue={props.defaultValue}
        required={props.required}
      />
    </div>
  );
}

function ImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [report, setReport] = useState<ImportReport | null>(null);
  const [pending, start] = useTransition();
  async function onFile(file: File) {
    const text = await file.text();
    // A big roster takes a while on a remote database: keep a toast up for the
    // whole wait so there's always something on screen, then settle it.
    const toastId = toast.loading(`Importing ${file.name}…`);
    start(async () => {
      const res = await importMembersCsv(text);
      if (!res.ok) return void toast.error(res.error, { id: toastId });
      setReport(res.data);
      const { created, skipped } = res.data;
      const summary = `${created} member${created === 1 ? "" : "s"} added${skipped.length ? `, ${skipped.length} skipped` : ""}.`;
      if (created > 0) toast.success(summary, { id: toastId });
      else toast.warning(summary === "0 members added." ? "Nothing imported — every row was skipped." : summary, { id: toastId });
    });
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setReport(null);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import members from CSV</DialogTitle>
          <DialogDescription>
            Columns: Name, Email (required), Mobile, Business, Category, Joined on. Export the chapter roster from BNI
            Connect, open it in Excel, and save as CSV. Existing emails are skipped.
          </DialogDescription>
        </DialogHeader>
        <Input
          type="file"
          accept=".csv,text/csv"
          disabled={pending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Cleared, so picking the same file again still fires onChange.
            e.target.value = "";
            if (file) onFile(file);
          }}
        />
        {report ? (
          <div className="space-y-1 text-sm">
            <p>
              Added <b>{report.created}</b>, skipped <b>{report.skipped.length}</b>.
            </p>
            {report.skipped.slice(0, 15).map((s) => (
              <p key={s.row} className="text-muted-foreground">
                Row {s.row}: {s.reason}
              </p>
            ))}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
