import { useEffect, useRef } from 'react'

type Particle = {
  x: number
  y: number
  size: number
  speedY: number
  speedX: number
  color: string
  opacity: number
}

const COLORS = [
  'rgba(34, 197, 94, 0.4)',   // green-500
  'rgba(74, 222, 128, 0.35)', // green-400
  'rgba(52, 211, 153, 0.35)', // emerald-400
  'rgba(45, 212, 191, 0.3)',  // teal-400
  'rgba(56, 189, 248, 0.3)',  // sky-400
  'rgba(99, 102, 241, 0.35)', // indigo-500
  'rgba(139, 92, 246, 0.35)', // violet-500
  'rgba(168, 85, 247, 0.4)',  // purple-500
  'rgba(192, 132, 252, 0.3)', // purple-400
  'rgba(148, 163, 184, 0.25)', // slate-400
  'rgba(100, 116, 139, 0.2)', // slate-500
]

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min

const createParticle = (canvas: HTMLCanvasElement, startFromBottom = false): Particle => {
  const color = COLORS[Math.floor(Math.random() * COLORS.length)]
  return {
    x: randomBetween(0, canvas.width),
    y: startFromBottom ? canvas.height + randomBetween(10, 100) : randomBetween(0, canvas.height),
    size: randomBetween(1.5, 4),
    speedY: randomBetween(0.15, 0.6),
    speedX: randomBetween(-0.15, 0.15),
    color,
    opacity: randomBetween(0.3, 0.7),
  }
}

export const ParticleBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const particlesRef = useRef<Particle[]>([])
  const animationRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    resize()
    window.addEventListener('resize', resize)

    const particleCount = Math.min(Math.floor((canvas.width * canvas.height) / 8000), 180)
    particlesRef.current = Array.from({ length: particleCount }, () => createParticle(canvas))

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particlesRef.current.forEach((p, i) => {
        p.y -= p.speedY
        p.x += p.speedX

        if (p.y < -10) {
          particlesRef.current[i] = createParticle(canvas, true)
        }

        if (p.x < 0) p.x = canvas.width
        if (p.x > canvas.width) p.x = 0

        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.globalAlpha = p.opacity
        ctx.fill()
      })

      ctx.globalAlpha = 1
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 -z-10"
      aria-hidden="true"
    />
  )
}

