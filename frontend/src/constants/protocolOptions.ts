export const SUBMISSION_TYPE_OPTIONS = [
  "INITIAL",
  "RESUBMISSION",
  "AMENDMENT",
  "CONTINUING_REVIEW",
  "FINAL_REPORT",
  "WITHDRAWAL",
  "SAFETY_REPORT",
  "PROTOCOL_DEVIATION",
  "EARLY_TERMINATION",
] as const;

export const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  INITIAL: "Initial",
  RESUBMISSION: "Resubmission",
  AMENDMENT: "Amendment",
  CONTINUING_REVIEW: "Continuing Review",
  FINAL_REPORT: "Final Report",
  WITHDRAWAL: "Withdrawal",
  SAFETY_REPORT: "Safety Report",
  PROTOCOL_DEVIATION: "Deviation",
  EARLY_TERMINATION: "Early Termination",
};

export const COLLEGE_OPTIONS = [
  "BAGCED",
  "CCS",
  "CLA",
  "COS",
  "GCOE",
  "RVRCOB",
  "OTHERS",
] as const;

export const OTHER_COLLEGE_OPTIONS = [
  "CPS",
  "ODEL",
  "AdRIC",
  "CENSER",
  "CLT-SOE",
  "IBEHT",
  "School of Innovation and Sustainability",
] as const;

export const DEPARTMENT_OPTIONS_BY_COLLEGE: Record<string, readonly string[]> = {
  BAGCED: [
    "Counseling and Educational Psychology",
    "Educational Leadership and Management",
    "English and Applied Linguistics",
    "Physical Education",
    "Science Education",
  ],
  CCS: [
    "Computer Technology",
    "Information Technology",
    "Software Technology",
  ],
  CLA: [
    "Behavioral Sciences",
    "Communication",
    "Filipino",
    "History",
    "International Studies",
    "Literature",
    "Philosophy",
    "Political Science and Development Studies",
    "Psychology",
    "Theology and Religious Education",
  ],
  COS: [
    "Biology",
    "Chemistry",
    "Mathematics and Statistics",
    "Physics",
  ],
  GCOE: [
    "Chemical Engineering",
    "Civil Engineering",
    "Electronics and Computer Engineering",
    "Industrial and Systems Engineering",
    "Manufacturing Engineering and Management",
    "Mechanical Engineering",
  ],
  RVRCOB: [
    "Accountancy",
    "Commercial Law",
    "Decision Sciences and Innovation",
    "Financial Management",
    "Management and Organization",
    "Marketing and Advertising",
  ],
  OTHERS: OTHER_COLLEGE_OPTIONS,
};

export const getSubmissionTypeLabel = (value: string) =>
  SUBMISSION_TYPE_LABELS[value] ??
  value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getDepartmentOptionsForCollege = (college: string) =>
  DEPARTMENT_OPTIONS_BY_COLLEGE[college] ?? [];
