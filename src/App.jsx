import { useEffect, useMemo, useRef, useState } from 'react'

const CELL = 18
const COLS = 24
const ROWS = 24
const TICK_MS = 95

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function keyOf(p) {
  return `${p.x},${p.y}`
}

function eq(a, b) {
  return a.x === b.x && a.y === b.y
}

function wrap(p) {
  let x = p.x
  let y = p.y
  if (x < 0) x = COLS - 1
  if (x >= COLS) x = 0
  if (y < 0) y = ROWS - 1
  if (y >= ROWS) y = 0
  return { x, y }
}

function nextHead(head, dir) {
  const d = { x: 0, y: 0 }
  if (dir === 'up') d.y = -1
  if (dir === 'down') d.y = 1
  if (dir === 'left') d.x = -1
  if (dir === 'right') d.x = 1
  return wrap({ x: head.x + d.x, y: head.y + d.y })
}

function placeFood(occupiedSet) {
  // Try random sampling first
  for (let i = 0; i < 500; i++) {
    const p = { x: randInt(0, COLS - 1), y: randInt(0, ROWS - 1) }
    if (!occupiedSet.has(keyOf(p))) return p
  }
  // Fallback scan
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const p = { x, y }
      if (!occupiedSet.has(keyOf(p))) return p
    }
  }
  return { x: 0, y: 0 }
}

function initialSnake() {
  const cx = Math.floor(COLS / 2)
  const cy = Math.floor(ROWS / 2)
  return [
    { x: cx + 1, y: cy },
    { x: cx, y: cy },
    { x: cx - 1, y: cy },
  ]
}

function isOpposite(a, b) {
  return (
    (a === 'up' && b === 'down') ||
    (a === 'down' && b === 'up') ||
    (a === 'left' && b === 'right') ||
    (a === 'right' && b === 'left')
  )
}

export default function App() {
  const [snake, setSnake] = useState(() => initialSnake())
  const [dir, setDir] = useState('right')
  const [queuedDir, setQueuedDir] = useState(null)
  const [running, setRunning] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(() => {
    const v = localStorage.getItem('snake_best')
    return v ? Number(v) : 0
  })

  const occupied = useMemo(() => {
    const s = new Set()
    snake.forEach((p) => s.add(keyOf(p)))
    return s
  }, [snake])

  const [food, setFood] = useState(() => placeFood(occupied))

  const runningRef = useRef(running)
  useEffect(() => {
    runningRef.current = running
  }, [running])

  useEffect(() => {
    localStorage.setItem('snake_best', String(best))
  }, [best])

  function reset() {
    const s = initialSnake()
    const occ = new Set(s.map(keyOf))
    setSnake(s)
    setDir('right')
    setQueuedDir(null)
    setScore(0)
    setFood(placeFood(occ))
    setGameOver(false)
    setRunning(false)
  }

  function start() {
    if (gameOver) return
    setRunning(true)
  }

  function togglePause() {
    if (gameOver) return
    setRunning((r) => !r)
  }

  useEffect(() => {
    function onKeyDown(e) {
      const k = e.key.toLowerCase()
      if (k === ' ' || k === 'p') {
        e.preventDefault()
        togglePause()
        return
      }
      if (k === 'r') {
        reset()
        return
      }
      if (k === 'enter') {
        if (!runningRef.current && !gameOver) start()
        return
      }

      let nd = null
      if (k === 'arrowup' || k === 'w') nd = 'up'
      if (k === 'arrowdown' || k === 's') nd = 'down'
      if (k === 'arrowleft' || k === 'a') nd = 'left'
      if (k === 'arrowright' || k === 'd') nd = 'right'
      if (!nd) return

      setQueuedDir((prev) => {
        // Keep the latest requested dir
        return nd
      })
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [gameOver])

  useEffect(() => {
    if (!running || gameOver) return

    const id = setInterval(() => {
      setSnake((prev) => {
        let nextDir = dir
        if (queuedDir && !isOpposite(queuedDir, dir)) nextDir = queuedDir

        const head = prev[0]
        const nh = nextHead(head, nextDir)

        // Self collision check: allow moving into the tail if it will move away (when not eating)
        const willEat = eq(nh, food)
        const bodyToCheck = willEat ? prev : prev.slice(0, -1)
        if (bodyToCheck.some((p) => eq(p, nh))) {
          setGameOver(true)
          setRunning(false)
          setBest((b) => Math.max(b, score))
          return prev
        }

        const next = [nh, ...prev]
        if (!willEat) next.pop()

        // Update dir and queuedDir
        setDir(nextDir)
        setQueuedDir(null)

        if (willEat) {
          const nextScore = score + 1
          setScore(nextScore)
          setBest((b) => Math.max(b, nextScore))
          const occ = new Set(next.map(keyOf))
          setFood(placeFood(occ))
        }

        return next
      })
    }, TICK_MS)

    return () => clearInterval(id)
  }, [running, gameOver, dir, queuedDir, food, score])

  const statusText = gameOver
    ? 'Game Over — Press R to restart'
    : running
      ? 'Running — Space/P to pause'
      : 'Paused — Enter to start, Space/P to toggle'

  return (
    <div className="page">
      <div className="card">
        <header className="topbar">
          <div className="title">Snake</div>
          <div className="scores">
            <div className="pill">Score: <b>{score}</b></div>
            <div className="pill">Best: <b>{best}</b></div>
          </div>
        </header>

        <div className="hud">
          <div className="hint">Move: ↑↓←→ / WASD</div>
          <div className="hint">Start: Enter · Pause: Space/P · Restart: R</div>
          <div className="status">{statusText}</div>
          <div className="btns">
            <button className="btn" onClick={() => (gameOver ? reset() : start())} disabled={running && !gameOver}>
              {gameOver ? 'Restart' : 'Start'}
            </button>
            <button className="btn" onClick={togglePause} disabled={gameOver}>
              {running ? 'Pause' : 'Resume'}
            </button>
            <button className="btn btn-ghost" onClick={reset}>
              Reset
            </button>
          </div>
        </div>

        <div
          className="board"
          style={{
            gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
            gridTemplateRows: `repeat(${ROWS}, ${CELL}px)`,
          }}
          role="application"
          aria-label="Snake board"
        >
          {Array.from({ length: ROWS * COLS }).map((_, idx) => {
            const x = idx % COLS
            const y = Math.floor(idx / COLS)
            const k = `${x},${y}`
            const isFood = food.x === x && food.y === y
            const isHead = snake[0].x === x && snake[0].y === y
            const isBody = occupied.has(k)
            const cls = isFood
              ? 'cell food'
              : isHead
                ? 'cell head'
                : isBody
                  ? 'cell body'
                  : 'cell'
            return <div key={k} className={cls} />
          })}
        </div>

        <footer className="footer">
          <span>Wrap-around walls · Self-collision ends the game</span>
        </footer>
      </div>
    </div>
  )
}
