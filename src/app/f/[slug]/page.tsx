import { and, count, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/db";
import { form, formResponse } from "@/db/schema";
import { formState, STATE_MESSAGES } from "@/lib/forms";
import { getCurrentMember } from "@/lib/session";
import { FillForm } from "./fill-form";

/* The one page in the app that a stranger is meant to reach. It sits outside
   the (app) group deliberately: that group's layout calls requireMember(),
   which would bounce every visitor to the login screen. Here signing in is
   something that helps rather than something that is demanded. */

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/f/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [f] = await db.select({ title: form.title, description: form.description }).from(form).where(eq(form.slug, slug));
  if (!f) return { title: "Form not found" };
  return { title: f.title, description: f.description ?? undefined };
}

export default async function PublicFormPage({ params }: PageProps<"/f/[slug]">) {
  const { slug } = await params;
  const [f] = await db.select().from(form).where(eq(form.slug, slug));
  if (!f) notFound();

  const me = await getCurrentMember();
  const [{ responses }] = await db.select({ responses: count() }).from(formResponse).where(eq(formResponse.formId, f.id));
  const state = formState(f, responses);

  // Members-only forms say so rather than pretending not to exist: the person
  // holding the link was given it on purpose, and the way in is a sign-in.
  const needsSignIn = f.visibility === "members" && !me;

  // Already answered, and the form only takes one each. Checked again when the
  // answer is sent, because this page can sit open for a long time.
  const alreadyAnswered = f.onePerMember && me ? await hasAnswered(f.id, me.id) : false;

  return (
    <Shell>
      <h1 className="text-2xl font-bold tracking-tight">{f.title}</h1>
      {f.description ? <p className="mt-2 whitespace-pre-line text-muted-foreground">{f.description}</p> : null}

      <div className="mt-6">
        {state !== "open" ? (
          <Notice>{STATE_MESSAGES[state]}</Notice>
        ) : needsSignIn ? (
          <Notice>
            {/* Sign-in always lands on the home page, so the way back here is
                this link — which is why it is spelled out rather than implied. */}
            <p>This form is for chapter members. Please sign in, then open this link again.</p>
            <Button asChild className="mt-3">
              <Link href="/login">Sign in</Link>
            </Button>
          </Notice>
        ) : alreadyAnswered ? (
          <Notice>You have already answered this form. Thank you!</Notice>
        ) : (
          <FillForm
            formId={f.id}
            fields={f.fields}
            me={me ? { name: me.fullName, email: me.email, phone: me.phone } : null}
          />
        )}
      </div>
    </Shell>
  );
}

async function hasAnswered(formId: string, memberId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: formResponse.id })
    .from(formResponse)
    .where(and(eq(formResponse.formId, formId), eq(formResponse.memberId, memberId)))
    .limit(1);
  return Boolean(row);
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4">
          <BrandLogo height={36} preload />
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">{children}</main>
      <footer className="mx-auto w-full max-w-2xl px-4 pb-8 text-xs text-muted-foreground">
        Answers go to the BNI Dheeras chapter leadership team.
      </footer>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-6 text-sm">{children}</CardContent>
    </Card>
  );
}
