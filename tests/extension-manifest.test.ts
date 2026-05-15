import { describe, expect, it } from "vitest";
import manifestJson from "../public/manifest.json";

type ExtensionManifest = {
  permissions?: string[];
  background?: {
    service_worker?: string;
    type?: string;
  };
  host_permissions?: string[];
  content_scripts?: unknown[];
};

function loadManifest(): ExtensionManifest {
  return manifestJson as ExtensionManifest;
}

describe("extension manifest", () => {
  it("requests exactly local storage, alarms, and notifications permissions", () => {
    expect(loadManifest().permissions).toEqual([
      "storage",
      "alarms",
      "notifications",
    ]);
  });

  it("includes a Manifest V3 background service worker", () => {
    expect(loadManifest().background).toEqual({
      service_worker: "extension/background.js",
      type: "module",
    });
  });

  it("does not request page access or elevated browser permissions", () => {
    const manifest = loadManifest();

    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toBeUndefined();
    expect(manifest.permissions).not.toContain("tabs");
    expect(manifest.permissions).not.toContain("activeTab");
    expect(manifest.permissions).not.toContain("scripting");
    expect(manifest.permissions).not.toContain("unlimitedStorage");
  });
});
