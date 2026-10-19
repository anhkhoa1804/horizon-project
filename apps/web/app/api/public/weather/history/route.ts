import { NextResponse } from "next/server";
import { getExternalWeatherHistory24h } from "@/lib/external/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const latest = await getExternalWeatherHistory24h();

  return NextResponse.json(
    {
      ok: latest !== null,
      route: "/api/public/weather/history",
      source: "Open-Meteo",
      range: "24h",
      latest,
    },
    {
      status: latest ? 200 : 503,
      headers: { "cache-control": "no-store, max-age=0" },
    },
  );
}
