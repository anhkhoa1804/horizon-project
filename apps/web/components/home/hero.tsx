import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { getI18n } from "@/lib/i18n/server";

/** The cover opens on the place and names the real shape of the network. */
export async function Hero() {
  const { dict } = await getI18n();

  return (
    <section className="horizon-cover" aria-labelledby="home-title">
      <div className="h-wide horizon-cover__inner">
        <div className="horizon-cover__body">
          <div className="max-w-5xl">
            <p className="horizon-cover__coordinates">{dict.home.placeLabel}</p>
            <h1 id="home-title" className="horizon-cover__title">{dict.home.title.split("\n").map((line) => <span key={line}>{line.split(/(HORIZON)/).map((part, index) => part === "HORIZON" ? <mark key={index} className="hero-name-highlight">{part}</mark> : part)}</span>)}</h1>
            <Link href="/dashboard" className="horizon-cover__link">
              {dict.home.ctaPrimary}<ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
