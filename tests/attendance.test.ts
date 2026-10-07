import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { jwkThumbprint, parsePublicJwk, verifyDeviceSignature } from "@/lib/attendance/device-crypto";
import { signedPayload } from "@/lib/attendance/payloads";
import {
  newMeetingSecret,
  parseQrToken,
  QR_WINDOW_SECONDS,
  signQrToken,
  verifyQrToken,
  windowAt,
} from "@/lib/attendance/qr-token";
import { longDate, reportText } from "@/lib/attendance/report-text";
import {
  checkinClosingTime,
  checkinWindow,
  isFutureMeetingDay,
  lateCutoff,
  planDeadline,
  statusForCheckin,
  undoDeadline,
} from "@/lib/attendance/rules";

const MEETING = "b460bf1a-4c36-4089-8561-1da595e2f14a";

describe("rotating venue QR token (T3, T6, T11)", () => {
  const secret = newMeetingSecret();
  const now = Date.UTC(2026, 9, 8, 1, 30, 7); // 07:00:07 IST
  const w = windowAt(now);

  it("accepts the current window", () => {
    const parsed = parseQrToken(signQrToken(MEETING, secret, w))!;
    expect(verifyQrToken(parsed, secret, now)).toBe("ok");
  });

  it("accepts the previous window (scan latency) but not older ones", () => {
    const prev = parseQrToken(signQrToken(MEETING, secret, w - 1))!;
    expect(verifyQrToken(prev, secret, now)).toBe("ok");
    const old = parseQrToken(signQrToken(MEETING, secret, w - 2))!;
    expect(verifyQrToken(old, secret, now)).toBe("expired");
  });

  it("is useless after at most 30 seconds (a forwarded screenshot)", () => {
    const token = parseQrToken(signQrToken(MEETING, secret, w))!;
    expect(verifyQrToken(token, secret, now + 2 * QR_WINDOW_SECONDS * 1000)).toBe("expired");
  });

  it("rejects future windows, other secrets and tampering", () => {
    const future = parseQrToken(signQrToken(MEETING, secret, w + 1))!;
    expect(verifyQrToken(future, secret, now)).toBe("invalid");
    const other = parseQrToken(signQrToken(MEETING, newMeetingSecret(), w))!;
    expect(verifyQrToken(other, secret, now)).toBe("invalid");
    const token = signQrToken(MEETING, secret, w);
    const tampered = parseQrToken(token.replace(`.${w}.`, `.${w - 1}.`))!;
    expect(verifyQrToken(tampered, secret, now)).toBe("invalid");
  });

  it("rejects malformed tokens", () => {
    expect(parseQrToken("https://example.com")).toBeNull();
    expect(parseQrToken(`BNID1.${MEETING}.abc.xxxxxxxxxxxxxxxxxxxxxx`)).toBeNull();
    expect(parseQrToken(`BNID2.${MEETING}.1.xxxxxxxxxxxxxxxxxxxxxx`)).toBeNull();
  });
});

describe("late rule (exact start time unless grace is set)", () => {
  const start = new Date("2026-10-08T01:30:00Z"); // 07:00 IST

  it("with no grace, 07:00:00 is on time and 07:00:01 is late", () => {
    expect(statusForCheckin(new Date(start.getTime()), start, null)).toBe("P");
    expect(statusForCheckin(new Date(start.getTime() + 1000), start, null)).toBe("L");
  });

  it("with grace, late only after start + grace", () => {
    expect(lateCutoff(start, 5).toISOString()).toBe("2026-10-08T01:35:00.000Z");
    expect(statusForCheckin(new Date(start.getTime() + 5 * 60_000), start, 5)).toBe("P");
    expect(statusForCheckin(new Date(start.getTime() + 5 * 60_000 + 1), start, 5)).toBe("L");
  });

  it("check-in window opens and closes on server time (T7)", () => {
    const opens = new Date(start.getTime() - 60 * 60_000);
    const ends = new Date(start.getTime() + 90 * 60_000);
    expect(checkinWindow(new Date(opens.getTime() - 1), opens, ends)).toBe("not_open_yet");
    expect(checkinWindow(start, opens, ends)).toBe("open");
    expect(checkinWindow(new Date(ends.getTime() + 1), opens, ends)).toBe("closed");
  });

  it("uses the meeting's own deadline for check-in", () => {
    const endsAt = new Date(start.getTime() + 90 * 60_000);
    const checkinClosesAt = new Date(start.getTime() + 15 * 60_000);
    expect(checkinClosingTime({ endsAt, checkinClosesAt })).toBe(checkinClosesAt);
    // Unset: check-in runs to the end of the meeting.
    expect(checkinClosingTime({ endsAt, checkinClosesAt: null })).toBe(endsAt);
  });

  it("closes reasons when check-in opens, and undo when the meeting starts", () => {
    const checkinOpensAt = new Date(start.getTime() - 60 * 60_000);
    // Saying "can't attend" has to be in before the doors open...
    expect(planDeadline({ checkinOpensAt })).toBe(checkinOpensAt);
    // ...but it can be taken back right up to the meeting itself.
    expect(undoDeadline({ startsAt: start })).toBe(start);
    expect(undoDeadline({ startsAt: start }).getTime()).toBeGreaterThan(planDeadline({ checkinOpensAt }).getTime());
  });
});

