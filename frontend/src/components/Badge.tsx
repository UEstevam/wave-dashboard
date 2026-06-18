interface BadgeProps {
  value: string;
  color: string;
  small?: boolean;
}


export default function Badge({ value, color, small }: BadgeProps) {
  if (!value) return null;
  return (
    <span
      className={`inline-flex items-center font-semibold rounded whitespace-nowrap text-white ${small ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-[3px] text-[11px]'}`}
      style={{ background: color }}
    >
      {value}
    </span>
  );
}
