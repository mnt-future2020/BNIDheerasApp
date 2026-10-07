"use client";

import { KeyRoundIcon, LogOutIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { MemberAvatar } from "@/components/member-avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";

export function UserMenu({
  name,
  email,
  loginId,
  photoUrl,
  isChapterMember,
}: {
  name: string;
  email: string;
  /** Mobile number, or the email when there is none: what they sign in with. */
  loginId: string;
  photoUrl: string | null;
  isChapterMember: boolean;
}) {
  const router = useRouter();
  const [changing, setChanging] = useState(false);
  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }
  return (
    <DropdownMenu>
      {/* The chapter's red ring marks this out as your own account, not just another face. */}
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
        <MemberAvatar name={name} src={photoUrl} className="size-9 ring-2 ring-primary" />
        <span className="sr-only">Account menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="truncate font-medium">{name}</div>
          <div className="truncate text-xs font-normal text-muted-foreground">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/* An admin-only login is not a person: no profile, just its password. */}
        {isChapterMember ? (
          <DropdownMenuItem asChild>
            <Link href="/me">
              <UserIcon /> My profile
            </Link>
          </DropdownMenuItem>
        ) : null}
        {/* Above Sign out: it is the thing you came here to do, not the exit. */}
        <DropdownMenuItem onSelect={() => setChanging(true)}>
          <KeyRoundIcon /> Change password
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
      <ChangePasswordDialog open={changing} onOpenChange={setChanging} loginId={loginId} />
    </DropdownMenu>
  );
}

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        await authClient.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOutIcon className="size-5" /> Sign out
    </button>
  );
}
