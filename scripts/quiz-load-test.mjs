// Plays a roomful of phones against a quiz, to see how the server holds up
// before a meeting rather than during one.
//
//   node scripts/quiz-load-test.mjs <app-url> <join-token> [players=60] [seconds=30]
//
// e.g. node scripts/quiz-load-test.mjs https://darkred-locust-154312.hostingersite.com AbC123xyz 60 30
//
// The join token is the last part of the quiz link (/quiz/<token>). Each fake
// player polls the quiz state the way a phone does — ask, wait for the reply,
// wait a second, ask again — as a guest who hasn't joined. Joining and
// answering go through server actions, which this doesn't drive; the polling
// is the steady load, sixty phones once a second for the whole quiz.
//
// Open the quiz (and start it, to load the questions too) on a rehearsal copy,
// or reset it afterwards. Nothing here writes to the database.

const [base, token, playersArg = "60", secondsArg = "30"] = process.argv.slice(2);
if (!base || !token) {
  console.error("Usage: node scripts/quiz-load-test.mjs <app-url> <join-token> [players=60] [seconds=30]");
  process.exit(1);
}

const PLAYERS = Number(playersArg);
const SECONDS = Number(secondsArg);
const POLL_MS = 1000;
const url = `${base.replace(/\/$/, "")}/api/quiz/${token}/state`;

const latencies = [];
const failures = new Map();
/** Gap between one reply and the next, per phone: what a player feels as lag. */
const gaps = [];
const stopAt = Date.now() + SECONDS * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function phone(n) {
  // Spread the first taps over a second, as a room scanning a QR would.
  await sleep(Math.random() * POLL_MS);
  let lastReply = null;
  while (Date.now() < stopAt) {
    const started = Date.now();
    try {
      const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
      await res.arrayBuffer();
      if (!res.ok) failures.set(res.status, (failures.get(res.status) ?? 0) + 1);
      else {
        latencies.push(Date.now() - started);
        if (lastReply) gaps.push(Date.now() - lastReply);
        lastReply = Date.now();
      }
    } catch (error) {
      const key = error?.name === "TimeoutError" ? "timeout" : (error?.cause?.code ?? error?.name ?? "error");
      failures.set(key, (failures.get(key) ?? 0) + 1);
    }
    if (n === 0 && latencies.length % 50 === 0) process.stdout.write(".");
    await sleep(POLL_MS);
  }
}

const pct = (list, p) => {
  if (!list.length) return "-";
  const sorted = list.toSorted((a, b) => a - b);
  return `${sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]}ms`;
};

console.log(`${PLAYERS} phones polling ${url} for ${SECONDS}s…`);
await Promise.all(Array.from({ length: PLAYERS }, (_, i) => phone(i)));

const ok = latencies.length;
const failed = [...failures.values()].reduce((a, b) => a + b, 0);
console.log("\n");
console.log(`Requests   ${ok + failed} (${((ok + failed) / SECONDS).toFixed(1)}/s), ${failed} failed`);
if (failed) console.log(`Failures   ${[...failures].map(([k, v]) => `${k}×${v}`).join(", ")}`);
console.log(`Reply time p50 ${pct(latencies, 50)}  p95 ${pct(latencies, 95)}  max ${pct(latencies, 100)}`);
console.log(`Screen gap p50 ${pct(gaps, 50)}  p95 ${pct(gaps, 95)}  (about ${POLL_MS}ms is right)`);
const verdict =
  failed > (ok + failed) * 0.01
    ? "NOT READY: more than 1% of polls failed."
    : latencies.length && Number(pct(latencies, 95).replace("ms", "")) > 1000
      ? "SLOW: one poll in twenty took over a second. Screens will lag."
      : "OK: the room should see the quiz move in step.";
console.log(verdict);
