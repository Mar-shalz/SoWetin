import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { pictureUrl, siteUrl } from '@/lib/db/env';
import { Videos, type VideoRef } from '@/components/plate/videos';
import { formatNaira } from '@/lib/i18n/money';
import { catalogueForRequest, lagosToday } from '@/lib/plates/serve';
import { cookServings, costPlate } from '@/lib/pricing/costPlate';

type Dish = {
  id: string;
  name: string;
  status: string;
  description: string | null;
  local_names: Record<string, string>;
  equipment: string[];
  tips: string[];
  mistakes: string[];
  storage: string | null;
  serving_note: string | null;
  types: string[];
  region: string;
  cuisine_family: string;
  prep_minutes: number | null;
  total_minutes: number;
  illustration_path: string | null;
  component_steps: { step_no: number; text: string; cue: string | null; heat: 'low' | 'medium' | 'high' | null }[];
  videos: (VideoRef & { rank: number | null; status: string })[];
};

// One database read per request, shared by the page and its metadata. Published dishes only for the public;
// staff signed in with the second factor also see drafts, marked noindex.
const load = cache(async (slug: string) => {
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) return null;
  const { cat, client } = await catalogueForRequest();
  if (!cat || !client) return null;
  const { data } = await client
    .from('components')
    .select(
      'id, name, status, description, local_names, equipment, tips, mistakes, storage, serving_note, types, region, cuisine_family, prep_minutes, total_minutes, illustration_path, component_steps(step_no, text, cue, heat), videos(youtube_id, title, channel_title, duration_seconds, thumbnail_url, rank, status)',
    )
    .eq('id', slug)
    .maybeSingle();
  return data ? { cat, dish: data as Dish } : null;
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) return {};
  const t = await getTranslations();
  const { dish } = found;
  const picture = pictureUrl(dish.illustration_path);
  return {
    title: t('dish.title', { name: dish.name, area: t('areas.lagos') }),
    description: dish.description ?? undefined,
    alternates: { canonical: `/dish/${dish.id}` },
    robots: dish.status === 'published' ? undefined : { index: false, follow: false },
    openGraph: picture ? { images: [picture] } : undefined,
  };
}

const minutes = (n: number | null) => (n === null ? undefined : `PT${n}M`);

