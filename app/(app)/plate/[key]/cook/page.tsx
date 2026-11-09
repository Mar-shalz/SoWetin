import { notFound } from 'next/navigation';
import { body, display } from '@/app/fonts/fonts';
import { CookMode, type CookComponent } from '@/components/cook/cook-mode';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { plateComponents } from '@/lib/engine/plate';
import { catalogueForRequest, costFn, lagosToday, parsePlateKey } from '@/lib/plates/serve';

type Method = {
  id: string;
  component_steps: { step_no: number; text: string; cue: string | null; heat: 'low' | 'medium' | 'high' | null; timer_seconds: number | null }[];
};

// S-005 Cook mode: the plate's steps, component by component in cooking order (longest first, doc 07).
export default async function CookPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ people?: string }> }) {
  const [{ key }, sp] = await Promise.all([params, searchParams]);
  const people = Math.min(C.PEOPLE_MAX, Math.max(C.PEOPLE_MIN, Number(sp.people) || C.PEOPLE_DEFAULT));
  const { cat, client } = await catalogueForRequest();
  const plateKey = decodeURIComponent(key);
  const plate = cat && parsePlateKey(plateKey, cat);
  if (!cat || !client || !plate) notFound();

  const ids = plateComponents(plate);
  const { data } = await client.from('components').select('id, component_steps(step_no, text, cue, heat, timer_seconds)').in('id', ids);
  const methods = new Map(((data ?? []) as Method[]).map((m) => [m.id, m]));
  const order = [...ids].sort((a, b) => (cat.display.get(b)?.totalMinutes ?? 0) - (cat.display.get(a)?.totalMinutes ?? 0));
  const components: CookComponent[] = order
    .map((id) => ({
      id,
      name: cat.display.get(id)?.name ?? id,
      steps: [...(methods.get(id)?.component_steps ?? [])]
        .sort((a, b) => a.step_no - b.step_no)
        .map(({ text, cue, heat, timer_seconds }) => ({ text, cue, heat, timer_seconds })),
    }))
    .filter((c) => c.steps.length);
  if (!components.length) notFound();
  const cost = costFn(cat, people, { cooked: [], foodstuff: [], basic: [] }, lagosToday())(plate);
  const pot = cost?.pot ?? null;

  return (
    <CookMode
      components={components}
      plateKey={plateKey}
      price={cost ? { low: cost.outlayLowNgn, high: cost.outlayHighNgn, date: cost.oldestPriceDate } : null}
      fonts={{ display: display.style.fontFamily, body: body.style.fontFamily }}
      title={ids.map((id) => cat.display.get(id)?.name ?? id).join(' + ')}
      back={`/plate/${encodeURIComponent(plateKey)}?people=${people}`}
      pot={pot && pot.moreMeals > 0 ? { id: pot.componentId, name: cat.display.get(pot.componentId)?.name ?? pot.componentId } : null}
    />
  );
}
