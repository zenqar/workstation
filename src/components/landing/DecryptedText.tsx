import { useEffect, useState, useRef, useMemo, useCallback, type CSSProperties } from 'react'
import { motion, type HTMLMotionProps } from 'motion/react'

const styles: Record<'wrapper' | 'srOnly', CSSProperties> = {
  wrapper: {
    display: 'inline-block',
    whiteSpace: 'pre-wrap'
  },
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    border: 0
  }
}

type RevealDirection = 'start' | 'end' | 'center'
type AnimateOn = 'hover' | 'view' | 'inViewHover' | 'click'
type ClickMode = 'once' | 'toggle'
type Direction = 'forward' | 'reverse'

type DecryptedTextProps = Omit<HTMLMotionProps<'span'>, 'children'> & {
  text: string
  speed?: number
  maxIterations?: number
  sequential?: boolean
  revealDirection?: RevealDirection
  useOriginalCharsOnly?: boolean
  characters?: string
  className?: string
  parentClassName?: string
  encryptedClassName?: string
  animateOn?: AnimateOn
  clickMode?: ClickMode
}

export default function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = 'start',
  useOriginalCharsOnly = false,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+',
  className = '',
  parentClassName = '',
  encryptedClassName = '',
  animateOn = 'hover',
  clickMode = 'once',
  ...props
}: DecryptedTextProps) {
  const [displayText, setDisplayText] = useState(text)
  const [isAnimating, setIsAnimating] = useState(false)
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set())
  const [hasAnimated, setHasAnimated] = useState(false)
  const [isDecrypted, setIsDecrypted] = useState(animateOn !== 'click')
  const [direction, setDirection] = useState<Direction>('forward')

  const containerRef = useRef<HTMLSpanElement>(null)
  const orderRef = useRef<number[]>([])
  const pointerRef = useRef(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAnimationInterval = useCallback(() => {
    if (intervalRef.current === null) return
    clearInterval(intervalRef.current)
    intervalRef.current = null
  }, [])

  const availableChars = useMemo(() => {
    return useOriginalCharsOnly
      ? Array.from(new Set(text.split(''))).filter(char => char !== ' ')
      : characters.split('')
  }, [useOriginalCharsOnly, text, characters])

  const shuffleText = useCallback(
    (originalText: string, currentRevealed: ReadonlySet<number>) => {
      return originalText
        .split('')
        .map((char, i) => {
          if (char === ' ') return ' '
          if (currentRevealed.has(i)) return originalText[i]
          return availableChars[Math.floor(Math.random() * availableChars.length)]
        })
        .join('')
    },
    [availableChars]
  )

  const computeOrder = useCallback(
    (len: number) => {
      const order: number[] = []
      if (len <= 0) return order
      if (revealDirection === 'start') {
        for (let i = 0; i < len; i++) order.push(i)
        return order
      }
      if (revealDirection === 'end') {
        for (let i = len - 1; i >= 0; i--) order.push(i)
        return order
      }
      const middle = Math.floor(len / 2)
      let offset = 0
      while (order.length < len) {
        if (offset % 2 === 0) {
          const idx = middle + offset / 2
          if (idx >= 0 && idx < len) order.push(idx)
        } else {
          const idx = middle - Math.ceil(offset / 2)
          if (idx >= 0 && idx < len) order.push(idx)
        }
        offset++
      }
      return order.slice(0, len)
    },
    [revealDirection]
  )

  const fillAllIndices = useCallback(() => {
    const s = new Set<number>()
    for (let i = 0; i < text.length; i++) s.add(i)
    return s
  }, [text])

  const removeRandomIndices = useCallback((set: ReadonlySet<number>, count: number) => {
    const arr = Array.from(set)
    for (let i = 0; i < count && arr.length > 0; i++) {
      const idx = Math.floor(Math.random() * arr.length)
      arr.splice(idx, 1)
    }
    return new Set(arr)
  }, [])

  const encryptInstantly = useCallback(() => {
    const emptySet = new Set<number>()
    setRevealedIndices(emptySet)
    setDisplayText(shuffleText(text, emptySet))
    setIsDecrypted(false)
  }, [text, shuffleText])

  const triggerDecrypt = useCallback(() => {
    if (sequential) {
      orderRef.current = computeOrder(text.length)
      pointerRef.current = 0
      setRevealedIndices(new Set<number>())
    } else {
      setRevealedIndices(new Set<number>())
    }
    setDirection('forward')
    setIsAnimating(true)
  }, [sequential, computeOrder, text.length])

  const triggerReverse = useCallback(() => {
    if (sequential) {
      orderRef.current = computeOrder(text.length).slice().reverse()
      pointerRef.current = 0
      setRevealedIndices(fillAllIndices())
      setDisplayText(shuffleText(text, fillAllIndices()))
    } else {
      setRevealedIndices(fillAllIndices())
      setDisplayText(shuffleText(text, fillAllIndices()))
    }
    setDirection('reverse')
    setIsAnimating(true)
  }, [sequential, computeOrder, fillAllIndices, shuffleText, text])

  useEffect(() => {
    if (!isAnimating) return

    let currentIteration = 0

    const getNextIndex = (revealedSet: ReadonlySet<number>) => {
      const textLength = text.length
      switch (revealDirection) {
        case 'start':
          return revealedSet.size
        case 'end':
          return textLength - 1 - revealedSet.size
        case 'center': {
          const middle = Math.floor(textLength / 2)
          const offset = Math.floor(revealedSet.size / 2)
          const nextIndex = revealedSet.size % 2 === 0 ? middle + offset : middle - offset - 1

          if (nextIndex >= 0 && nextIndex < textLength && !revealedSet.has(nextIndex)) {
            return nextIndex
          }

          for (let i = 0; i < textLength; i++) {
            if (!revealedSet.has(i)) return i
          }
          return 0
        }
        default:
          return revealedSet.size
      }
    }

    intervalRef.current = setInterval(() => {
      setRevealedIndices((prevRevealed) => {
        if (sequential) {
          if (direction === 'forward') {
            if (prevRevealed.size < text.length) {
              const nextIndex = getNextIndex(prevRevealed)
              const newRevealed = new Set(prevRevealed)
              newRevealed.add(nextIndex)
              setDisplayText(shuffleText(text, newRevealed))
              return newRevealed
            }
            clearAnimationInterval()
            setIsAnimating(false)
            setIsDecrypted(true)
            return prevRevealed
          }
          if (direction === 'reverse') {
            if (pointerRef.current < orderRef.current.length) {
              const idxToRemove = orderRef.current[pointerRef.current++]
              const newRevealed = new Set(prevRevealed)
              newRevealed.delete(idxToRemove)
              setDisplayText(shuffleText(text, newRevealed))
              if (newRevealed.size === 0) {
                clearAnimationInterval()
                setIsAnimating(false)
                setIsDecrypted(false)
              }
              return newRevealed
            }
            clearAnimationInterval()
            setIsAnimating(false)
            setIsDecrypted(false)
            return prevRevealed
          }
        } else {
          if (direction === 'forward') {
            setDisplayText(shuffleText(text, prevRevealed))
            currentIteration++
            if (currentIteration >= maxIterations) {
              clearAnimationInterval()
              setIsAnimating(false)
              setDisplayText(text)
              setIsDecrypted(true)
            }
            return prevRevealed
          }

          if (direction === 'reverse') {
            let currentSet = prevRevealed
            if (currentSet.size === 0) currentSet = fillAllIndices()
            const removeCount = Math.max(1, Math.ceil(text.length / Math.max(1, maxIterations)))
            const nextSet = removeRandomIndices(currentSet, removeCount)
            setDisplayText(shuffleText(text, nextSet))
            currentIteration++
            if (nextSet.size === 0 || currentIteration >= maxIterations) {
              clearAnimationInterval()
              setIsAnimating(false)
              setIsDecrypted(false)
              setDisplayText(shuffleText(text, new Set<number>()))
              return new Set<number>()
            }
            return nextSet
          }
        }
        return prevRevealed
      })
    }, speed)

    return clearAnimationInterval
  }, [
    isAnimating,
    text,
    speed,
    maxIterations,
    sequential,
    revealDirection,
    shuffleText,
    direction,
    fillAllIndices,
    removeRandomIndices,
    characters,
    useOriginalCharsOnly,
    clearAnimationInterval
  ])

  const handleClick = () => {
    if (animateOn !== 'click') return
    if (clickMode === 'once') {
      if (isDecrypted) return
      setDirection('forward')
      triggerDecrypt()
    }
    if (clickMode === 'toggle') {
      if (isDecrypted) triggerReverse()
      else {
        setDirection('forward')
        triggerDecrypt()
      }
    }
  }

  const triggerHoverDecrypt = useCallback(() => {
    if (isAnimating) return
    setRevealedIndices(new Set<number>())
    setIsDecrypted(false)
    setDisplayText(text)
    setDirection('forward')
    setIsAnimating(true)
  }, [isAnimating, text])

  const resetToPlainText = useCallback(() => {
    clearAnimationInterval()
    setIsAnimating(false)
    setRevealedIndices(new Set<number>())
    setDisplayText(text)
    setIsDecrypted(true)
    setDirection('forward')
  }, [text, clearAnimationInterval])

  useEffect(() => {
    if (animateOn !== 'view' && animateOn !== 'inViewHover') return
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !hasAnimated) {
          triggerDecrypt()
          setHasAnimated(true)
        }
      })
    }, { threshold: 0.1 })
    const currentRef = containerRef.current
    if (currentRef) observer.observe(currentRef)
    return () => { if (currentRef) observer.unobserve(currentRef) }
  }, [animateOn, hasAnimated, triggerDecrypt])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (animateOn === 'click') encryptInstantly()
      else {
        setDisplayText(text)
        setIsDecrypted(true)
      }
      setRevealedIndices(new Set<number>())
      setDirection('forward')
    }, 0)
    return () => window.clearTimeout(timeoutId)
  }, [animateOn, text, encryptInstantly])

  const animateProps =
    animateOn === 'hover' || animateOn === 'inViewHover'
      ? { onMouseEnter: triggerHoverDecrypt, onMouseLeave: resetToPlainText }
      : animateOn === 'click'
        ? { onClick: handleClick }
        : {}

  return (
    <motion.span className={parentClassName} ref={containerRef} style={styles.wrapper} {...animateProps} {...props}>
      <span style={styles.srOnly}>{displayText}</span>
      <span aria-hidden="true">
        {displayText.split('').map((char, index) => {
          const isRevealedOrDone = revealedIndices.has(index) || (!isAnimating && isDecrypted)
          return (
            <span key={index} className={isRevealedOrDone ? className : encryptedClassName}>
              {char}
            </span>
          )
        })}
      </span>
    </motion.span>
  )
}
