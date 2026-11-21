import { CloseIcon } from '@/components/ui/icons';

// Close for every bottom sheet: an icon on a small square, inside the dialog's own form so it closes it with no script.
export function CloseButton({ label }: { label: string }) {
  return (
    <form method="dialog" className="shrink-0">
      <button aria-label={label} className="flex size-12 items-center justify-center sw-close rounded-xs border border-ink-3 bg-surface">
        <CloseIcon size={20} />
      </button>
    </form>
  );
}
