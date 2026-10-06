"use client";

import { useState } from "react";
import { MessageCircle, X } from "lucide-react";
import { CONTACT_CHANNELS } from "@/lib/contactChannels";
import { useDict } from "@/lib/i18n/client";

export function FloatingContactLinks() {
  const dict = useDict();
  const [open, setOpen] = useState(false);
  return <nav className="floating-contacts" aria-label={dict.contact.eyebrow} data-open={open} onKeyDown={(event) => { if (event.key === "Escape") setOpen(false); }}>
    <button type="button" className="floating-contacts__toggle" aria-expanded={open} aria-controls="floating-contact-channels" aria-label={dict.contact.eyebrow} onClick={() => setOpen(!open)}>
      {open ? <X aria-hidden /> : <MessageCircle aria-hidden />}
    </button>
    <ul id="floating-contact-channels" className="floating-contacts__links">
      {CONTACT_CHANNELS.map(({ key, icon: Icon, href, label }) => <li key={key}>
        <a href={href} aria-label={`${dict.contact[key]} · ${label}`} target={href.startsWith("http") ? "_blank" : undefined} rel={href.startsWith("http") ? "noopener noreferrer" : undefined} onClick={() => setOpen(false)}>
          <Icon aria-hidden /><span>{dict.contact[key]}</span>
        </a>
      </li>)}
    </ul>
  </nav>;
}
