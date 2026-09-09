import { useEffect, useState } from "react";

interface EmailCaptureModalProps {
  onClose: () => void;
  onSubmit: (email: string) => Promise<void>;
}

export function EmailCaptureModal({ onClose, onSubmit }: EmailCaptureModalProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [onClose, submitting]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || submitted) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(email);
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No pudimos guardar tu email. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleBackdropClick(event: React.MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget && !submitting) onClose();
  }

  return (
    <div className="modal-backdrop email-capture-backdrop" onMouseDown={handleBackdropClick}>
      <section className="email-capture-modal" role="dialog" aria-modal="true" aria-labelledby="email-capture-title">
        <button className="modal-close email-capture-close" type="button" onClick={onClose} disabled={submitting} aria-label="Cerrar"><span className="email-capture-close-icon" aria-hidden="true" /></button>
        {submitted ? (
          <div className="email-capture-success">
            <span className="email-capture-icon" aria-hidden="true">✓</span>
            <span className="section-kicker">Listo</span>
            <h2 id="email-capture-title">Te avisamos cuando haya novedades</h2>
            <p>Guardamos tu email. Gracias por ayudarnos a construir una mejor forma de seguir precios.</p>
            <button className="button button-primary" type="button" onClick={onClose}>Seguir explorando <span aria-hidden="true">→</span></button>
          </div>
        ) : (
          <>
            <span className="section-kicker">Una invitación para vos</span>
            <h2 id="email-capture-title">¿Te está sirviendo Cuánto?</h2>
            <p className="email-capture-copy">Si te ayuda a comparar precios, dejanos tu email y te avisamos cuando estén disponibles las alertas de tus productos favoritos, además de compartirte novedades útiles para comprar mejor.</p>
            {error && <div className="inline-alert" role="alert">{error}</div>}
            <form className="email-capture-form" onSubmit={handleSubmit}>
              <label htmlFor="email-capture-input">Tu email</label>
              <input id="email-capture-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="vos@ejemplo.com" autoComplete="email" autoFocus required maxLength={320} disabled={submitting} />
              <button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Guardando..." : "Quiero enterarme"} <span aria-hidden="true">→</span></button>
            </form>
            <button className="email-capture-later" type="button" onClick={onClose} disabled={submitting}>Ahora no, gracias</button>
          </>
        )}
      </section>
    </div>
  );
}
