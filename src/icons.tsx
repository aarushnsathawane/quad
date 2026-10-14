import type { SVGProps } from 'react';
type Props = SVGProps<SVGSVGElement> & { size?: number };
const icon =
  (paths: React.ReactNode) =>
  ({ size = 24, ...props }: Props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.65}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {paths}
    </svg>
  );
export const X = icon(<path d="m6 6 12 12M6 18 18 6" />);
export const Plus = icon(<path d="M12 5v14M5 12h14" />);
export const Minus = icon(<path d="M5 12h14" />);
export const Check = icon(<path d="m5 12 4 4L19 6" />);
export const CheckCheck = icon(
  <>
    <path d="m2 12 4 4L16 6m-4 9 2 2 9-10" />
  </>,
);
export const ArrowRight = icon(<path d="M4 12h16m-6-6 6 6-6 6" />);
export const ArrowLeft = icon(<path d="M20 12H4m6-6-6 6 6 6" />);
export const ChevronDown = icon(<path d="m6 9 6 6 6-6" />);
export const ArrowDownUp = icon(<path d="M7 4v16m-4-4 4 4 4-4M17 20V4m-4 4 4-4 4 4" />);
export const MapPin = icon(
  <>
    <path d="M19 10c0 6-7 11-7 11S5 16 5 10a7 7 0 0 1 14 0Z" />
    <circle cx="12" cy="10" r="2.4" />
  </>,
);
export const Compass = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="m16 8-3 5-5 3 3-5 5-3Z" />
  </>,
);
export const Users = icon(
  <>
    <circle cx="9" cy="8" r="3" />
    <path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v3" />
  </>,
);
export const UserPlus = icon(
  <>
    <circle cx="8" cy="8" r="3" />
    <path d="M2 21v-3a6 6 0 0 1 12 0v3m4-14v8m-4-4h8" />
  </>,
);
export const GraduationCap = icon(
  <>
    <path d="m2 9 10-5 10 5-10 5L2 9Zm4 3v5q6 5 12 0v-5m4-3v8" />
  </>,
);
export const Sparkles = icon(
  <>
    <path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Zm8-2v5m-2.5-2.5h5" />
  </>,
);
export const Leaf = icon(
  <>
    <path d="M20 3C5 1 0 13 6 18s17 0 14-15Z" />
    <path d="M3 22 15 10m-8 8v-6m0 6h6" />
  </>,
);
export const Ghost = icon(
  <>
    <path d="M4 21V10a8 8 0 0 1 16 0v11l-4-3-4 3-4-3-4 3Z" />
    <path d="M9 10v2m6-2v2" />
  </>,
);
export const Shield = icon(<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z" />);
export const ShieldCheck = icon(
  <>
    <path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z" />
    <path d="m8 11 3 3 5-5" />
  </>,
);
export const Info = icon(
  <>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6m0-10v.1" />
  </>,
);
export const Search = icon(
  <>
    <circle cx="10" cy="10" r="6" />
    <path d="m15 15 6 6" />
  </>,
);
export const LocateFixed = icon(
  <>
    <circle cx="12" cy="12" r="6" />
    <circle cx="12" cy="12" r="2" />
    <path d="M12 2v4m0 12v4M2 12h4m12 0h4" />
  </>,
);
export const SlidersHorizontal = icon(
  <>
    <path d="M3 6h6m4 0h8M3 12h12m4 0h2M3 18h2m4 0h12M9 3v6m6 0v6M5 15v6" />
  </>,
);
export const Settings2 = SlidersHorizontal;
export const Flag = icon(<path d="M4 22V3q4-3 8 0t8 0v10q-4 3-8 0t-8 0" />);
export const BriefcaseBusiness = icon(
  <>
    <rect x="3" y="7" width="18" height="14" rx="2" />
    <path d="M8 7V3h8v4M3 12q9 5 18 0m-9 1v4" />
  </>,
);
export const BookOpen = icon(
  <>
    <path d="M12 5q-5-3-10-1v15q5-2 10 1 5-3 10-1V4q-5-2-10 1v15" />
  </>,
);
export const HeartHandshake = icon(
  <>
    <path d="M12 6C5-2-5 9 12 21 29 9 19-2 12 6Z" />
    <path d="m12 6-4 4q0 3 3 1l2-1 5 6m-5-2 3 3m-6-1 3 3" />
  </>,
);
export const Instagram = icon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <path d="M17.5 6.5h.01" />
  </>,
);
export const Linkedin = icon(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <path d="M7 10v7m0-10v.1m5 10v-7m0 3q0-5 5-2v6" />
  </>,
);
export const ExternalLink = icon(
  <>
    <path d="M15 3h6v6m0-6L10 14M10 3H4v17h17v-6" />
  </>,
);
export const LoaderCircle = icon(<path d="M21 12a9 9 0 1 1-9-9" />);
