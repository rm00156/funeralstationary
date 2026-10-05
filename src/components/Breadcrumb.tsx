import Link from "next/link";

/** The trail above a page heading; the last item is the current page. */
export default function Breadcrumb({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-[15px] text-ink-3">
      {items.map((item, index) => (
        <span key={item.label} className="flex gap-2">
          {index > 0 && <span aria-hidden>/</span>}
          {item.href ? (
            <Link href={item.href} className="text-ink-3 underline underline-offset-4 hover:text-plum">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
