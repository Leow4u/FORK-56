import { KeyboardEvent, useEffect, useRef } from 'react'
import {
  EMAIL_OTP_LENGTH,
  applyEmailOtpBackspace,
  applyEmailOtpInput,
  emailOtpDigits,
  isCompleteEmailOtp,
  normalizeEmailOtp,
} from '../lib/login-email-code'
import styles from '../pages/LoginPage.module.css'

interface EmailCodeBoxesProps {
  value: string
  disabled?: boolean
  labelledBy?: string
  onChange: (code: string) => void
  onComplete?: (code: string) => void
}

export function EmailCodeBoxes({
  value,
  disabled = false,
  labelledBy,
  onChange,
  onComplete,
}: EmailCodeBoxesProps) {
  const digits = emailOtpDigits(value)
  const refs = useRef<Array<HTMLInputElement | null>>([])

  useEffect(() => {
    refs.current[0]?.focus()
  }, [])

  function commit(next: string, focus: number) {
    const code = normalizeEmailOtp(next)
    onChange(code)
    refs.current[focus]?.focus()
    if (isCompleteEmailOtp(code)) {
      onComplete?.(code)
    }
  }

  function onBoxInput(index: number, incoming: string) {
    const next = applyEmailOtpInput(value, index, incoming)
    const pasted = normalizeEmailOtp(incoming).length > 1
    const focus = pasted
      ? Math.min(next.length, EMAIL_OTP_LENGTH - 1)
      : incoming && index < EMAIL_OTP_LENGTH - 1
        ? index + 1
        : index
    commit(next, focus)
  }

  function onBoxKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Backspace') {
      return
    }
    event.preventDefault()
    const result = applyEmailOtpBackspace(value, index)
    commit(result.code, result.focus)
  }

  return (
    <div
      className={styles.codeBoxes}
      role="group"
      aria-labelledby={labelledBy}
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node
          }}
          className={styles.codeBox}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={index === 0 ? EMAIL_OTP_LENGTH : 1}
          disabled={disabled}
          aria-label={`Dígito ${index + 1} de ${EMAIL_OTP_LENGTH}`}
          onChange={(event) => onBoxInput(index, event.target.value)}
          onKeyDown={(event) => onBoxKeyDown(index, event)}
          onFocus={(event) => event.currentTarget.select()}
        />
      ))}
    </div>
  )
}
