import type { Config } from "@/server/config";
import { mockAdapter } from "./mock";
import { capabilities, type Adapter, type CapabilityId } from "./types";

// Real adapters are added here in M1, one default per capability.
const liveAdapters: Adapter[] = [];

const mocks = new Map<CapabilityId, Adapter>(
  capabilities.map((c) => [c, mockAdapter(c) as unknown as Adapter]),
);

export function getAdapter(id: string): Adapter | undefined {
  if (id.startsWith("mock:")) return mocks.get(id.slice(5) as CapabilityId);
  return liveAdapters.find((a) => a.id === id);
}

/** The adapter the app uses for a capability in the current mode. */
export function defaultAdapter(capability: CapabilityId, cfg: Pick<Config, "providers">): Adapter {
  if (cfg.providers === "live") {
    const live = liveAdapters.find((a) => a.capability === capability);
    if (!live) throw new Error(`No live provider configured for "${capability}" yet`);
    return live;
  }
  return mocks.get(capability)!;
}
