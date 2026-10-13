/**
 * Accessible button with loading/disabled states.
 *
 * @param {Object} props
 * @param {"primary"|"secondary"|"danger"|"ghost"} [props.variant]
 * @param {boolean} [props.loading] disables the button and shows a spinner
 * @param {boolean} [props.disabled]
 * @param {"button"|"submit"|"reset"} [props.type]
 */
export default function Button({
  variant = "primary",
  loading = false,
  disabled = false,
  type = "button",
  children,
  className = "",
  ...rest
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      className={`btn btn--${variant} ${className}`.trim()}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      <span className={loading ? "btn__label btn__label--loading" : "btn__label"}>{children}</span>
    </button>
  );
}
