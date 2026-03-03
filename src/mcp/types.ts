export interface NstProfile {
  profileId: string;
  _id: string;
  name: string;
  groupId: string;
  kernelMilestone: string;
  kernelVersion: string;
  platform: number;
  platformVersion: string;
  fingerprintId: string;
  note: string;
  status: number;
  teamId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NstBrowser {
  port: number;
  profileId: string;
  proxy: string;
  webSocketDebuggerUrl: string;
}

export type RpaAction =
  | { action: 'navigate'; url: string }
  | { action: 'click'; selector: string }
  | { action: 'fill'; selector: string; value: string }
  | { action: 'wait'; selector: string; timeout?: number }
  | { action: 'scroll'; times?: number }
  | { action: 'scrape'; selector: string; as: string }
  | { action: 'evaluate'; script: string; as?: string }
  | { action: 'screenshot'; as?: string };

export interface RpaResult {
  success: boolean;
  data: Record<string, unknown>;
  error?: string;
}
