// Floating line-drawn garments for the login screen. Pure SVG, no network.
const GARMENTS: { d: string; style: React.CSSProperties }[] = [
  // dress
  { d: 'M40 8h20l4 18 22 64H14L36 26l4-18Zm0 0c3 6 17 6 20 0M36 26h28', style: { width: 120, height: 130, top: '8%', left: '6%', ['--r' as string]: '-8deg', animationDelay: '0s' } },
  // sneaker
  { d: 'M8 62c0-8 4-12 10-14l18-6 10-14h10l2 10c8 6 22 8 30 10 6 2 4 14-4 14H12c-3 0-4-2-4 0Zm0 0v6h84M36 42l6 6m2-12 6 6', style: { width: 150, height: 110, top: '14%', right: '6%', ['--r' as string]: '10deg', animationDelay: '-2s' } },
  // sunglasses
  { d: 'M6 40h28c2 14-4 22-14 22S4 54 6 40Zm60 0h28c2 14-4 22-14 22S64 54 66 40ZM34 44c6-4 26-4 32 0M6 40 2 30m92 10 4-10', style: { width: 140, height: 90, top: '44%', left: '30%', ['--r' as string]: '-6deg', animationDelay: '-4s' } },
  // handbag
  { d: 'M18 40h64l8 50H10l8-50Zm14 0c0-18 36-18 36 0M30 56h40', style: { width: 110, height: 110, top: '40%', right: '12%', ['--r' as string]: '6deg', animationDelay: '-1s' } },
  // shirt
  { d: 'M36 10 18 18 6 40l14 6 6-10v54h48V36l6 10 14-6-12-22-18-8c-2 8-26 8-28 0ZM50 22v62', style: { width: 120, height: 120, top: '6%', left: '42%', ['--r' as string]: '4deg', animationDelay: '-3s' } },
  // heel
  { d: 'M14 30c10 0 18 20 34 26l30 8c8 2 10 10 2 12H52L36 60l-4 30h-6l2-34c-6-6-14-16-14-26Z', style: { width: 110, height: 110, top: '64%', right: '6%', ['--r' as string]: '-12deg', animationDelay: '-5s' } },
]

export default function AuthArt({ title, text }: { title: string; text: string }) {
  return (
    <section className="auth-art" aria-label="Outfit Planner">
      {GARMENTS.map((g, i) => (
        <span key={i} className="garment" style={g.style} aria-hidden>
          <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d={g.d} />
          </svg>
        </span>
      ))}
      <h1>{title}</h1>
      <p>{text}</p>
    </section>
  )
}
