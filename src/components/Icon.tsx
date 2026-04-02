interface IconProps {
  name:
    | "spark"
    | "gpu"
    | "cpu"
    | "shield"
    | "route"
    | "wallet"
    | "terminal"
    | "folder"
    | "chip"
    | "pulse"
    | "play";
  className?: string;
}

export function Icon({ name, className }: IconProps) {
  const commonProps = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true
  };

  switch (name) {
    case "spark":
      return (
        <svg {...commonProps}>
          <path d="m12 2 1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8Z" />
        </svg>
      );
    case "gpu":
      return (
        <svg {...commonProps}>
          <rect x="3" y="7" width="18" height="10" rx="2" />
          <path d="M7 10h6M7 14h3M19 10v4M3 12H1M23 12h-2" />
        </svg>
      );
    case "cpu":
      return (
        <svg {...commonProps}>
          <rect x="7" y="7" width="10" height="10" rx="2" />
          <path d="M10 10h4v4h-4zM9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
        </svg>
      );
    case "shield":
      return (
        <svg {...commonProps}>
          <path d="M12 3 5 6v5c0 4.2 2.5 8 7 10 4.5-2 7-5.8 7-10V6z" />
          <path d="m9.5 12 1.7 1.7 3.3-3.4" />
        </svg>
      );
    case "route":
      return (
        <svg {...commonProps}>
          <circle cx="6" cy="18" r="2" />
          <circle cx="18" cy="6" r="2" />
          <path d="M8 18h4a4 4 0 0 0 4-4V8" />
        </svg>
      );
    case "wallet":
      return (
        <svg {...commonProps}>
          <path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          <path d="M16 12h5M18 12h.01M3 9h16" />
        </svg>
      );
    case "terminal":
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m7 10 3 2-3 2M12 14h5" />
        </svg>
      );
    case "folder":
      return (
        <svg {...commonProps}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
        </svg>
      );
    case "chip":
      return (
        <svg {...commonProps}>
          <rect x="7" y="7" width="10" height="10" rx="2" />
          <path d="M12 7V4M12 20v-3M7 12H4M20 12h-3M8.5 8.5h7v7h-7z" />
        </svg>
      );
    case "pulse":
      return (
        <svg {...commonProps}>
          <path d="M3 12h4l2-5 4 10 2-5h6" />
        </svg>
      );
    case "play":
      return (
        <svg {...commonProps}>
          <path d="m8 6 10 6-10 6z" />
        </svg>
      );
    default:
      return null;
  }
}
