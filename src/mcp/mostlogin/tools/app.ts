import { ml } from "../client";

// ── Handler ───────────────────────────────────────────────────────────

export async function quitApp() {
  const res = await ml.post("/app/exit");
  return res.data;
}
