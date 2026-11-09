import { createTranslator } from 'next-intl';
import messages from '@/messages/admin.en-NG.json';

// The admin is a staff tool in English only (doc 11), so its copy has its own file, outside i18n:check.
export const t = createTranslator({ locale: 'en-NG', messages });
export type Blocker = keyof typeof messages.blockers;
