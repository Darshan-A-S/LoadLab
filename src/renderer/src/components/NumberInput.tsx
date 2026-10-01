import React, { useEffect, useRef, useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

interface NumberInputProps {
  value: number | undefined
  onChange: (value: number | undefined) => void
  min?: number
  max?: number
  step?: number
  placeholder?: string
  disabled?: boolean
  className?: string
}

export default function NumberInput({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  placeholder,
  disabled = false,
  className = ''
}: NumberInputProps): JSX.Element {
  const [text, setText] = useState<string>(
    value !== undefined && !Number.isNaN(value) ? String(value) : ''
  )
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Keep internal text in sync with external value
  useEffect(() => {
    const nextText = value !== undefined && !Number.isNaN(value) ? String(value) : ''
    setText(nextText)
  }, [value])

  const stopRepeat = (): void => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => {
    return () => stopRepeat()
  }, [])

  const updateValue = (num: number | undefined): void => {
    if (num === undefined) {
      setText('')
      onChange(undefined)
      return
    }
    let clamped = num
    if (min !== undefined && clamped < min) clamped = min
    if (max !== undefined && clamped > max) clamped = max
    setText(String(clamped))
    onChange(clamped)
  }

  const stepUp = (delta: number = step): void => {
    const cur =
      value !== undefined && !Number.isNaN(value)
        ? value
        : min !== undefined
          ? min - delta
          : 0
    updateValue(cur + delta)
  }

  const stepDown = (delta: number = step): void => {
    const cur =
      value !== undefined && !Number.isNaN(value)
        ? value
        : min !== undefined
          ? min + delta
          : delta
    updateValue(cur - delta)
  }

  const handleMouseDown = (action: 'up' | 'down', e: React.MouseEvent): void => {
    e.preventDefault()
    if (disabled) return
    stopRepeat()
    if (action === 'up') stepUp()
    else stepDown()

    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        if (action === 'up') stepUp()
        else stepDown()
      }, 60)
    }, 350)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const raw = e.target.value
    // Allow empty string so the user can easily clear and type like a normal text field
    if (raw === '') {
      setText('')
      onChange(undefined)
      return
    }
    // Only accept numbers
    if (/^\d+$/.test(raw)) {
      // Remove leading zeros when typing multiple digits (e.g. "05" -> "5")
      const clean = raw.replace(/^0+(?=\d)/, '')
      setText(clean)
      const num = parseInt(clean, 10)
      if (!Number.isNaN(num)) {
        onChange(num)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (disabled) return
    const delta = e.shiftKey ? step * 10 : step
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      stepUp(delta)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      stepDown(delta)
    }
  }

  return (
    <div className={`number-input-wrapper ${className}`}>
      <input
        type="text"
        inputMode="numeric"
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
      <div className="number-steppers">
        <button
          type="button"
          tabIndex={-1}
          className="stepper-btn"
          disabled={disabled || (max !== undefined && value !== undefined && value >= max)}
          onMouseDown={(e) => handleMouseDown('up', e)}
          onMouseUp={stopRepeat}
          onMouseLeave={stopRepeat}
          title="Increment"
        >
          <ChevronUp size={11} strokeWidth={2.4} />
        </button>
        <button
          type="button"
          tabIndex={-1}
          className="stepper-btn"
          disabled={disabled || (min !== undefined && value !== undefined && value <= min)}
          onMouseDown={(e) => handleMouseDown('down', e)}
          onMouseUp={stopRepeat}
          onMouseLeave={stopRepeat}
          title="Decrement"
        >
          <ChevronDown size={11} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  )
}
