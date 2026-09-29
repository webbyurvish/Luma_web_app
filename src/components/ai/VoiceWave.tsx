import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'

interface VoiceWaveProps {
  /** true once the recognizer is listening; while false the wave idles (connecting). */
  live: boolean
  className?: string
}

const POINTS = 56
const WIDTH = 280
const HEIGHT = 36

/**
 * The zig-zag voice trace shown while dictating. Peaks follow the real microphone level
 * (a Web Audio analyser on its own stream), so it jumps when you speak and settles to a small
 * ripple in pauses. Drawn by writing the SVG path directly each frame — no React re-renders.
 */
export function VoiceWave({ live, className }: VoiceWaveProps) {
  const pathRef = useRef<SVGPathElement>(null)
  const glowRef = useRef<SVGPathElement>(null)
  const liveRef = useRef(live)
  useEffect(() => {
    liveRef.current = live
  }, [live])

  useEffect(() => {
    let frame = 0
    let stream: MediaStream | null = null
    let audio: AudioContext | null = null
    let analyser: AnalyserNode | null = null
    let bins: Uint8Array<ArrayBuffer> | null = null
    let cancelled = false
    const smoothed = new Float32Array(POINTS)

    navigator.mediaDevices
      ?.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream = s
        audio = new AudioContext()
        analyser = audio.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.55
        audio.createMediaStreamSource(s).connect(analyser)
        bins = new Uint8Array(analyser.frequencyBinCount)
      })
      .catch(() => {
        // No level meter (permission pending/blocked) — the wave keeps its idle ripple.
      })

    const draw = (time: number) => {
      if (analyser && bins) analyser.getByteFrequencyData(bins)
      const mid = HEIGHT / 2
      let d = ''
      for (let i = 0; i < POINTS; i++) {
        // Voice energy sits in the low bins; spread them across the width, tapered at both ends.
        const bin = bins ? bins[Math.min(bins.length - 1, 2 + Math.floor((i / POINTS) * 48))] / 255 : 0
        const taper = Math.sin((Math.PI * (i + 0.5)) / POINTS)
        const idle = 0.07 + 0.05 * Math.sin(time / 260 + i * 0.9)
        const target = liveRef.current ? Math.max(idle, bin * 1.35) : idle
        smoothed[i] += (target - smoothed[i]) * 0.35
        const amp = Math.min(1, smoothed[i]) * taper * (mid - 2)
        const x = (i / (POINTS - 1)) * WIDTH
        const y = mid + (i % 2 === 0 ? -amp : amp) // alternate up/down — the zig-zag
        d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
      }
      pathRef.current?.setAttribute('d', d)
      glowRef.current?.setAttribute('d', d)
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
      void audio?.close()
    }
  }, [])

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" className={cn('h-9 w-full', className)} aria-hidden="true">
      <path ref={glowRef} fill="none" stroke="var(--color-rust)" strokeOpacity="0.18" strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <path ref={pathRef} fill="none" stroke="var(--color-rust)" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
