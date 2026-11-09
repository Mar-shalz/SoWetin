import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/action-form';
import { Area, Choice, Input } from '@/components/admin/fields';
import { AdminHeader } from '@/components/admin/header';
import { requireStaff } from '@/lib/admin/guard';
import { GROUPS, HEATS, LANGS } from '@/lib/admin/method';
import { t, type Blocker } from '@/lib/admin/t';
import type { T3Draft } from '@/lib/ai/t3';
import { APP_CONFIG as C } from '@/lib/config/app.config';
import { pictureUrl } from '@/lib/db/env';
import { acceptDraft, markTested, rejectDraft, requestDraft, saveMethod, setStatus, uploadPicture } from '../../actions';

// AI drafts run inside this page's actions.
export const maxDuration = 120;

type Line = {
  ingredient_id: string;
  qty_per_serving: number | null;
  grp: string | null;
  optional: boolean;
  note: string | null;
  sort: number;
  ingredients: { name: string; canonical_unit: string } | null;
};
type Step = { step_no: number; text: string; cue: string | null; heat: (typeof HEATS)[number] | null; timer_seconds: number | null; tip: string | null };
type Dish = {
  id: string;
  name: string;
  status: 'draft' | 'in_review' | 'published' | 'retired';
  updated_at: string;
  local_names: Record<string, string>;
  aliases: string[];
  description: string | null;
  prep_minutes: number | null;
  total_minutes: number;
  tips: string[];
  mistakes: string[];
  storage: string | null;
  serving_note: string | null;
  tested_at: string | null;
  illustration_path: string | null;
  publish_blockers: Blocker[];
  component_ingredients: Line[];
  component_steps: Step[];
};

const DISH =
  'id, name, status, updated_at, local_names, aliases, description, prep_minutes, total_minutes, tips, mistakes, storage, serving_note, tested_at, illustration_path, publish_blockers, component_ingredients(ingredient_id, qty_per_serving, grp, optional, note, sort, ingredients(name, canonical_unit)), component_steps(step_no, text, cue, heat, timer_seconds, tip)';
// Checklist items (doc 05, 5.3) the database can tick by itself, from publish_blockers. The rest need a person.
const ITEMS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'picture'] as const;
const AUTO: Partial<Record<(typeof ITEMS)[number], Blocker[]>> = {
  '1': ['local_names'],
  '2': ['quantities'],
  '4': ['steps', 'cues'],
  '5': ['times'],
  '10': ['tested'],
  '11': ['tips', 'mistakes', 'storage'],
  picture: ['illustration'],
};
const BLANK_STEP_ROWS = 3;
const h2 = 'type-title-m';
const card = 'mt-8 rounded-lg border border-line bg-surface p-5';

