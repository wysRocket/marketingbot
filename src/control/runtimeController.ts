import { EventEmitter } from "events";

/**
 * Runtime controller for the visit loop.
 *
 * The bot used to gate its run loop on a single boot-time check of
 * BOT_ENABLED. This controller lets the loop be started and stopped at
 * runtime (e.g. by the Hermes gateway calling the control endpoints on the
 * heartbeat server) so we can deploy in a paused "observation" state and
 * begin live visits on demand.
 */
export interface BotStatus {
  running: boolean;
  round: number;
  totalRounds: number;
  siteProfile: string;
  startedAt: number | null;
  lastChangedAt: number;
  lastReason: string | null;
  uptimeSec: number;
}

class RuntimeController {
  private _running = false;
  private emitter = new EventEmitter();

  round = 0;
  totalRounds = 0;
  siteProfile = "";
  startedAt: number | null = null;
  lastChangedAt = Date.now();
  lastReason: string | null = null;

  get running(): boolean {
    return this._running;
  }

  /** Returns true if state changed (was paused, now running). */
  start(reason = "control"): boolean {
    if (this._running) return false;
    this._running = true;
    this.startedAt = Date.now();
    this.lastChangedAt = Date.now();
    this.lastReason = reason;
    this.emitter.emit("change", true);
    return true;
  }

  /** Returns true if state changed (was running, now paused). */
  stop(reason = "control"): boolean {
    if (!this._running) return false;
    this._running = false;
    this.lastChangedAt = Date.now();
    this.lastReason = reason;
    this.emitter.emit("change", false);
    return true;
  }

  /** Resolves immediately if running, otherwise on the next start(). */
  waitUntilRunning(): Promise<void> {
    if (this._running) return Promise.resolve();
    return new Promise((resolve) => {
      const onChange = (val: boolean) => {
        if (val) {
          this.emitter.off("change", onChange);
          resolve();
        }
      };
      this.emitter.on("change", onChange);
    });
  }

  status(): BotStatus {
    return {
      running: this._running,
      round: this.round,
      totalRounds: this.totalRounds,
      siteProfile: this.siteProfile,
      startedAt: this.startedAt,
      lastChangedAt: this.lastChangedAt,
      lastReason: this.lastReason,
      uptimeSec: this.startedAt
        ? Math.round((Date.now() - this.startedAt) / 1000)
        : 0,
    };
  }
}

export const botController = new RuntimeController();
export type { RuntimeController };
