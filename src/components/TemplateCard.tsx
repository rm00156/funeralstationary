import Image from "next/image";
import Link from "next/link";

/**
 * One design in a grid: its cover on a tinted panel, name and a meta line.
 * The whole card is a single link to the design's own page.
 */
export default function TemplateCard({
  href,
  name,
  image,
  meta,
  priority = false,
}: {
  href: string;
  name: string;
  image: string;
  meta: string;
  priority?: boolean;
}) {
  return (
    <Link href={href} className="card-link group flex flex-col gap-4 no-underline">
      <div className="flex justify-center rounded-xl bg-mist-3 p-7">
        <div className="cover relative aspect-[148/210] w-full max-w-[190px] overflow-hidden rounded-[3px] bg-sheet">
          <Image
            src={image}
            alt={`${name} design, front cover`}
            fill
            priority={priority}
            sizes="190px"
            className="object-cover"
          />
        </div>
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="font-display text-[21px] font-medium text-ink underline-offset-4 group-hover:underline">
          {name}
        </h3>
        <p className="text-[15px] text-ink-3">{meta}</p>
      </div>
    </Link>
  );
}
