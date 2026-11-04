import { getI18n } from "@/lib/i18n/server";
import { getLoadingObservatoryViewModel } from "@/lib/monitoring/buildObservatory";
import { ObservatoryCanvas } from "@/components/monitoring/observatory-canvas";

/**
 * The observatory while its data is on the way: the real canvas (boxes, labels, map, calendar,
 * scope notes) built from an empty model, with every figure replaced by a shimmer. No network
 * calls, no colours, no "no data" wording - nothing it shows can be mistaken for a reading.
 */
export async function ObservatoryLoading() {
  const { dict } = await getI18n();
  return <ObservatoryCanvas model={getLoadingObservatoryViewModel(dict)} loading />;
}
