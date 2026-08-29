import type { SVGProps } from "react";

/**
 * The page's whole icon set, hand-written.
 *
 * An icon package would be a client-side dependency and a barrel import for
 * eleven glyphs that never change. These are line icons at the 1.75px stroke
 * the system asks for, drawn in `currentColor` so a parent decides whether
 * they are Ink Navy, Signal Blue, or Mist Gray.
 */

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export function BranchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="3" y="9.5" width="6" height="5" rx="1.5" />
      <rect x="15" y="3" width="6" height="5" rx="1.5" />
      <rect x="15" y="16" width="6" height="5" rx="1.5" />
      <path d="M9 12h3a1 1 0 0 0 1-1V6.5a1 1 0 0 1 1-1h1" />
      <path d="M9 12h3a1 1 0 0 1 1 1v4.5a1 1 0 0 0 1 1h1" />
    </Icon>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" />
      <path d="M18 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z" />
    </Icon>
  );
}

export function NoteIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3h7.6L19 7.9v11.6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19.5v-15Z" />
      <path d="M14 3v5h5" />
      <path d="M8.5 12.5h7M8.5 16h4.5" />
    </Icon>
  );
}

export function PlugIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 3v5M15 3v5" />
      <path d="M6.5 8h11v3.5a5.5 5.5 0 0 1-11 0V8Z" />
      <path d="M12 17v4" />
    </Icon>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4.5" y="10" width="15" height="10.5" rx="2" />
      <path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
    </Icon>
  );
}

export function HistoryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1" />
      <path d="M3.5 4.5V10H9" />
      <path d="M12 8v4.3l3 1.8" />
    </Icon>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M10 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5" />
      <path d="M14 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5" />
    </Icon>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </Icon>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 9.5l6 6 6-6" />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12.5l5 5 10-11" />
    </Icon>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  );
}

export function GitHubIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M12 1.8a10.2 10.2 0 0 0-3.23 19.88c.51.1.7-.22.7-.49l-.01-1.9c-2.6.53-3.19-1.1-3.19-1.1-.44-1.06-1.07-1.35-1.07-1.35-.87-.57.07-.56.07-.56.96.07 1.47 1 1.47 1 .86 1.44 2.25 1.02 2.8.78.08-.6.33-1.02.6-1.25-2.08-.23-4.26-1.02-4.26-4.55 0-1 .36-1.83.95-2.47-.1-.23-.42-1.17.09-2.44 0 0 .78-.25 2.55.94a8.9 8.9 0 0 1 4.65 0c1.77-1.19 2.55-.94 2.55-.94.51 1.27.19 2.21.1 2.44.59.64.94 1.46.94 2.47 0 3.54-2.18 4.31-4.26 4.54.34.29.64.85.64 1.72l-.01 2.55c0 .27.19.6.71.49A10.2 10.2 0 0 0 12 1.8Z" />
    </svg>
  );
}
