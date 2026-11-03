import "server-only";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

export interface DemoCommunityReport {
  id: string;
  description: string;
  status: string;
  lat: number;
  lng: number;
  timestamp: string;
  viewed_at: string | null;
}

const STORE_KEY = "__horizon_demo_reports__";
const STORE_PATH = path.join(process.cwd(), ".tmp", "horizon-demo-reports.json");

type GlobalWithReports = typeof globalThis & {
  [STORE_KEY]?: DemoCommunityReport[];
};

function store(): DemoCommunityReport[] {
  const globalStore = globalThis as GlobalWithReports;
  if (!globalStore[STORE_KEY]) {
    globalStore[STORE_KEY] = readStoreFromDisk();
  }
  return globalStore[STORE_KEY];
}

function readStoreFromDisk(): DemoCommunityReport[] {
  if (!existsSync(STORE_PATH)) {
    return [];
  }

  try {
    const parsed = JSON.parse(readFileSync(STORE_PATH, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as DemoCommunityReport[]) : [];
  } catch {
    return [];
  }
}

function writeStoreToDisk(reports: DemoCommunityReport[]): void {
  mkdirSync(path.dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(reports.slice(0, 100), null, 2));
}

export function addDemoReport(report: Omit<DemoCommunityReport, "id" | "status" | "viewed_at">): DemoCommunityReport {
  const row: DemoCommunityReport = {
    ...report,
    id: `demo-${Date.now().toString(36)}`,
    status: "new",
    viewed_at: null,
  };

  const reports = store();
  reports.unshift(row);
  writeStoreToDisk(reports);
  return row;
}

export function listDemoReports(): DemoCommunityReport[] {
  const reports = readStoreFromDisk();
  const globalStore = globalThis as GlobalWithReports;
  globalStore[STORE_KEY] = reports;
  return reports.slice(0, 20);
}

export function markDemoReportViewed(id: string): boolean {
  const report = store().find((item) => item.id === id);
  if (!report) {
    return false;
  }

  report.viewed_at = new Date().toISOString();
  report.status = "reviewing";
  writeStoreToDisk(store());
  return true;
}
