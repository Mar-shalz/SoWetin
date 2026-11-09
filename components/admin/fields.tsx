import type { ReactNode } from 'react';

// Plain labelled inputs for the admin forms: 48 px targets, visible labels, token colours (doc 12).
const box = 'min-h-12 w-full rounded-md border border-ink-3 bg-sunken px-3 py-2 type-input';

export function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`grid gap-1 ${className ?? ''}`}>
      <span className="type-label">{label}</span>
      {children}
    </label>
  );
}

export function Input({ label, className, ...rest }: { label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} className={className}>
      <input className={box} {...rest} />
    </Field>
  );
}

export function Area({ label, className, ...rest }: { label: string; className?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} className={className}>
      <textarea rows={2} className={box} {...rest} />
    </Field>
  );
}

export function Choice({
  label,
  options,
  className,
  ...rest
}: { label: string; options: [string, string][]; className?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} className={className}>
      <select className={box} {...rest}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </Field>
  );
}
