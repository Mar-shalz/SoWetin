import type { Catalogue } from '@/lib/catalogue/db';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { pictureUrl } from '@/lib/db/env';
import { plateComponents } from '@/lib/engine/plate';
import { costFn, lagosToday, parsePlateKey } from '@/lib/plates/serve';
import type { ShareCard } from './path';

export { sharePath, shortDate, type ShareCard } from './path';


// What a shared plate shows (S-017, S-022): the plate, today's estimate for the people count, and its oldest price date.
// Published dishes only for the public, as everywhere else.
export function shareCard(cat: Catalogue, rawKey: string, rawPeople: string): ShareCard | null {
  const people = Number(rawPeople);
  if (!Number.isInteger(people) || people < C.PEOPLE_MIN || people > C.PEOPLE_MAX) return null;
  const key = decodeURIComponent(rawKey);
  const plate = parsePlateKey(key, cat);
  if (!plate) return null;
  const ids = plateComponents(plate);
  const cost = costFn(cat, people, { cooked: [], foodstuff: [], basic: [] }, lagosToday())(plate);
  const withPicture = ids.find((id) => cat.display.get(id)?.picture);
  return {
    key,
    people,
    title: ids.map((id) => cat.display.get(id)?.name ?? id).join(' + '),
    picture: withPicture ? pictureUrl(cat.display.get(withPicture)!.picture) : null,
    price: cost ? { low: cost.outlayLowNgn, high: cost.outlayHighNgn, date: cost.oldestPriceDate } : null,
  };
}
