'use client'
import type { CSSProperties } from 'react'

// Where each cut-out sits on the board, depending on how many there are.
// [left%, top%, width%, height%, rotation°]
const LAYOUTS: number[][][] = [
  [],
  [[12, 8, 76, 84, 0]],
  [[4, 6, 58, 80, -4], [46, 26, 50, 66, 5]],
  [[4, 4, 56, 64, -4], [48, 10, 48, 50, 6], [30, 56, 44, 40, -2]],
  [[2, 4, 50, 56, -5], [50, 4, 46, 46, 4], [6, 56, 42, 40, 3], [52, 52, 42, 44, -4]],
  [[2, 2, 48, 50, -5], [50, 2, 46, 42, 4], [4, 52, 38, 40, 3], [56, 44, 38, 30, -3], [36, 70, 36, 28, 2]],
]

export default function LookBoard({ urls, emptyText = 'No pieces yet' }: { urls: string[]; emptyText?: string }) {
  const shown = urls.slice(0, 5)
  const layout = LAYOUTS[shown.length] || []
  return (
    <div className="board">
      {shown.length === 0 && <div className="empty">{emptyText}</div>}
      {shown.map((u, i) => {
        const [l, t, w, h, r] = layout[i]
        const style = { left: `${l}%`, top: `${t}%`, width: `${w}%`, height: `${h}%`, ['--rot' as string]: `${r}deg`, ['--n' as string]: i } as CSSProperties
        return <img key={u + i} src={u} alt="" style={style} loading="lazy" />
      })}
    </div>
  )
}
