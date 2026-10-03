/** Keep the complete heading readable while highlighting its subject. */
export function KeywordTitle({ text, keyword }: { text: string; keyword?: string }) {
  const subject = keyword ?? text.trim().split(/\s+/).slice(-2).join(" ");
  const index = text.indexOf(subject);
  if (index < 0) return <>{text}</>;
  return <>{text.slice(0,index)}<mark className="editorial-keyword">{subject}</mark>{text.slice(index + subject.length)}</>;
}