// S-011 dish page (doc 02; doc 05, section 8): the full written method, readable without JavaScript, the price for
// DISH_PAGE_PEOPLE in Lagos, and Recipe structured data. No ratings until real ones exist.
// shortcut: no videos, "Similar dishes" or Open Graph card yet; "Goes well with" shows approved pairings only.
export default async function DishPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const found = await load(slug);
  if (!found) notFound();
  const { cat, dish } = found;
  const [t, nonce] = await Promise.all([getTranslations(), headers().then((h) => h.get('x-nonce') ?? undefined)]);
  const c = cat.snap.components.get(dish.id);
  const people = C.DISH_PAGE_PEOPLE;
  const servings = c ? cookServings({ id: dish.id, batchServingsMin: c.batchServingsMin, lines: [] }, people) : people;
  const cost = c
    ? costPlate(
        [
          {
            id: c.id,
            batchServingsMin: c.batchServingsMin,
            lines: c.lines.map((l) => ({ ingredientId: l.ingredientId, qtyPerServing: l.qtyPerServing, group: l.group })),
          },
        ],
        people,
        { cooked: [], foodstuff: [], basic: [] },
        cat.book,
        lagosToday(),
        C,
      )
    : null;
  const unit = (id: string) => cat.book.ingredients[id]?.canonicalUnit ?? 'g';
  const amount = (n: number) => (n >= 10 ? Math.round(n) : Math.round(n * 10) / 10);
  const ingredients = (c?.lines ?? []).map((l) => ({
    name: cat.names.get(l.ingredientId) ?? l.ingredientId,
    qty: l.qtyPerServing === null ? null : `${amount(l.qtyPerServing * servings)} ${unit(l.ingredientId)}`,
  }));
  const steps = [...dish.component_steps].sort((a, b) => a.step_no - b.step_no);
  const goesWith = [...cat.snap.pairings]
    .filter(([k]) => k.split('|').includes(dish.id))
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k.split('|').find((id) => id !== dish.id)!)
    .filter((id) => cat.display.get(id))
    .slice(0, 4);
  const picture = pictureUrl(dish.illustration_path);
  const published = dish.status === 'published';
  const peopleLabel = t('home.sentence.people', { count: people });

  // Google's Recipe type needs an image, so the data only goes out once a published dish has its picture.
  const recipe =
    published && picture
      ? {
          '@context': 'https://schema.org',
          '@type': 'Recipe',
          name: dish.name,
          image: [picture],
          description: dish.description ?? undefined,
          author: { '@type': 'Organization', name: C.APP_NAME },
          recipeYield: peopleLabel,
          recipeCuisine: `${dish.cuisine_family}, ${dish.region}`,
          recipeCategory: dish.types[0],
          prepTime: minutes(dish.prep_minutes),
          totalTime: minutes(dish.total_minutes),
          recipeIngredient: ingredients.map((i) => (i.qty ? `${i.qty} ${i.name}` : i.name)),
          recipeInstructions: steps.map((s) => ({ '@type': 'HowToStep', text: s.cue ? `${s.text} ${s.cue}` : s.text })),
          url: `${siteUrl()}/dish/${dish.id}`,
        }
      : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-app flex-col gap-6 px-4 py-6">
      <Link href="/" className="flex min-h-12 items-center justify-center rounded-pill border-2 border-ink bg-palm-100 px-4 type-label">
        {t('dish.cta.pick')}
      </Link>
      {picture && (
        <Image
          src={picture}
          alt={dish.name}
          width={640}
          height={480}
          priority
          sizes="(max-width: 480px) 100vw, 480px"
          className="aspect-[4/3] w-full rounded-lg object-cover"
        />
      )}
      <div>
        <h1 className="type-display-l">{dish.name}</h1>
        {!!Object.keys(dish.local_names).length && <p className="text-ink-2">{Object.values(dish.local_names).join(' · ')}</p>}
      </div>
      {dish.description && <p className="type-body-l">{dish.description}</p>}

      {cost && (
        <section aria-label={t('plate.price.label')}>
          <p className="type-title-m">
            {t('dish.price', {
              people: peopleLabel,
              area: t('areas.lagos'),
              range: t('plate.price.range', { low: formatNaira(cost.outlayLowNgn), high: formatNaira(cost.outlayHighNgn) }),
            })}
          </p>
          <p className="type-caption text-ink-2">{t('plate.price.meta.ageing', { area: t('areas.lagos'), date: cost.oldestPriceDate })}</p>
          <p className="mt-1 type-caption text-ink-2">
            {t('prices.note.line')}{' '}
            <Link href="/legal/sources#prices" className="underline">
              {t('detail.howWePrice')}
            </Link>
          </p>
        </section>
      )}

      {!!dish.equipment.length && (
        <section aria-labelledby="equipment">
          <h2 id="equipment" className="type-title-m">
            {t('recipe.equipment')}
          </h2>
          <p>{dish.equipment.join(', ')}</p>
        </section>
      )}

      <section aria-labelledby="ingredients">
        <h2 id="ingredients" className="type-title-m">
          {t('recipe.ingredients', { people: servings })}
        </h2>
        <ul className="mt-1 grid gap-1">
          {ingredients.map((i) => (
            <li key={i.name}>
              {i.name}
              {i.qty && <span className="text-ink-2"> {i.qty}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="steps">
        <h2 id="steps" className="type-title-m">
          {t('recipe.steps')}
        </h2>
        {steps.length ? (
          <ol className="mt-1 grid list-decimal gap-3 pl-6">
            {steps.map((s) => (
              <li key={s.step_no} className="type-cook-step">
                {s.text}
                {s.heat && <span className="block type-label text-ink-2">{t(`recipe.heat.${s.heat}`)}</span>}
                {s.cue && <span className="block type-body-m text-ink-2">{s.cue}</span>}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-ink-2">{t('recipe.notYet')}</p>
        )}
      </section>

      {!!dish.tips.length && (
        <section aria-labelledby="tips">
          <h2 id="tips" className="type-title-m">
            {t('recipe.tips')}
          </h2>
          <ul className="list-disc pl-6">
            {dish.tips.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}
      {!!dish.mistakes.length && (
        <section aria-labelledby="mistakes">
          <h2 id="mistakes" className="type-title-m">
            {t('recipe.mistakes')}
          </h2>
          <ul className="list-disc pl-6">
            {dish.mistakes.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}
      {dish.storage && (
        <p>
          <span className="type-label">{t('recipe.storage')}:</span> {dish.storage}
        </p>
      )}
      {published && (
        <p className="type-caption text-ink-2">
          {t('recipes.note.line')}{' '}
          <Link href="/legal/sources#recipes" className="underline">
            {t('legal.sources.title')}
          </Link>
        </p>
      )}

      <Videos videos={dish.videos.filter((v) => v.status === 'approved' && v.rank).sort((a, b) => a.rank! - b.rank!)} />

      {!!goesWith.length && (
        <section aria-labelledby="goes-with">
          <h2 id="goes-with" className="type-title-m">
            {t('detail.goesWith')}
          </h2>
          <ul className="mt-1 flex flex-wrap gap-2">
            {goesWith.map((id) => (
              <li key={id}>
                <Link href={`/dish/${id}`} className="inline-flex min-h-12 items-center rounded-pill border-2 border-ink bg-surface px-4 type-label">
                  {cat.display.get(id)!.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {recipe && (
        // "<" is escaped so no dish text can ever close the script tag.
        <script type="application/ld+json" nonce={nonce} dangerouslySetInnerHTML={{ __html: JSON.stringify(recipe).replace(/</g, '\\u003c') }} />
      )}
    </main>
  );
}
