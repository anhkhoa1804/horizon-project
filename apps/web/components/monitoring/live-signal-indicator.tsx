"use client";
import { createContext, useContext } from "react";
import { useDict } from "@/lib/i18n/client";

export const LiveSignalContext = createContext({ connected: false, demo: false });

export function LiveSignalIndicator({ external = false, historical = false }: { external?: boolean; historical?: boolean }) {
  const { connected, demo } = useContext(LiveSignalContext);
  const dict = useDict();
  if (!connected || demo || external || historical) return null;
  const label = dict.monitoring.streamConnected;
  return <span className="box-signal box-signal--live" role="img" aria-label={label} title={label}><span aria-hidden /></span>;
}
