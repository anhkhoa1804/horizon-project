import { Facebook, Globe, Instagram, Mail, MessageCircle, Phone } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/vi";

/** Owner-provided direct channels, shared by the page and floating contact rail. */
export const CONTACT_CHANNELS = [
  { key: "channelEmail", icon: Mail, label: "magnusfrog.frogsleap@gmail.com", href: "mailto:magnusfrog.frogsleap@gmail.com" },
  { key: "channelPhone", icon: Phone, label: "0867 430 045", href: "tel:+84867430045" },
  { key: "channelZalo", icon: MessageCircle, label: "Zalo OA", href: "https://zalo.me/2851935006706412776" },
  { key: "channelFacebook", icon: Facebook, label: "facebook.com/frogsleapvn", href: "https://www.facebook.com/frogsleapvn" },
  { key: "channelInstagram", icon: Instagram, label: "@frogsleap_vietnam", href: "https://www.instagram.com/frogsleap_vietnam/" },
  { key: "channelWebsite", icon: Globe, label: "frogsleap.com.vn", href: "https://frogsleap.com.vn" },
] as const satisfies readonly { key: keyof Dictionary["contact"]; icon: typeof Mail; label: string; href: string }[];
