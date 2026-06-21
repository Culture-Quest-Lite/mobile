export type LoginFormValues = {
  password: string;
  username: string;
};

export type LoginFieldErrors = {
  password?: string;
  username?: string;
};

export type RegisterFormValues = {
  confirmPassword: string;
  displayName: string;
  email: string;
  password: string;
  username: string;
};

export type RegisterFieldErrors = {
  confirmPassword?: string;
  displayName?: string;
  email?: string;
  password?: string;
  username?: string;
};

export type VerifyOtpFormValues = {
  email: string;
  otpCode: string;
};

export type VerifyOtpFieldErrors = {
  email?: string;
  otpCode?: string;
};

const usernamePattern = /^[A-Za-z0-9._-]+$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isBlank(value: string) {
  return value.trim().length === 0;
}

export function hasAnyFieldError(errors: Record<string, string | undefined>) {
  return Object.values(errors).some((value) => typeof value === "string" && value.length > 0);
}

export function validateLoginForm({
  password,
  username,
}: LoginFormValues): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const normalizedUsername = username.trim();

  if (!normalizedUsername) {
    errors.username = "Vui lòng nhập username.";
  } else if (/\s/.test(normalizedUsername)) {
    errors.username = "Username không được chứa khoảng trắng.";
  }

  if (isBlank(password)) {
    errors.password = "Vui lòng nhập mật khẩu.";
  }

  return errors;
}

export function validateRegisterForm({
  confirmPassword,
  displayName,
  email,
  password,
  username,
}: RegisterFormValues): RegisterFieldErrors {
  const errors: RegisterFieldErrors = {};
  const normalizedUsername = username.trim();
  const normalizedDisplayName = displayName.trim();
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedUsername) {
    errors.username = "Vui lòng nhập username.";
  } else if (normalizedUsername.length < 3) {
    errors.username = "Username cần ít nhất 3 ký tự.";
  } else if (normalizedUsername.length > 30) {
    errors.username = "Username tối đa 30 ký tự.";
  } else if (!usernamePattern.test(normalizedUsername)) {
    errors.username = "Username chỉ được gồm chữ, số, dấu chấm, gạch dưới hoặc gạch ngang.";
  }

  if (!normalizedDisplayName) {
    errors.displayName = "Vui lòng nhập tên hiển thị.";
  } else if (normalizedDisplayName.length < 2) {
    errors.displayName = "Tên hiển thị cần ít nhất 2 ký tự.";
  } else if (normalizedDisplayName.length > 50) {
    errors.displayName = "Tên hiển thị tối đa 50 ký tự.";
  }

  if (!normalizedEmail) {
    errors.email = "Vui lòng nhập email.";
  } else if (!emailPattern.test(normalizedEmail)) {
    errors.email = "Email không đúng định dạng.";
  }

  if (isBlank(password)) {
    errors.password = "Vui lòng nhập mật khẩu.";
  } else if (password.length < 6) {
    errors.password = "Mật khẩu cần ít nhất 6 ký tự.";
  }

  if (isBlank(confirmPassword)) {
    errors.confirmPassword = "Vui lòng nhập lại mật khẩu.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Mật khẩu nhập lại không khớp.";
  }

  return errors;
}

export function validateVerifyOtpForm({
  email,
  otpCode,
}: VerifyOtpFormValues): VerifyOtpFieldErrors {
  const errors: VerifyOtpFieldErrors = {};
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedOtpCode = otpCode.trim();

  if (!normalizedEmail) {
    errors.email = "Thiếu email để xác thực OTP.";
  } else if (!emailPattern.test(normalizedEmail)) {
    errors.email = "Email nhận OTP không hợp lệ.";
  }

  if (!normalizedOtpCode) {
    errors.otpCode = "Vui lòng nhập mã OTP.";
  } else if (!/^\d{6}$/.test(normalizedOtpCode)) {
    errors.otpCode = "Vui lòng nhập đầy đủ 6 số OTP.";
  }

  return errors;
}
