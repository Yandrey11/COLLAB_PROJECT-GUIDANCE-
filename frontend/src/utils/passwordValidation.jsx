/**
 * Google-Style Password Validation Utility
 * Comprehensive password strength validation with real-time feedback
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
  const lowerPassword = password.toLowerCase();
  return COMMON_PASSWORDS.some((common) => lowerPassword.includes(common));
};

/**
 * Check if password contains user's email or name (if provided)
 */
const containsPersonalInfo = (password, email = "", name = "") => {
  if (!password) return false;
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
    hint: "Password must be at least 8 characters.",
    test: (password = "") => typeof password === "string" && password.length >= 8,
  },
  {
    id: "uppercase",
    label: "One uppercase letter",
    hint: "Add uppercase letters to make your password stronger.",
    test: (password = "") => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "One lowercase letter",
    hint: "Add lowercase letters to make your password stronger.",
    test: (password = "") => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "One number",
    hint: "Add numbers to make your password stronger.",
    test: (password = "") => /[0-9]/.test(password),
  },
  {
    id: "special",
    label: "One special character",
    hint: "Add symbols to make your password stronger.",
    test: (password = "") => /[!@#$%^&*()\-_=+{}[\]\\|:;"'<>,.?/`~]/.test(password),
  },
  {
    id: "noSpaces",
    label: "No spaces",
    hint: "Password cannot contain spaces.",
    test: (password = "") => {
      if (!password) return true;
      return !password.includes(" ");
    },
  },
  {
    id: "notCommon",
    label: "Not a common password",
    hint: "Avoid using common or easily guessed passwords.",
    test: (password = "") => !isCommonPassword(password),
  },
];

/**
 * Validate password with Google-style feedback
 * @param {string} password - The password to validate
 * @param {object} options - Optional validation options
 * @param {string} options.email - User's email (to check for personal info)
 * @param {string} options.name - User's name (to check for personal info)
 * @returns {object} Validation result with errors, hints, strength, etc.
 */
export function validatePassword(password = "", options = {}) {
  const { email = "", name = "" } = options;
  
  // Trim password for validation (but check if original has leading/trailing spaces)
  const trimmedPassword = typeof password === "string" ? password.trim() : "";
  const hasLeadingTrailingSpaces = password && password !== trimmedPassword;
  
  // Test all rules
  const results = PASSWORD_RULES.map((rule) => {
    let passed = false;
    
    if (rule.id === "noSpaces") {
      passed = !password.includes(" ");
    } else {
      passed = rule.test(trimmedPassword);
    }
    
    return {
      id: rule.id,
      label: rule.label,
      hint: rule.hint,
      passed,
    };
  });

  // Check for personal information
  const hasPersonalInfo = containsPersonalInfo(trimmedPassword, email, name);
  
  // Collect errors and hints
  const errors = [];
  const hints = [];
  
  results.forEach((rule) => {
    if (!rule.passed) {
      errors.push(rule.hint || rule.label);
      hints.push(rule.hint);
    }
  });
  
  // Add personal info warning
  if (hasPersonalInfo) {
    hints.push("Avoid using your name or email in your password.");
  }

  // Calculate passed count (excluding noSpaces from strength calculation)
  const passedCount = results.filter((r) => r.passed && r.id !== "noSpaces").length;

  // Calculate strength (Google-style)
  let strength = "Weak";
  let strengthScore = 0;
  
  if (trimmedPassword.length >= 8) strengthScore += 1;
  if (/[A-Z]/.test(trimmedPassword)) strengthScore += 1;
  if (/[a-z]/.test(trimmedPassword)) strengthScore += 1;
  if (/[0-9]/.test(trimmedPassword)) strengthScore += 1;
  if (/[!@#$%^&*()\-_=+{}[\]\\|:;"'<>,.?/`~]/.test(trimmedPassword)) strengthScore += 1;
  if (trimmedPassword.length >= 12) strengthScore += 1;
  if (!isCommonPassword(trimmedPassword)) strengthScore += 1;
  
  // Determine strength based on score
  if (strengthScore >= 6 && trimmedPassword.length >= 12 && passedCount >= 5) {
    strength = "Strong";
  } else if (strengthScore >= 4 && trimmedPassword.length >= 8 && passedCount >= 4) {
    strength = "Medium";
  } else {
    strength = "Weak";
  }
  
  // Acceptance policy: reject weak; accept medium/strong with core safeguards.
  const isValid = 
    strength !== "Weak" &&
    !isCommonPassword(trimmedPassword) && 
    !password.includes(" ") &&
    trimmedPassword.length >= 8;

  return {
    isValid,
    errors,
    hints,
    rules: results,
    strength,
    strengthScore,
    hasPersonalInfo,
    hasLeadingTrailingSpaces,
  };
}

/**
 * Get Google-style error message for a specific validation failure
 * @param {string} password - The password to validate
 * @returns {string} Helpful error message
 */
export function getPasswordErrorMessage(password = "") {
  const validation = validatePassword(password);
  
  if (validation.isValid) {
    return "";
  }
  
  // Return the first error hint
  if (validation.hints.length > 0) {
    return validation.hints[0];
  }
  
  return "Password does not meet the requirements.";
}

export default validatePassword;
