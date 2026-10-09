/* Ícone próprio do site (não é logotipo oficial): uma carta com um círculo vermelho e branco, como o da Poké Bola */
export function Logo({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect x="7" y="3" width="26" height="34" rx="4.5" fill="var(--logo-card, #1d1b20)" />
      <path d="M11.5 20a8.5 8.5 0 0 1 17 0z" fill="#e3350d" />
      <path d="M11.5 20a8.5 8.5 0 0 0 17 0z" fill="#fff" />
      <path d="M11.5 20h17" stroke="var(--logo-card, #1d1b20)" strokeWidth="2.2" />
      <circle cx="20" cy="20" r="3.3" fill="#fff" stroke="var(--logo-card, #1d1b20)" strokeWidth="2.2" />
    </svg>
  );
}
