"use client";
import { createContext, useContext } from "react";

/**
 * True while the observatory is a placeholder for data that is still on its way. The real canvas
 * renders in this state - same boxes, same labels, same map - and only the figures are replaced by
 * a quiet shimmer, so the page does not change shape when the numbers arrive.
 */
export const ObservatoryLoadingContext = createContext(false);
export const useObservatoryLoading = () => useContext(ObservatoryLoadingContext);

export function LoadingFigure({ wide = false }: { wide?: boolean }) {
  return <span className={wide ? "obs-loading obs-loading--wide" : "obs-loading"} aria-hidden />;
}
