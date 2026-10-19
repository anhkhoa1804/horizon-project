import { Languages } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";

/**
 * Says out loud that the long-form prose below is still Vietnamese only.
 *
 * WHY THIS EXISTS.
 *
 * HORIZON's interface chrome is fully bilingual — navigation, controls, the
 * observatory canvas, every measurement label and status word. Its essays
 * are not: the About narrative, the homepage chapters and the field notes
 * are roughly 400 strings of technical and editorial writing, and the
 * project's own honesty rules prohibit machine-translating scientific
 * prose. So they stay Vietnamese until a person writes the English.
 *
 * That is a defensible position, but only if the reader is told. A reader
 * who switches to English and then meets three screens of Vietnamese with
 * no explanation has been failed by the interface, whichever language the
 * paragraphs are in. The string for this already existed in both
 * dictionaries (`common.translationPending`) and was rendered by nothing —
 * the promise was written down and never kept.
 *
 * Renders ONLY under English. In Vietnamese there is nothing to explain.
 */
export async function TranslationNotice() {
  const { locale, dict } = await getI18n();
  if (locale !== "en") return null;

  return (
    <aside className="flex max-w-2xl items-start gap-3 border-l-2 border-informational/40 py-1 pl-4">
      <Languages className="mt-0.5 h-4 w-4 shrink-0 text-informational" aria-hidden />
      <p className="text-sm leading-relaxed text-foreground-muted">{dict.common.translationPending}</p>
    </aside>
  );
}
