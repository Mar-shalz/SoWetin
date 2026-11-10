import { APP_CONFIG as C } from '@/lib/config/app.config';

export type Tier = 'full' | 'lite' | 'reduced';
export type MotionPref = 'auto' | Tier;
export type Device = { reduced: boolean; memoryGb?: number; cores?: number; saveData?: boolean };
const LITE_MAX_CORES = 4; // doc 10, section 2

// Doc 10, section 2: the person's own choice wins; otherwise reduced motion, then a modest phone or Save-Data, gives Lite.
export function motionTier(pref: MotionPref, d: Device): Tier {
  if (pref !== 'auto') return pref;
  if (d.reduced) return 'reduced';
  const modest = (d.memoryGb !== undefined && d.memoryGb <= C.MOTION_LITE_MAX_DEVICE_MEMORY_GB) || (d.cores !== undefined && d.cores <= LITE_MAX_CORES) || !!d.saveData;
  return modest ? 'lite' : 'full';
}
