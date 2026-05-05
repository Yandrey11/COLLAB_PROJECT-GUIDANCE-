/** Allowed colleges for counselor accounts — keep in sync with backend/utils/counselorColleges.js */
export const COUNSELOR_COLLEGES = [
  "College of Public Administration and Governance",
  "College of Arts and Sciences",
  "College of Business",
  "College of Education",
  "College of Law",
  "College of Nursing",
  "College of Technologies",
];

/**
 * Circular avatar border on profile / header — keyed by exact `COUNSELOR_COLLEGES` strings.
 * Returns Tailwind classes, or null for default gray ring.
 */
const COLLEGE_AVATAR_RING = {
  "College of Arts and Sciences":
    "border-[3px] border-green-900 shadow-[0_0_0_1px_rgba(20,83,45,0.32)] dark:border-green-800 dark:shadow-[0_0_0_1px_rgba(22,101,52,0.45)]",
  "College of Nursing":
    "border-[3px] border-pink-500 shadow-[0_0_0_1px_rgba(219,39,119,0.25)] dark:border-pink-400 dark:shadow-[0_0_0_1px_rgba(244,114,182,0.35)]",
  "College of Technologies":
    "border-[3px] border-orange-500 shadow-[0_0_0_1px_rgba(234,88,12,0.25)] dark:border-orange-400 dark:shadow-[0_0_0_1px_rgba(251,146,60,0.35)]",
  "College of Education":
    "border-[3px] border-blue-900 shadow-[0_0_0_1px_rgba(30,58,138,0.35)] dark:border-blue-800 dark:shadow-[0_0_0_1px_rgba(37,99,235,0.45)]",
  "College of Public Administration and Governance":
    "border-[3px] border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.28)] dark:border-blue-400 dark:shadow-[0_0_0_1px_rgba(96,165,250,0.35)]",
  /** Yellow — tuned for visibility on light and dark surfaces */
  "College of Business":
    "border-[3px] border-yellow-500 shadow-[0_0_0_1px_rgba(234,179,8,0.35)] dark:border-yellow-400 dark:shadow-[0_0_0_1px_rgba(250,204,21,0.4)]",
};

export function getCounselorCollegeAvatarRingClass(college) {
  if (!college || typeof college !== "string") return null;
  return COLLEGE_AVATAR_RING[college.trim()] ?? null;
}
