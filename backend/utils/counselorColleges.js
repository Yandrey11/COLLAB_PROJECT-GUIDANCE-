/** Allowed colleges for counselor accounts (BuKSU). */
export const COUNSELOR_COLLEGES = [
  "College of Public Administration and Governance",
  "College of Arts and Sciences",
  "College of Business",
  "College of Education",
  "College of Law",
  "College of Nursing",
  "College of Technologies",
];

export function isValidCollege(value) {
  return typeof value === "string" && COUNSELOR_COLLEGES.includes(value);
}
