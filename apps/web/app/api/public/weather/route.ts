import { NextResponse } from "next/server";
import { getExternalWeather } from "@/lib/external/weather";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const latest = await getExternalWeather();

  return NextResponse.json(
    {
      ok: latest !== null,
      route: "/api/public/weather",
      source: "Open-Meteo",
      latest,
    },
    {
      status: latest ? 200 : 503,
      headers: { "cache-control": "no-store, max-age=0" },
    },
  );
}
