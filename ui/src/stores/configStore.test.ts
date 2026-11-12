import { beforeEach, describe, expect, it, vi } from "vitest";

const { command, metaGet } = vi.hoisted(() => ({
  command: vi.fn(),
  metaGet: vi.fn(),
}));

vi.mock("@casoon/origin-client", () => ({ command }));
vi.mock("../lib/platform", () => ({ isTauriAvailable: () => true }));
vi.mock("../lib/metaStore", () => ({ metaGet, metaSet: vi.fn() }));

import {
  $appConfig,
  createDefaultAppConfig,
  openTenant,
  tenantNameFromPath,
} from "./configStore";

describe("tenantNameFromPath", () => {
  it("uses the parent folder for the default database file", () => {
    expect(tenantNameFromPath("/Users/a/Documents/studio-nord/etasks.sqlite3")).toBe(
      "studio-nord",
    );
    expect(tenantNameFromPath("C:\\Docs\\studio\\etasks.sqlite3")).toBe("studio");
  });

  it("strips known extensions from other file names", () => {
    expect(tenantNameFromPath("/ws/kunde.db")).toBe("kunde");
    expect(tenantNameFromPath("/ws/kunde.etasks")).toBe("kunde");
  });
});

describe("openTenant", () => {
  const path = "/ws/studio-nord/etasks.sqlite3";

  beforeEach(() => {
    command.mockReset();
    metaGet.mockReset();
    metaGet.mockResolvedValue(null);
    $appConfig.set(createDefaultAppConfig());
  });

  it("keeps the stored display name when called without a name", async () => {
    $appConfig.set({
      ...createDefaultAppConfig(),
      tenants: [{ path, name: "Studio Nord", displayName: "Studio Nord", last_opened: "x" }],
    });
    await openTenant(path);
    const tenant = $appConfig.get().tenants[0];
    expect(tenant.name).toBe("Studio Nord");
    expect(tenant.displayName).toBe("Studio Nord");
    expect($appConfig.get().active_tenant).toBe(path);
  });

  it("takes an explicitly passed name", async () => {
    $appConfig.set({
      ...createDefaultAppConfig(),
      tenants: [{ path, name: "Alt", displayName: "Alt", last_opened: "x" }],
    });
    await openTenant(path, "Neu");
    expect($appConfig.get().tenants[0].displayName).toBe("Neu");
  });

  it("reads the name from the database meta for unknown workspaces", async () => {
    metaGet.mockResolvedValue("Studio Nord");
    await openTenant(path);
    expect($appConfig.get().tenants[0]).toMatchObject({
      name: "Studio Nord",
      displayName: "Studio Nord",
    });
  });

  it("falls back to the folder name without any stored name", async () => {
    await openTenant(path);
    expect($appConfig.get().tenants[0].name).toBe("studio-nord");
  });
});
