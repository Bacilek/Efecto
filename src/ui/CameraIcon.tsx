/** Video camera — marks a lesson that is recorded, so it needn't be attended. */
export function CameraIcon({ size = 10, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <rect x="1" y="4" width="10" height="8" rx="2" />
      <path d="M12 6.5 15.2 4.4v7.2L12 9.5z" />
    </svg>
  )
}
