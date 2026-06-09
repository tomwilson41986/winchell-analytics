/** Shared loading / error states (same look as Historic Sales Analysis). */

export function Loading({ label }: { label: string }) {
  return (
    <div className="async">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="async async--error">
      <strong>Couldn’t load the data.</strong>
      <span>{message}</span>
    </div>
  )
}
