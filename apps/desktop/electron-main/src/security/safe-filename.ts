const SAFE_JOB_NAME = /^[A-Za-z0-9._-]+$/u;
const WINDOWS_RESERVED = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu;

export function isSafeJobName(value: string): boolean {
  return (
    value.length >= 1 &&
    value.length <= 120 &&
    value !== "." &&
    value !== ".." &&
    !value.endsWith(".") &&
    !value.endsWith(" ") &&
    SAFE_JOB_NAME.test(value) &&
    !WINDOWS_RESERVED.test(value)
  );
}

export function assertSafeJobName(value: string): void {
  if (!isSafeJobName(value)) throw new Error("DESKTOP-OUTPUT-001:unsafe_job_name");
}
