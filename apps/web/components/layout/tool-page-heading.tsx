import { KeywordTitle } from "@/components/ui/keyword-title";
import type { ReactNode } from "react";

export function ToolPageHeading({ title, description, aside, className = "" }: { title: string; description?: string; aside?: ReactNode; className?: string }) {
  return <header className={`tool-page-heading ${className}`}><div><h1><KeywordTitle text={title} keyword={title} /></h1>{description ? <p>{description}</p> : null}</div>{aside ? <div className="tool-page-heading__aside">{aside}</div> : null}<span className="tool-heading-rule" aria-hidden /></header>;
}
