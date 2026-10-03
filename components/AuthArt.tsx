// Scrapbook cover for the login screens: gingham, paper, and clothing stickers.
const Sticker = ({ children, style, cls = '' }: { children: React.ReactNode; style: React.CSSProperties; cls?: string }) => (
  <span className={`sticker ${cls}`} style={style} aria-hidden>
    <svg viewBox="0 0 100 100">{children}</svg>
  </span>
)

const W = { stroke: '#fff', strokeWidth: 5, strokeLinejoin: 'round' as const, paintOrder: 'stroke' as const }

export default function AuthArt({ title, accent, text }: { title: string; accent: string; text: string }) {
  return (
    <section className="auth-art" aria-label="Outfit Planner">
      {/* striped polo */}
      <Sticker style={{ width: 150, top: '7%', left: '8%', ['--r' as string]: '-8deg' }}>
        <defs>
          <pattern id="stripe" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#f1e2c2" /><rect width="10" height="5" fill="#3d6b72" /></pattern>
        </defs>
        <path d="M30 14 14 22 6 42l14 6 5-9v50h50V39l5 9 14-6-8-20-16-8c-4 8-34 8-38 0Z" fill="url(#stripe)" {...W} />
        <path d="M34 14c4 8 28 8 32 0l-6 12H40Z" fill="#f1e2c2" stroke="#d9c49c" strokeWidth={1.5} />
      </Sticker>
      {/* gingham skirt */}
      <Sticker style={{ width: 130, top: '10%', right: '9%', ['--r' as string]: '7deg' }} cls="d2">
        <defs>
          <pattern id="ging" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#fff" /><rect width="6" height="12" fill="#2f5bd3" opacity=".55" /><rect width="12" height="6" fill="#2f5bd3" opacity=".55" /></pattern>
        </defs>
        <path d="M28 20h44l18 66H10Z" fill="url(#ging)" {...W} />
        <rect x="28" y="16" width="44" height="8" fill="#2f5bd3" />
      </Sticker>
      {/* sneaker */}
      <Sticker style={{ width: 140, top: '74%', right: '9%', ['--r' as string]: '-10deg' }} cls="d3">
        <path d="M8 66c0-8 4-12 10-14l18-6 10-14h10l2 10c8 6 22 8 30 10 6 2 4 14-4 14H12c-3 0-4-2-4 0Z" fill="#c2185b" {...W} />
        <path d="M8 66v6h84v-6" fill="#f1d7a8" stroke="#fff" strokeWidth={4} />
        <path d="M40 46l14 18M48 40l14 20" stroke="#ff8fc4" strokeWidth={3} />
      </Sticker>
      {/* heart, stars, sun */}
      <Sticker style={{ width: 70, top: '58%', left: '6%', ['--r' as string]: '-12deg' }} cls="twinkle">
        <path d="M50 86S12 62 12 36a19 19 0 0 1 38-6 19 19 0 0 1 38 6c0 26-38 50-38 50Z" fill="#d7263d" {...W} />
      </Sticker>
      <Sticker style={{ width: 54, top: '30%', left: '46%' }} cls="twinkle d2">
        <path d="M50 6l12 28 30 3-23 20 7 30-26-16-26 16 7-30L8 37l30-3Z" fill="#e9c46a" {...W} />
      </Sticker>
      <Sticker style={{ width: 40, top: '82%', left: '26%' }} cls="twinkle d3">
        <path d="M50 6l12 28 30 3-23 20 7 30-26-16-26 16 7-30L8 37l30-3Z" fill="#e9c46a" {...W} />
      </Sticker>
      <div className="cover">
        <span className="script-a">{accent}</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </section>
  )
}
