const BLIPS: [number, number][] = [[128, 62], [70, 88], [112, 128], [150, 104], [84, 140]];

export function Radar() {
  return (
    <div className="relative mx-auto h-52 w-52" aria-hidden="true">
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <circle cx="100" cy="100" r="97" fill="none" stroke="rgb(var(--cyan))" strokeWidth="3" />
        <circle cx="100" cy="100" r="92" fill="rgb(var(--bg))" fillOpacity="0.7" />
        {[30, 55, 78].map((r) => <circle key={r} cx="100" cy="100" r={r} fill="none" stroke="rgb(var(--cyan))" strokeOpacity="0.35" />)}
        <line x1="100" y1="8" x2="100" y2="192" stroke="rgb(var(--cyan))" strokeOpacity="0.35" />
        <line x1="8" y1="100" x2="192" y2="100" stroke="rgb(var(--cyan))" strokeOpacity="0.35" />
        {BLIPS.map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="3.5" fill="rgb(var(--orange))" />)}
      </svg>
      <div className="radar-sweep absolute inset-[8px] rounded-full" />
    </div>
  );
}
