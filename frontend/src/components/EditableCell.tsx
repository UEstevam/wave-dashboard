import { useState, useRef, useEffect, type KeyboardEvent } from 'react';

interface Props {
  value: string | number | null;
  onSave: (v: string) => void;
  type?: 'text' | 'number' | 'date';
  formatter?: (v: string | number | null) => string;
  className?: string;
  align?: 'left' | 'right' | 'center';
}

export default function EditableCell({ value, onSave, type = 'text', formatter, className = '', align = 'left' }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const display = formatter ? formatter(value) : value !== null && value !== undefined ? String(value) : '';

  const startEdit = () => {
    setDraft(value !== null && value !== undefined ? String(value) : '');
    setEditing(true);
  };

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== String(value ?? '')) onSave(draft);
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  };

  const alignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={onKey}
        className={`cell-input ${alignClass} ${className}`}
      />
    );
  }

  return (
    <div
      onDoubleClick={startEdit}
      className={`cell-editable rounded px-1 py-0.5 min-h-[20px] ${alignClass} ${className} ${!display ? 'text-slate-600' : ''}`}
    >
      {display || '—'}
    </div>
  );
}