describe("post-meeting report", () => {
  const report = {
    date: longDate(new Date("2026-09-25T01:30:00Z")), // 07:00 IST
    place: "MARRIOT",
    totals: { members: 61, present: 57, absent: 2, substitute: 2, medical: 0, late: 1 },
    absent: ["Sabari Kannan", "Ajay"],
    substitute: ["Johnson", "Uma"],
    late: ["Saravanakumar"],
  };

  it("writes the chapter's WhatsApp message", () => {
    expect(longDate(new Date("2026-09-25T01:30:00Z"))).toBe("25th SEPTEMBER 2026");
    // 11th-13th don't take st/nd/rd.
    expect(longDate(new Date("2026-09-11T01:30:00Z"))).toBe("11th SEPTEMBER 2026");
    expect(longDate(new Date("2026-09-01T01:30:00Z"))).toBe("1st SEPTEMBER 2026");

    expect(reportText(report)).toBe(
      [
        "🅱️ BNI DHEERAS",
        "📅 Meeting Date: 25th SEPTEMBER 2026",
        "📍 Place: MARRIOT",
        "",
        "⸻",
        "",
        "🅰️ Attendance Report",
        "",
        "\t•\t🔵 Members: 61",
        "\t•\t🟢 Present: 57",
        "\t•\t🔴 Absent: 2",
        "\t•\t🟣 Substitute: 2",
        "\t•\t⚪️ Medical: 0",
        "\t•\t🔵 Late: 1",
        "",
        "⸻",
        "",
        "🔹 Absent : 2",
        "",
        "1. Sabari Kannan",
        "2. Ajay",
        "",
        "🔹 Substitute : 2",
        "",
        "1. Johnson",
        "2. Uma",
        "",
        "🪻 Late - 1",
        "",
        "1. Saravanakumar",
        "",
        "Medical - 0",
        "",
        "⸻",
        "Thank you",
      ].join("\n"),
    );
  });

  it("leaves no double blank line when a list is empty", () => {
    const text = reportText({ ...report, totals: { ...report.totals, absent: 0 }, absent: [] });
    expect(text).toContain("🔹 Absent : 0\n\n🔹 Substitute : 2");
    expect(text).not.toContain("\n\n\n");
  });
});

describe("PALMS is entered on the day, not before", () => {
  const meeting = new Date("2026-10-09T01:30:00Z"); // 07:00 IST on the 9th

  it("allows the meeting's own day and blocks a later one", () => {
    // Before the meeting starts, but the same IST day: allowed.
    expect(isFutureMeetingDay(meeting, new Date("2026-10-09T00:00:00Z"))).toBe(false);
    expect(isFutureMeetingDay(meeting, new Date("2026-10-09T18:00:00Z"))).toBe(false);
    // The day before, including late-night IST, is not.
    expect(isFutureMeetingDay(meeting, new Date("2026-10-08T12:00:00Z"))).toBe(true);
    // 2026-10-08T20:00Z is already the 9th in IST, so entry opens.
    expect(isFutureMeetingDay(meeting, new Date("2026-10-08T20:00:00Z"))).toBe(false);
  });
});

describe("device key signatures (T1, T2, T10)", () => {
  async function phone() {
    const pair = (await webcrypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, [
      "sign",
      "verify",
    ])) as CryptoKeyPair;
    const jwk = await webcrypto.subtle.exportKey("jwk", pair.publicKey);
    const sign = async (payload: string) =>
      Buffer.from(
        await webcrypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, new TextEncoder().encode(payload)),
      ).toString("base64url");
    return { jwk: parsePublicJwk({ kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y })!, sign };
  }

  it("verifies a signature from the registered phone", async () => {
    const p = await phone();
    const payload = signedPayload.checkin("member-1", "BNID1.token");
    expect(await verifyDeviceSignature(p.jwk, payload, await p.sign(payload))).toBe(true);
  });

  it("rejects another phone's signature and a reused signature for another member", async () => {
    const mine = await phone();
    const other = await phone();
    const payload = signedPayload.checkin("member-1", "BNID1.token");
    expect(await verifyDeviceSignature(mine.jwk, payload, await other.sign(payload))).toBe(false);
    const sig = await mine.sign(payload);
    expect(await verifyDeviceSignature(mine.jwk, signedPayload.checkin("member-2", "BNID1.token"), sig)).toBe(false);
  });

  it("gives each key a stable, distinct thumbprint", async () => {
    const a = await phone();
    const b = await phone();
    expect(jwkThumbprint(a.jwk)).toBe(jwkThumbprint({ ...a.jwk }));
    expect(jwkThumbprint(a.jwk)).not.toBe(jwkThumbprint(b.jwk));
  });

  it("refuses JWKs carrying a private key or the wrong curve", () => {
    const x = "A".repeat(43);
    expect(parsePublicJwk({ kty: "EC", crv: "P-256", x, y: x, d: x })).toBeNull();
    expect(parsePublicJwk({ kty: "EC", crv: "P-384", x, y: x })).toBeNull();
    expect(parsePublicJwk({ kty: "RSA", n: "abc", e: "AQAB" })).toBeNull();
  });
});
