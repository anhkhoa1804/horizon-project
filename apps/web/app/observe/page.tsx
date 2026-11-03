import { permanentRedirect } from "next/navigation";
import { OBSERVATORY_HREF } from "@/lib/publicStations";

/**
 * THE QR DESTINATION.
 *
 * QR codes are already printed and mounted on the stations at Cồn Hô. What is
 * printed on a sign in a field cannot be re-issued cheaply, so the address it
 * points at has to outlive every refactor of the page that answers it.
 *
 * `/observe` is that address. It is deliberately not where the observatory is
 * implemented — it is a stable public name that forwards to wherever the
 * observatory currently lives (`OBSERVATORY_HREF`, today
 * `/dashboard#observatory`). If Monitoring is restructured, or the route is
 * renamed, or the Bento moves to its own page, only that constant changes and
 * every printed code keeps working.
 *
 * `permanentRedirect` (308) rather than a rewrite or a client bounce:
 *   - a phone scanning the code lands on the real observatory URL, so a
 *     reader who then bookmarks or shares it shares the working address
 *   - the fragment survives, which a rewrite would drop — and the fragment is
 *     the whole point, since it is what puts the Bento under the reader's eyes
 *     rather than under the sticky header
 *   - 308 is cacheable, so a repeat scan in the field costs no round trip
 *
 * `/observe` is excluded from the sitemap on purpose: it is an entry point for
 * physical signage, not a page with content of its own to index.
 */
export const dynamic = "force-static";

export default function ObservePage() {
  permanentRedirect(OBSERVATORY_HREF);
}
