"use client";

import Image from "next/image";
import { useState } from "react";

export interface PreviewTemplate {
  id: string;
  name: string;
  image: string;
}

export default function OrderOfServicePreviewGallery({
  templates,
}: {
  templates: PreviewTemplate[];
}) {
  const [activeId, setActiveId] = useState(templates[0]?.id);
  const active = templates.find((template) => template.id === activeId) ?? templates[0];
  const thumbnails = templates.filter((template) => template.id !== active?.id).slice(0, 4);

  if (!active) return null;

  return (
    <div>
      <div className="relative w-full aspect-4/3 rounded-xl bg-surface-container-low ambient-shadow overflow-hidden">
        <Image
          src={active.image}
          alt={`${active.name} order of service booklet`}
          fill
          priority
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-contain p-6"
        />
      </div>

      {thumbnails.length > 0 && (
        <div className="mt-4 flex gap-3">
          {thumbnails.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => setActiveId(template.id)}
              aria-label={`Preview the ${template.name} theme`}
              className="relative aspect-4/3 flex-1 max-w-[96px] rounded-lg overflow-hidden bg-surface-container-low border-2 border-transparent transition-colors hover:border-primary-container"
            >
              <Image
                src={template.image}
                alt=""
                fill
                sizes="96px"
                className="object-contain p-1.5"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
