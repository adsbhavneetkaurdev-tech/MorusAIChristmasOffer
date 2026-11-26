type P = { className?: string; size?: number };
const base = (size = 20) => ({ width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true });

export const ClockIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
);
export const CheckIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const SpeakerIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M16.5 8.5a5 5 0 010 7" /><path d="M19 6a8.5 8.5 0 010 12" /></svg>
);
export const SpeakerOffIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M4 9v6h4l5 4V5L8 9H4z" /><path d="M17 9l5 6M22 9l-5 6" /></svg>
);
export const CalendarIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><rect x="3.5" y="5" width="17" height="15" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg>
);
export const MailIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><rect x="3" y="5.5" width="18" height="13" rx="2" /><path d="M3.5 7l8.5 6 8.5-6" /></svg>
);
export const AlertIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></svg>
);
export const ArrowUpIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M12 19V5M6 11l6-6 6 6" /></svg>
);
export const ArrowDownIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M12 5v14M6 13l6 6 6-6" /></svg>
);
export const TrashIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>
);
export const PlusIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>
);
export const ExternalIcon = ({ className, size }: P) => (
  <svg {...base(size)} className={className}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" /></svg>
);
