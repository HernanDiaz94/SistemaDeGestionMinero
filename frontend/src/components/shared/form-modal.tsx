'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type FormValue = string | number | boolean;
export type FormValues = Record<string, FormValue>;

export interface FormField {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'number' | 'date' | 'datetime-local' | 'time' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  helper?: string;
  min?: string | number;
  max?: string | number;
  step?: string | number;
  disabled?: boolean;
  full?: boolean;
  accept?: string;
}

interface FormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FormField[];
  initialValues?: Record<string, unknown>;
  onSubmit: (values: FormValues) => Promise<void> | void;
  submitLabel?: string;
  extraContent?: ReactNode;
  wide?: boolean;
}

function initialToValue(field: FormField, source: Record<string, unknown>): FormValue {
  const value = source[field.name];
  if (field.type === 'checkbox') return value === true || value === 'true' || value === 1;
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  const stringValue = String(value);
  if (field.type === 'datetime-local') return stringValue.slice(0, 16);
  if (field.type === 'date') return stringValue.slice(0, 10);
  if (field.type === 'time') return stringValue.slice(0, 5);
  return stringValue;
}

export function FormModal({
  open,
  onOpenChange,
  title,
  description,
  fields,
  initialValues = {},
  onSubmit,
  submitLabel = 'Guardar',
  extraContent,
  wide = false,
}: FormModalProps) {
  const [values, setValues] = useState<FormValues>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const next: FormValues = {};
    fields.forEach((field) => {
      next[field.name] = initialToValue(field, initialValues);
    });
    setValues(next);
    setErrors({});
    setSubmitError(null);
    // Los campos y valores iniciales se capturan al abrir el modal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function setValue(name: string, value: FormValue) {
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    fields.forEach((field) => {
      const value = values[field.name];
      if (field.required && (value === '' || value === null || value === undefined)) {
        nextErrors[field.name] = 'Este campo es obligatorio';
      } else if (field.type === 'number' && value !== '' && !Number.isFinite(Number(value))) {
        nextErrors[field.name] = 'Debe ser un número válido';
      }
    });
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const payload: FormValues = { ...values };
    fields.forEach((field) => {
      if (field.type === 'number' && payload[field.name] !== '') {
        payload[field.name] = Number(payload[field.name]);
      }
    });
    setSubmitting(true);
    setSubmitError(null);
    try {
      await onSubmit(payload);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'No se pudo guardar la información');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(wide && 'max-w-4xl')}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.name} className={cn('space-y-1.5', field.full && 'sm:col-span-2')}>
                {field.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={Boolean(values[field.name])}
                      disabled={field.disabled}
                      onChange={(event) => setValue(field.name, event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                    />
                    {field.label}
                  </label>
                ) : (
                  <>
                    <Label htmlFor={`field-${field.name}`}>
                      {field.label}
                      {field.required && <span className="ml-0.5 text-red-500">*</span>}
                    </Label>
                    {field.type === 'select' ? (
                      <Select
                        id={`field-${field.name}`}
                        value={asStringValue(values[field.name])}
                        onChange={(event) => setValue(field.name, event.target.value)}
                        options={field.options}
                        placeholder="Seleccione…"
                        disabled={field.disabled}
                        className={cn(errors[field.name] && 'border-red-400')}
                      />
                    ) : field.type === 'textarea' ? (
                      <Textarea
                        id={`field-${field.name}`}
                        value={asStringValue(values[field.name])}
                        onChange={(event) => setValue(field.name, event.target.value)}
                        placeholder={field.placeholder}
                        disabled={field.disabled}
                        className={cn(errors[field.name] && 'border-red-400')}
                      />
                    ) : (
                      <Input
                        id={`field-${field.name}`}
                        type={field.type ?? 'text'}
                        value={asStringValue(values[field.name])}
                        onChange={(event) => setValue(field.name, event.target.value)}
                        placeholder={field.placeholder}
                        min={field.min}
                        max={field.max}
                        step={field.step}
                        disabled={field.disabled}
                        accept={field.accept}
                        className={cn(errors[field.name] && 'border-red-400')}
                      />
                    )}
                    {field.helper && <p className="text-xs text-slate-400">{field.helper}</p>}
                    {errors[field.name] && <p className="text-xs text-red-600">{errors[field.name]}</p>}
                  </>
                )}
              </div>
            ))}
          </div>
          {extraContent}
          {submitError && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{submitError}</span>
            </div>
          )}
          <DialogFooter className="border-t border-slate-100 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function asStringValue(value: FormValue | undefined): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

export const field = (name: string, label: string, extra: Omit<FormField, 'name' | 'label'> = {}): FormField => ({
  name,
  label,
  ...extra,
});

export const selectOptions = (items: Array<{ id?: string; value?: string; label?: string; name?: string; code?: string }>) =>
  items.map((item) => ({
    value: String(item.value ?? item.id ?? ''),
    label: String(item.label ?? item.name ?? item.code ?? ''),
  }));
