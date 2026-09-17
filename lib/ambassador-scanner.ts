import { Sandbox, Snapshot } from "@vercel/sandbox";
import { prisma } from "@/lib/db";

const SNAPSHOT_KEY = "clamav_snapshot_id";
const REFRESH_INTERVAL_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

async function scanWithHttpService(buffer: Buffer, mimeType: string) {
  const url = (process.env.AMBASSADOR_FILE_SCAN_URL || "").trim();
  const token = (process.env.AMBASSADOR_FILE_SCAN_TOKEN || "").trim();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: new Uint8Array(buffer),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.clean !== true) {
    throw new Error(
      result.clean === false
        ? "document_malware_detected"
        : "document_scan_failed"
    );
  }
}

async function currentSnapshot() {
  const configured = (process.env.CLAMAV_SANDBOX_SNAPSHOT_ID || "").trim();
  if (configured) return configured;
  const row = await prisma.systemConfig.findUnique({
    where: { key: SNAPSHOT_KEY }
  });
  return row?.value || "";
}

export async function scanAmbassadorFile(
  buffer: Buffer,
  mimeType: string
) {
  if (process.env.AMBASSADOR_FILE_SCAN_URL) {
    await scanWithHttpService(buffer, mimeType);
    return;
  }
  const snapshotId = await currentSnapshot();
  if (!snapshotId) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("document_scanner_not_configured");
    }
    return;
  }
  const sandbox = await Sandbox.create({
    source: { type: "snapshot", snapshotId },
    region: "fra1",
    timeout: 60_000,
    persistent: false,
    tags: { purpose: "ambassador-malware-scan" }
  });
  try {
    await sandbox.writeFiles([
      {
        path: "/tmp/petiwell-upload",
        content: new Uint8Array(buffer)
      }
    ]);
    const result = await sandbox.runCommand({
      cmd: "clamscan",
      args: ["--no-summary", "/tmp/petiwell-upload"],
      timeoutMs: 30_000
    });
    if (result.exitCode === 1) {
      throw new Error("document_malware_detected");
    }
    if (result.exitCode !== 0) {
      throw new Error("document_scan_failed");
    }
  } finally {
    await sandbox.stop().catch(() => undefined);
  }
}

export async function refreshClamAvSnapshot(input?: { force?: boolean }) {
  const existing = await prisma.systemConfig.findUnique({
    where: { key: SNAPSHOT_KEY }
  });
  if (
    !input?.force &&
    existing &&
    Date.now() - existing.updatedAt.getTime() < REFRESH_INTERVAL_MS
  ) {
    return { refreshed: false, snapshotId: existing.value };
  }

  const sandbox = await Sandbox.create({
    region: "fra1",
    timeout: 5 * 60_000,
    persistent: false,
    tags: { purpose: "clamav-snapshot-build" }
  });
  let snapshotId = "";
  try {
    const update = await sandbox.runCommand({
      cmd: "apt-get",
      args: ["update"],
      sudo: true,
      timeoutMs: 120_000
    });
    if (update.exitCode !== 0) throw new Error("clamav_apt_update_failed");
    const install = await sandbox.runCommand({
      cmd: "apt-get",
      args: ["install", "-y", "clamav", "clamav-freshclam"],
      env: { DEBIAN_FRONTEND: "noninteractive" },
      sudo: true,
      timeoutMs: 180_000
    });
    if (install.exitCode !== 0) throw new Error("clamav_install_failed");
    const definitions = await sandbox.runCommand({
      cmd: "freshclam",
      args: ["--stdout"],
      sudo: true,
      timeoutMs: 180_000
    });
    if (definitions.exitCode !== 0) {
      throw new Error("clamav_definitions_failed");
    }
    const snapshot = await sandbox.snapshot({
      expiration: SNAPSHOT_EXPIRATION_MS
    });
    snapshotId = snapshot.snapshotId;
  } catch (error) {
    await sandbox.stop().catch(() => undefined);
    throw error;
  }

  await prisma.systemConfig.upsert({
    where: { key: SNAPSHOT_KEY },
    create: { key: SNAPSHOT_KEY, value: snapshotId },
    update: { value: snapshotId }
  });
  if (existing?.value && existing.value !== snapshotId) {
    const old = await Snapshot.get({ snapshotId: existing.value }).catch(
      () => null
    );
    await old?.delete().catch(() => undefined);
  }
  return { refreshed: true, snapshotId };
}
