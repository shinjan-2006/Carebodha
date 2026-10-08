import Link from "next/link";
export function Brand({compact=false}:{compact?:boolean}) {
  return <Link className="brand" href="/" aria-label="CareBodha home"><span className="brand-symbol" aria-hidden="true"/>{!compact && <span>CAREBODHA</span>}</Link>;
}
