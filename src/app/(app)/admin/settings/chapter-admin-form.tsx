"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveChapterAdmin } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHAPTER_ADMIN_MAX_LENGTH } from "@/lib/format";

export function ChapterAdminForm({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardContent className="space-y-3 py-4">
        <div className="space-y-1.5">
          <Label htmlFor="chapter-admin">Chapter Admin</Label>
          <Input
            id="chapter-admin"
            className="max-w-xs"
            maxLength={CHAPTER_ADMIN_MAX_LENGTH}
            placeholder="Full name"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Belongs to the chapter, not to a tenure: starting a new tenure keeps the same name. Usually changed once
            every couple of years.
          </p>
        </div>
        <Button
          disabled={pending || value.trim() === initial.trim()}
          onClick={() =>
            start(async () => {
              const res = await saveChapterAdmin(value);
              if (res.ok) toast.success("Chapter Admin saved.");
              else toast.error(res.error);
            })
          }
        >
          Save Chapter Admin
        </Button>
      </CardContent>
    </Card>
  );
}
