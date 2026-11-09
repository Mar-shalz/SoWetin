import Image from 'next/image';
import Link from 'next/link';
import type { Item } from '@/lib/catalogue/shelves';

// A dish card for Explore shelves, lists and search (S-009, S-010): picture, name, local name, time.
export function DishCard({ item, minutes }: { item: Item; minutes: string }) {
  return (
    <Link href={`/dish/${item.id}`} className="grid w-40 shrink-0 gap-1 rounded-lg border-2 border-ink bg-surface p-2">
      {item.picture ? (
        <Image src={item.picture} alt="" width={320} height={240} sizes="160px" className="aspect-[4/3] w-full rounded-md object-cover" />
      ) : (
        <span aria-hidden className="flex aspect-[4/3] w-full items-center justify-center rounded-md bg-palm-100 type-title-l">
          {item.name.charAt(0)}
        </span>
      )}
      <span className="type-label">{item.name}</span>
      {item.localName && <span className="type-caption text-ink-2">{item.localName}</span>}
      <span className="type-caption text-ink-2">{minutes}</span>
    </Link>
  );
}