// A-03: check one dish against the list, take or drop an AI draft, edit the method, record the kitchen test and
// publish. The database enforces the same rules (supabase/migrations/20261109020000_admin.sql).
export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireStaff();
  const [{ data }, { data: draftRow }] = await Promise.all([
    supabase.from('components').select(DISH).eq('id', id).maybeSingle(),
    supabase
      .from('content_drafts')
      .select('id, payload, model')
      .eq('component_id', id)
      .eq('status', 'needs_review')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!data) notFound();
  const dish = data as unknown as Dish;
  const draft = draftRow as { id: string; payload: T3Draft; model: string } | null;
  const live = dish.status === 'published';
  const lines = [...dish.component_ingredients].sort((a, b) => a.sort - b.sort);
  const steps = [...dish.component_steps].sort((a, b) => a.step_no - b.step_no);
  const nameOf = new Map(lines.map((l) => [l.ingredient_id, `${l.ingredients?.name ?? l.ingredient_id}`]));
  const unitOf = new Map(lines.map((l) => [l.ingredient_id, l.ingredients?.canonical_unit ?? '']));
  const heats: [string, string][] = [['', t('review.noHeat')], ...HEATS.map((h): [string, string] => [h, t(`heat.${h}`)])];
  const groups: [string, string][] = [['', ''], ...GROUPS.map((g): [string, string] => [g, t(`groups.${g}`)])];
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: C.TIMEZONE }).format(new Date());
  const idField = <input type="hidden" name="id" value={dish.id} />;

  return (
    <>
      <AdminHeader email={user.email} />
      <main>
        <Link href="/admin" className="text-enamel underline">
          {t('review.back')}
        </Link>
        <h1 className="mt-3 type-title-l">{dish.name}</h1>
        <p className="text-ink-2">{t(`status.${dish.status}`)}</p>

        <section className={card} aria-labelledby="publish">
          <h2 id="publish" className={h2}>
            {t('review.publishTitle')}
          </h2>
          {live ? (
            <>
              <p className="mt-2">{t('review.frozen')}</p>
              <ActionForm quiet action={setStatus} submit={t('review.unpublish')} pending={t('review.unpublishing')}>
                {idField}
                <input type="hidden" name="status" value="draft" />
              </ActionForm>
            </>
          ) : dish.publish_blockers.length ? (
            <>
              <p className="mt-2">{t('review.needs', { list: dish.publish_blockers.map((b) => t(`blockers.${b}`)).join(', ') })}</p>
              {dish.publish_blockers.includes('illustration') && <p className="mt-1 text-ink-2">{t('review.pictureLater')}</p>}
            </>
          ) : (
            <ActionForm action={setStatus} submit={t('review.publish')} pending={t('review.publishing')}>
              {idField}
              <input type="hidden" name="status" value="published" />
            </ActionForm>
          )}
        </section>

        <section className={card} aria-labelledby="checklist">
          <h2 id="checklist" className={h2}>
            {t('review.checklistTitle')}
          </h2>
          <ul className="mt-3 grid gap-2">
            {ITEMS.map((k) => {
              const codes = AUTO[k];
              const state = !codes ? 'manual' : codes.some((c) => dish.publish_blockers.includes(c)) ? 'missing' : 'done';
              const tone = state === 'done' ? 'text-ugu' : state === 'missing' ? 'text-scotch' : 'text-ink-3';
              return (
                <li key={k} className="grid grid-cols-[8rem_1fr] gap-3">
                  <span className={`type-label ${tone}`}>{t(`review.${state}`)}</span>
                  <span>{t(`checklist.${k}`)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {!live && (
          <section className={card} aria-labelledby="draft">
            <h2 id="draft" className={h2}>
              {t('review.draftTitle')}
            </h2>
            {draft ? (
              <div className="mt-2 grid gap-3">
                <p className="text-ink-2">{t('review.draftFrom', { model: draft.model })}</p>
                {draft.payload.reviewer_notes && (
                  <p className="rounded-md bg-amber-100 p-3">
                    <strong>{t('review.draftNotes')}:</strong> {draft.payload.reviewer_notes}
                  </p>
                )}
                <p>{draft.payload.description}</p>
                <ul className="grid gap-1">
                  {draft.payload.ingredients.map((l) => (
                    <li key={l.ingredient_id}>
                      {nameOf.get(l.ingredient_id) ?? l.ingredient_id}: {l.qty_per_serving} {unitOf.get(l.ingredient_id)} ({t(`groups.${l.grp}`)})
                    </li>
                  ))}
                </ul>
                <ol className="grid list-decimal gap-2 pl-6">
                  {draft.payload.steps.map((s, i) => (
                    <li key={i}>
                      {s.text}
                      {s.heat && <strong> {t(`heat.${s.heat}`)}.</strong>}
                      {s.cue && <span className="text-ink-2"> {s.cue}</span>}
                    </li>
                  ))}
                </ol>
                <p>
                  <strong>{t('review.tips')}:</strong> {draft.payload.tips.join(' ')}
                </p>
                <p>
                  <strong>{t('review.mistakes')}:</strong> {draft.payload.mistakes.join(' ')}
                </p>
                <p>
                  <strong>{t('review.storage')}:</strong> {draft.payload.storage}
                </p>
                <div className="flex flex-wrap gap-3">
                  <ActionForm action={acceptDraft} submit={t('review.draftUse')} pending={t('review.draftUsing')}>
                    <input type="hidden" name="draft" value={draft.id} />
                  </ActionForm>
                  <ActionForm quiet action={rejectDraft} submit={t('review.draftReject')} pending={t('review.draftRejecting')}>
                    <input type="hidden" name="draft" value={draft.id} />
                  </ActionForm>
                </div>
              </div>
            ) : (
              <>
                <p className="mt-2">{t('review.draftNone')}</p>
                <ActionForm action={requestDraft} submit={t('review.draftAsk')} pending={t('review.drafting')}>
                  {idField}
                </ActionForm>
              </>
            )}
          </section>
        )}

        {!live && (
          <section className={card} aria-labelledby="method">
            <h2 id="method" className={h2}>
              {t('review.methodTitle')}
            </h2>
            {/* Keyed by updated_at, so the fields refill after a save or an accepted draft. */}
            <ActionForm key={dish.updated_at} action={saveMethod} submit={t('review.save')} pending={t('review.saving')} className="mt-3 grid gap-6">
              {idField}
              <fieldset className="grid gap-3 md:grid-cols-4">
                <legend className="mb-2 type-label">{t('review.localNames')}</legend>
                {LANGS.map((l) => (
                  <Input key={l} label={t(`langs.${l}`)} name={`local_names.${l}`} defaultValue={dish.local_names[l] ?? ''} />
                ))}
              </fieldset>
              <Input label={t('review.aliases')} name="aliases" defaultValue={dish.aliases.join(', ')} />
              <Area label={t('review.description')} name="description" defaultValue={dish.description ?? ''} />
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('review.prep')} name="prep_minutes" inputMode="numeric" defaultValue={dish.prep_minutes ?? ''} />
                <Input label={t('review.total')} name="total_minutes" inputMode="numeric" required defaultValue={dish.total_minutes} />
              </div>

              <fieldset className="grid gap-3">
                <legend className="mb-2 type-label">{t('review.ingredientsTitle')}</legend>
                {lines.map((l) => (
                  <div key={l.ingredient_id} className="grid items-end gap-3 md:grid-cols-[2fr_1fr_1fr_2fr]">
                    <input type="hidden" name="line" value={l.ingredient_id} />
                    <p className="md:pb-3">
                      {nameOf.get(l.ingredient_id)}
                      {l.optional && <span className="text-ink-2"> ({t('review.optional')})</span>}
                    </p>
                    <Input
                      label={`${t('review.qty')} (${unitOf.get(l.ingredient_id)})`}
                      name={`line.${l.ingredient_id}.qty`}
                      inputMode="decimal"
                      defaultValue={l.qty_per_serving ?? ''}
                    />
                    <Choice label={t('review.group')} name={`line.${l.ingredient_id}.grp`} options={groups} defaultValue={l.grp ?? ''} />
                    <Input label={t('review.note')} name={`line.${l.ingredient_id}.note`} defaultValue={l.note ?? ''} />
                  </div>
                ))}
              </fieldset>

              <fieldset className="grid gap-4">
                <legend className="mb-2 type-label">{t('review.stepsTitle')}</legend>
                <p className="text-ink-2">{t('review.stepsHint')}</p>
                {[...steps, ...Array.from({ length: BLANK_STEP_ROWS }, () => null)].map((s, i) => (
                  <div key={i} className="grid gap-3 border-t border-line pt-3 md:grid-cols-[3fr_2fr_1fr_1fr]">
                    <Area label={t('review.step', { n: i + 1 })} name="step_text" defaultValue={s?.text ?? ''} />
                    <Area label={t('review.cue')} name="step_cue" defaultValue={s?.cue ?? ''} />
                    <Choice label={t('review.heat')} name="step_heat" options={heats} defaultValue={s?.heat ?? ''} />
                    <Input label={t('review.timer')} name="step_timer" inputMode="decimal" defaultValue={s?.timer_seconds ? s.timer_seconds / 60 : ''} />
                    <Input label={t('review.stepTip')} name="step_tip" defaultValue={s?.tip ?? ''} className="md:col-span-4" />
                  </div>
                ))}
              </fieldset>

              {(['tips', 'mistakes'] as const).map((k) => (
                <fieldset key={k} className="grid gap-3">
                  <legend className="mb-2 type-label">{t(`review.${k}`)}</legend>
                  {[0, 1, 2].map((i) => (
                    <Input key={i} label={`${t(`review.${k}`)} ${i + 1}`} name={k === 'tips' ? 'tip' : 'mistake'} defaultValue={dish[k][i] ?? ''} />
                  ))}
                </fieldset>
              ))}
              <Area label={t('review.storage')} name="storage" defaultValue={dish.storage ?? ''} />
              <Input label={t('review.servingNote')} name="serving_note" defaultValue={dish.serving_note ?? ''} />
            </ActionForm>
          </section>
        )}

        <section className={card} aria-labelledby="picture">
          <h2 id="picture" className={h2}>
            {t('review.pictureTitle')}
          </h2>
          {dish.illustration_path ? (
            <Image
              src={pictureUrl(dish.illustration_path)!}
              alt={dish.name}
              width={320}
              height={240}
              className="mt-3 rounded-md border border-line object-cover"
            />
          ) : (
            <p className="mt-2">{t('review.pictureNone')}</p>
          )}
          {!live && (
            <ActionForm action={uploadPicture} submit={t('review.pictureUpload')} pending={t('review.pictureUploading')} className="mt-3">
              {idField}
              <p className="mb-2 text-ink-2">{t('review.pictureHint')}</p>
              <Input label={t('review.pictureFile')} type="file" name="picture" required accept="image/webp,image/png,image/jpeg,image/avif" />
            </ActionForm>
          )}
        </section>

        <section className={card} aria-labelledby="tested">
          <h2 id="tested" className={h2}>
            {t('review.testedTitle')}
          </h2>
          <p className="mt-2">{dish.tested_at ? t('review.testedDone', { date: dish.tested_at }) : t('review.testedNone')}</p>
          {!live && (
            <ActionForm action={markTested} submit={t('review.testedMark')} pending={t('review.testedMarking')} className="mt-3">
              {idField}
              <Input label={t('review.testedDate')} type="date" name="tested_at" required max={today} defaultValue={today} className="max-w-xs" />
            </ActionForm>
          )}
        </section>
      </main>
    </>
  );
}
