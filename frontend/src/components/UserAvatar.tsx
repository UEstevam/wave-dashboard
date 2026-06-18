interface UserAvatarProps {
  picture?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}

export default function UserAvatar({ picture, name, size = 28, className = '' }: UserAvatarProps) {
  const initials = name
    ? name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <div
      title={name ?? undefined}
      className={`rounded-full overflow-hidden bg-indigo-700 flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {picture ? (
        <img
          src={picture}
          alt={name ?? ''}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className="font-semibold text-white select-none" style={{ fontSize: size * 0.38 }}>
          {initials}
        </span>
      )}
    </div>
  );
}
