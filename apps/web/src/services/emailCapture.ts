import { supabase } from "../lib/supabase";
import { getOrCreateAnalyticsIdentity } from "./analytics";

export function normalizeCaptureEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidCaptureEmail(email: string): boolean {
  const normalizedEmail = normalizeCaptureEmail(email);
  return normalizedEmail.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
}

export async function captureEmail(email: string, triggerProductId: string): Promise<void> {
  const normalizedEmail = normalizeCaptureEmail(email);
  if (!isValidCaptureEmail(normalizedEmail)) throw new Error("Ingresá un email válido.");
  if (!supabase) throw new Error("Supabase no está configurado.");

  const identity = getOrCreateAnalyticsIdentity();
  const { error } = await supabase.rpc("capture_email_lead", {
    p_email: normalizedEmail,
    p_anon_id: identity.anonId,
    p_session_id: identity.sessionId,
    p_trigger_product_id: triggerProductId,
  });
  if (error) throw error;
}
