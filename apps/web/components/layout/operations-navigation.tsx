"use client";
import { useEffect, useState } from "react";

export function OperationsNavigation({ items, label }: { items: { id: string; label: string }[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id ?? "");
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-100px 0px -55% 0px", threshold: 0 });
    items.forEach(({ id }) => { const target = document.getElementById(id); if (target) observer.observe(target); });
    return () => observer.disconnect();
  }, [items]);
  return <nav aria-label={label} className="operations-nav"><p>HORIZON / OPERATIONS</p><select aria-label={label} value={active} onChange={(event) => { setActive(event.target.value); document.getElementById(event.target.value)?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); history.replaceState(null, "", `#${event.target.value}`); }}>{items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select><ol>{items.map((item) => <li key={item.id}><a href={`#${item.id}`} aria-current={active === item.id ? "location" : undefined} onClick={() => setActive(item.id)}>{item.label}</a></li>)}</ol></nav>;
}
