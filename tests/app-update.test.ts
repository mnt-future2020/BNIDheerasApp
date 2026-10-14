import { describe, expect, it } from "vitest";
import { updateOffered } from "@/lib/app-update";

describe("offering the update", () => {
  it("offers it when the server is serving a different build", () => {
    expect(updateOffered("3ba6d5d", "9f10c2a")).toBe(true);
  });

  it("says nothing while the installed app is on the build that is live", () => {
    expect(updateOffered("3ba6d5d", "3ba6d5d")).toBe(false);
  });

  it("stays away when this build has no version to compare", () => {
    // Built where there was no repository to read and no NEXT_DEPLOYMENT_ID set.
    expect(updateOffered("", "9f10c2a")).toBe(false);
  });

  it("stays away when the server has no version to give", () => {
    // An older deployment, before /api/version existed, or one built without one.
    expect(updateOffered("3ba6d5d", "")).toBe(false);
    expect(updateOffered("3ba6d5d", undefined)).toBe(false);
  });
});
