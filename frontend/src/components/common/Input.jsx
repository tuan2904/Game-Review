import { useId } from "react";

/**
 * Labeled text input with an optional hint and an inline
 * validation/API error message.
 *
 * @param {Object} props
 * @param {string} props.label
 * @param {string} [props.error] error text rendered below the field
 * @param {string} [props.hint] optional helper text rendered below the field
 * @param {string} [props.type]
 */
export default function Input({ label, error, hint, type = "text", id, className = "", ...rest }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`field ${className}`.trim()}>
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <input
        id={inputId}
        className="field__input"
        type={type}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        {...rest}
      />
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
