export const getAvatarFallback = (name: string): string => {
  const initials = name
    .split(' ')
    .map((part) => part[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const hue = [...name].reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
    <rect width="64" height="64" fill="hsl(${hue},60%,55%)" rx="32"/>
    <text x="32" y="38" font-family="sans-serif" font-size="22" font-weight="bold" fill="white" text-anchor="middle">${initials}</text>
  </svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};
