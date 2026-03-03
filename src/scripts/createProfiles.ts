/**
 * createProfiles.ts
 *
 * Creates 26 new MostLogin profiles sequentially (with a small delay between
 * each) to avoid rate-limit and multi-device session errors.
 *
 * Distribution across existing folders:
 *   E-commerce  (2c9644389cadbf43019cafbdeb1538e0)  — 9 profiles
 *   Social media (2c9644389cadbf43019cafbdeb1538e1)  — 9 profiles
 *   Coin list   (2c9644389cadbf43019cafbdeb1538e2)  — 8 profiles
 *
 * OS alternates Win32 / MacIntel per profile.
 *
 * Run:  npx ts-node src/scripts/createProfiles.ts
 */

import "dotenv/config";
import {
  listProfiles,
  quickCreateProfile,
} from "../mcp/mostlogin/tools/profiles";

const DELAY_MS = 800; // pause between API calls to stay under rate limit

const SLOTS: Array<{ title: string; folderId: string; os: string }> = [];

const ECOMMERCE = "2c9644389cadbf43019cafbdeb1538e0";
const SOCIAL = "2c9644389cadbf43019cafbdeb1538e1";
const COIN = "2c9644389cadbf43019cafbdeb1538e2";

// Will be filled once we know the current highest profile number
function buildSlots(startAt: number): void {
  const folders = [
    ...Array(9).fill(ECOMMERCE),
    ...Array(9).fill(SOCIAL),
    ...Array(8).fill(COIN),
  ];
  const osList = ["Win32", "MacIntel"];

  folders.forEach((folderId, i) => {
    SLOTS.push({
      title: `Profile ${startAt + i}`,
      folderId,
      os: osList[i % 2],
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
  // Discover current highest profile number so titles don't clash.
  console.log("Fetching existing profiles...");
  const existing = await listProfiles(1, 100);
  const currentProfiles: Array<{ title: string }> = existing?.list ?? [];
  const currentCount = currentProfiles.length;

  // Extract max seq number from titles like "Profile N"
  let maxNum = currentCount;
  for (const p of currentProfiles) {
    const m = p.title.match(/Profile\s+(\d+)/i);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }

  const startAt = maxNum + 1;
  buildSlots(startAt);

  console.log(
    `Current profile count: ${currentCount}  (highest title num: ${maxNum})`,
  );
  console.log(
    `Creating ${SLOTS.length} profiles starting at "Profile ${startAt}"...\n`,
  );

  let created = 0;
  let failed = 0;

  for (const slot of SLOTS) {
    try {
      const res = await quickCreateProfile({
        folderId: slot.folderId,
        os: slot.os as "Win32" | "MacIntel",
        coreVersion: "138",
        title: slot.title,
      });

      if (res?.code && res.code !== 0) {
        console.error(
          `  ✗ ${slot.title} (${slot.os}): [${res.code}] ${res.message}`,
        );
        failed++;
      } else {
        const id: string = res?.id ?? res?.data?.id ?? "?";
        console.log(`  ✓ ${slot.title} (${slot.os}) → ${id}`);
        created++;
      }
    } catch (err) {
      console.error(`  ✗ ${slot.title}: ${(err as Error).message}`);
      failed++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`\nDone. Created: ${created}  Failed: ${failed}`);
})();
