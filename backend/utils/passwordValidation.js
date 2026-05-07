/**
 * Google-Style Password Validation Utility (Backend)
 * Comprehensive password strength validation matching frontend rules
 */

// Common passwords that should be blocked
const COMMON_PASSWORDS = [
  "password",
  "password123",
  "password1",
  "12345678",
  "123456789",
  "1234567890",
  "qwerty",
  "qwerty123",
  "qwertyuiop",
  "abc123",
  "letmein",
  "welcome",
  "admin",
  "admin123",
  "monkey",
  "1234567",
  "iloveyou",
  "princess",
  "rockyou",
  "123qwe",
  "trustno1",
  "sunshine",
  "master",
  "hello",
  "freedom",
  "whatever",
  "qazwsx",
  "jordan23",
  "harley",
  "shadow",
  "superman",
  "michael",
  "baseball",
  "football",
  "batman",
];

/**
 * Check if password contains common/weak patterns
 */
const isCommonPassword = (password) => {
  if (!password || typeof password !== "string") return false;
  const lowerPassword = password.toLowerCase();
  return COMMON_PASSWORDS.some((common) => lowerPassword.includes(common));
};

/**
 * Check if password contains user's email or name (if provided)
 */
const containsPersonalInfo = (password, email = "", name = "") => {
  if (!password || typeof password !== "string") return false;
  const lowerPassword = password.toLowerCase();
  
  if (email) {
    const emailPart = email.split("@")[0].toLowerCase();
    if (emailPart.length > 3 && lowerPassword.includes(emailPart)) {
      return true;
    }
  }
  
  if (name) {
    const nameParts = name.toLowerCase().split(" ");
    return nameParts.some((part) => part.length > 2 && lowerPassword.includes(part));
  }
  
  return false;
};

/**
 * Google-Style Password Validation Rules
 */
export const PASSWORD_RULES = [
  {
    id: "minLength",
    label: "At least 8 characters",
    message: "Password must be at least 8 characters.",
    test: (password = "") => typeof password === "string" && password.length >= 8,
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    message: "Add uppercase letters to make your password stronger.",
    test: (password = "") => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    message: "Add lowercase letters to make your password stronger.",
    test: (password = "") => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    message: "Add numbers to make your password stronger.",
    test: (password = "") => /[0-9]/.test(password),
  },
  {
    id: "special",
    label: "One special character",
    message: "Add symbols to make your password stronger.",
    test: (password = "") => /[!@#$%^&*()\-_=+{}[\]\\|:;"'<>,.?/`~]/.test(password),
  },
  {
    id: "noSpaces",
    label: "No spaces",
    message: "Password cannot contain spaces.",
    test: (password = "") => {
      if (!password || typeof password !== "string") return true;
      return !password.includes(" ");
    },
  },
  {
    id: "notCommon",
    label: "Not a common password",
    message: "Avoid using common or easily guessed passwords.",
    test: (password = "") => !isCommonPassword(password),
  },
];

/**
 * Validate password with Google-style feedback (Backend)
 * @param {string} password - The password to validate
 * @param {object} options - Optional validation options
 * @param {string} options.email - User's email (to check for personal info)
 * @param {string} options.name - User's name (to check for personal info)
 * @returns {object} Validation result with isValid, errors, etc.
 */
export function validatePassword(password = "", options = {}) {
  const { email = "", name = "" } = options;
  
  if (!password || typeof password !== "string") {
    return {
      isValid: false,
      errors: ["Password is required."],
      details: [],
    };
  }
  
  // Trim password for validation (but check if original has leading/trailing spaces)
  const trimmedPassword = password.trim();
  const hasLeadingTrailingSpaces = password !== trimmedPassword;
  
  // Test all rules
  const details = PASSWORD_RULES.map((rule) => {
    let passed = false;
    
    if (rule.id === "noSpaces") {
      passed = !password.includes(" ");
    } else {
      passed = rule.test(trimmedPassword);
    }
    
    return {
      id: rule.id,
      label: rule.label,
      message: rule.message,
      passed,
    };
  });
  
  // Check for personal information
  const hasPersonalInfo = containsPersonalInfo(trimmedPassword, email, name);
  const isCommon = isCommonPassword(trimmedPassword);
  
  // Collect errors
  const errors = [];
  
  details.forEach((rule) => {
    if (!rule.passed) {
      errors.push(rule.message || rule.label);
    }
  });
  
  // Add personal info warning
  if (hasPersonalInfo) {
    errors.push("Avoid using your name or email in your password.");
  }
  
  // Acceptance policy: reject weak; accept medium/strong with core safeguards.
  let strengthScore = 0;
  if (trimmedPassword.length >= 8) strengthScore += 1;
  if (/[A-Z]/.test(trimmedPassword)) strengthScore += 1;
  if (/[a-z]/.test(trimmedPassword)) strengthScore += 1;
  if (/[0-9]/.test(trimmedPassword)) strengthScore += 1;
  if (/[!@#$%^&*()\-_=+{}[\]\\|:;"'<>,.?/`~]/.test(trimmedPassword)) strengthScore += 1;
  if (trimmedPassword.length >= 12) strengthScore += 1;
  if (!isCommonPassword(trimmedPassword)) strengthScore += 1;
  const passedCount = details.filter((r) => r.passed && r.id !== "noSpaces").length;
  const strength =
    strengthScore >= 6 && trimmedPassword.length >= 12 && passedCount >= 5
      ? "Strong"
      : strengthScore >= 4 && trimmedPassword.length >= 8 && passedCount >= 4
        ? "Medium"
        : "Weak";

  const isValid = 
    strength !== "Weak" &&
    !isCommon && 
    !password.includes(" ") &&
    trimmedPassword.length >= 8;

  return {
    isValid,
    errors,
    details,
    strength,
    strengthScore,
    hasPersonalInfo,
    isCommon,
    hasLeadingTrailingSpaces,
  };
}

export default validatePassword;
