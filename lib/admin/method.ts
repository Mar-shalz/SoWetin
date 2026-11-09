import { z } from 'zod';

// The words the database accepts (doc 07: component_ingredients.grp, component_steps.heat) and the local-name
// languages the seeds use. A method is what public.apply_method writes: a present key is saved, '' clears it.
export const GROUPS = ['base', 'protein', 'vegetable', 'seasoning', 'oil', 'garnish'] as const;
export const HEATS = ['low', 'medium', 'high'] as const;
export const LANGS = ['yo', 'ig', 'ha', 'ef', 'ed', 'urh', 'tw'] as const;
export const DISH_ID = z.string().regex(/^[a-z0-9-]{1,80}$/);

const text = (max: number) => z.string().trim().max(max);
const blankOr = <T extends z.ZodType>(s: T) => z.union([z.literal(''), s]);

const formSchema = z.object({
  local_names: z.partialRecord(z.enum(LANGS), text(60).min(1)),
  aliases: z.array(text(60).min(1)).max(10),
  description: text(400),
  prep_minutes: blankOr(z.coerce.number().int().min(0).max(1440)),
  total_minutes: z.coerce.number().int().min(1).max(2880),
  ingredients: z.array(
    z.object({
      ingredient_id: DISH_ID,
      qty_per_serving: blankOr(z.coerce.number().min(0.01).max(5000)),
      grp: blankOr(z.enum(GROUPS)),
      note: text(120),
    }),
  ),
  steps: z
    .array(
      z.object({
        text: text(300).min(3),
        cue: text(200),
        heat: blankOr(z.enum(HEATS)),
        timer_seconds: blankOr(z.coerce.number().int().min(10).max(21600)),
        tip: text(200),
      }),
    )
    .max(30),
  tips: z.array(text(240).min(1)).max(3),
  mistakes: z.array(text(240).min(1)).max(3),
  storage: text(300),
  serving_note: text(200),
});
export type FormMethod = z.infer<typeof formSchema>;

// The review form (A-03) posts flat fields; this turns them into a method and validates every one.
// Timers are typed in minutes, the way cooks think, and stored in seconds.
export function methodFromForm(form: FormData) {
  const get = (k: string) => String(form.get(k) ?? '').trim();
  const all = (k: string) => form.getAll(k).map((v) => String(v).trim());
  const [texts, cues, heats, timers, tips] = ['step_text', 'step_cue', 'step_heat', 'step_timer', 'step_tip'].map(all);
  return formSchema.safeParse({
    local_names: Object.fromEntries(LANGS.map((l) => [l, get(`local_names.${l}`)]).filter(([, v]) => v)),
    aliases: get('aliases')
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean),
    description: get('description'),
    prep_minutes: get('prep_minutes'),
    total_minutes: get('total_minutes'),
    ingredients: all('line').map((id) => ({
      ingredient_id: id,
      qty_per_serving: get(`line.${id}.qty`),
      grp: get(`line.${id}.grp`),
      note: get(`line.${id}.note`),
    })),
    steps: texts
      .map((t, i) => ({
        text: t,
        cue: cues[i] ?? '',
        heat: heats[i] ?? '',
        timer_seconds: timers[i] ? String(Math.round(Number(timers[i]) * 60)) : '',
        tip: tips[i] ?? '',
      }))
      .filter((s) => s.text),
    tips: all('tip').filter(Boolean),
    mistakes: all('mistake').filter(Boolean),
    storage: get('storage'),
    serving_note: get('serving_note'),
  });
}
