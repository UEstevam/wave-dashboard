interface BadgeProps {
  value: string;
  color: string;
  small?: boolean;
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export default function Badge({ value, color, small }: BadgeProps) {
  if (!value) return null;
  return (
    <span
      className={`inline-flex items-center font-semibold rounded-md whitespace-nowrap ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'}`}
      style={{ background: hexToRgba(color, 0.18), color, border: `1px solid ${hexToRgba(color, 0.35)}` }}
    >
      {value}
    </span>
  );
}
