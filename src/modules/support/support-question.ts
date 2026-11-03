// Pure rules for the questions people leave when the FAQ does not answer them.
// Keep the limits aligned with the checks in supabase/support-questions.sql.

export const SUPPORT_NAME_MAX = 80;
export const SUPPORT_QUESTION_MIN = 5;
export const SUPPORT_QUESTION_MAX = 1000;
const PHONE_MIN_DIGITS = 8;
const PHONE_MAX_DIGITS = 15;

export function phoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function supportQuestionProblem(name: string, phone: string, question: string): string | null {
  if (name.trim().length > SUPPORT_NAME_MAX) {
    return "El nombre es muy largo.";
  }
  const digits = phoneDigits(phone);
  if (!digits) {
    return "Escribí tu teléfono.";
  }
  if (digits.length < PHONE_MIN_DIGITS || digits.length > PHONE_MAX_DIGITS) {
    return "Revisá el teléfono: escribilo con el código de área.";
  }
  const cleanQuestion = question.trim();
  if (cleanQuestion.length < SUPPORT_QUESTION_MIN) {
    return "Escribí tu pregunta.";
  }
  if (cleanQuestion.length > SUPPORT_QUESTION_MAX) {
    return "La pregunta es muy larga.";
  }
  return null;
}

/** Drops the 15 written after an area code of 2, 3 or 4 digits. */
function withoutMobilePrefix(national: string): string {
  if (national.length !== 12) {
    return national;
  }
  for (const areaLength of [2, 3, 4]) {
    if (national.slice(areaLength, areaLength + 2) === "15") {
      return national.slice(0, areaLength) + national.slice(areaLength + 2);
    }
  }
  return national;
}

/**
 * The number WhatsApp expects: country code and digits only.
 * An Argentine mobile becomes 549 + area + number, without the 0 or the 15.
 * A number with another country code is kept as written. Null when it cannot tell.
 */
export function whatsappNumber(phone: string): string | null {
  const trimmed = phone.trim();
  let digits = phoneDigits(trimmed);
  const international = trimmed.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }
  if (digits.startsWith("54")) {
    let national = digits.slice(2);
    if (national.startsWith("9")) {
      national = national.slice(1);
    }
    national = withoutMobilePrefix(national.replace(/^0/, ""));
    return national.length === 10 ? `549${national}` : null;
  }
  if (international) {
    return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS ? digits : null;
  }
  const national = withoutMobilePrefix(digits.replace(/^0/, ""));
  return national.length === 10 ? `549${national}` : null;
}

export function whatsappLink(phone: string, text: string): string | null {
  const number = whatsappNumber(phone);
  if (!number) {
    return null;
  }
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}

export function whatsappGreeting(name: string): string {
  const clean = name.trim();
  return clean
    ? `Hola ${clean}, te escribimos de HippoPro por la pregunta que dejaste.`
    : "Hola, te escribimos de HippoPro por la pregunta que dejaste.";
}
