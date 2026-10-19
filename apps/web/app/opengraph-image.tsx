import { ImageResponse } from "next/og";
import { getI18n } from "@/lib/i18n/server";

export const runtime = "nodejs";
export const alt = "HORIZON — Cồn Hô, Vĩnh Long";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The social preview card.
 *
 * TYPOGRAPHIC, NOT PHOTOGRAPHIC — deliberately. The project has no field
 * photography, and generating something that looks like a photograph of an
 * installation that does not exist yet would be exactly the kind of claim
 * this product refuses to make everywhere else. This is the wordmark's
 * palette, the site's own words, and the horizon line the brand is named
 * after: all things the project can stand behind.
 *
 * Rendered at request time from the same dictionary the page uses, so the
 * card is never a stale copy of copy that has since changed.
 */
export default async function OpengraphImage() {
  const { dict } = await getI18n();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0e1312",
          padding: "72px 80px",
          position: "relative",
        }}
      >
        {/* The horizon: the one piece of imagery this project owns outright. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: 300,
            background: "linear-gradient(to top, rgba(79,176,212,0.22), rgba(79,176,212,0))",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 300,
            height: 2,
            background: "rgba(79,176,212,0.42)",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#45c078" }} />
          <div
            style={{
              fontSize: 26,
              letterSpacing: 6,
              color: "#9fb0ab",
              textTransform: "uppercase",
            }}
          >
            {dict.home.eyebrow}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 78, color: "#f4f7f5", lineHeight: 1.08, letterSpacing: -2 }}>
            {dict.home.title}
          </div>
          <div style={{ fontSize: 30, color: "#9fb0ab", lineHeight: 1.35, maxWidth: 900 }}>
            {dict.home.subtitle}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
