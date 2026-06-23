const EXT_RE = /[\s.]+(mp4|mov|avi|mkv|webm|gif|png|jpg|jpeg|heic|heif)$/i;

export function formatCreativeName(filename: string): string {
  return filename
    .replace(EXT_RE, '')
    .replace(/^processed[\s_]+/i, '')
    .trim()
    .replace(/\s+/g, '-')
    .toUpperCase();
}

export function generateYouTubeTitle(): string {
  return Array.from({ length: 12 }, () => Math.floor(Math.random() * 10)).join('');
}
