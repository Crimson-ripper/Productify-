import { useRef, useState } from "react";
import { api, getErrorMessage } from "@/lib/api";
import { track } from "@/lib/analytics";

// Shared form for the renter waitlist and provider application (ROADMAP Task 4).
// fields: [{ name, label, type: "text"|"email"|"select"|"textarea", required, options, hint, half }]
export default function LeadForm({ fields, endpoint, submitEvent, formName, submitLabel, consentText, onSuccess }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, f.default ?? ""])));
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState("idle"); // idle | sending | error
  const [serverError, setServerError] = useState("");
  const honeypot = useRef(null);

  const set = (name) => (e) => setValues((v) => ({ ...v, [name]: e.target.value }));

  const validate = () => {
    const errs = {};
    for (const f of fields) {
      const v = String(values[f.name] || "").trim();
      if (f.required && !v) errs[f.name] = f.type === "select" ? "Please choose an option." : "This field is required.";
      else if (f.type === "email" && v && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(v)) errs[f.name] = "Please enter a valid email address.";
    }
    if (!consent) errs.consent = "Please tick the box to continue.";
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      track("form_error", { form: formName, reason: "validation" });
      document.getElementById(`lf-${Object.keys(errs)[0]}`)?.focus();
      return;
    }
    track(submitEvent, { form: formName });
    setStatus("sending");
    setServerError("");
    try {
      await api.post(endpoint, { ...values, consent, website: honeypot.current?.value || "" });
      track("form_success", { form: formName });
      onSuccess();
    } catch (err) {
      setStatus("error");
      setServerError(getErrorMessage(err, "Something went wrong. Please try again."));
      track("form_error", { form: formName, reason: err?.response?.status || "network" });
    }
  };

  return (
    <form className="lead-form" onSubmit={submit} noValidate>
      {fields.map((f) => {
        const id = `lf-${f.name}`;
        const err = errors[f.name];
        const common = {
          id, name: f.name, value: values[f.name], onChange: set(f.name),
          "aria-invalid": err ? "true" : undefined,
          "aria-describedby": [f.hint && `${id}-hint`, err && `${id}-err`].filter(Boolean).join(" ") || undefined,
          required: f.required || undefined,
        };
        return (
          <div className={f.half ? "lf-field half" : "lf-field"} key={f.name}>
            <label htmlFor={id}>{f.label}{!f.required && <span className="lf-opt"> (optional)</span>}</label>
            {f.type === "select" ? (
              <select {...common}>
                <option value="">Choose…</option>
                {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ) : f.type === "textarea" ? (
              <textarea rows={3} maxLength={f.max || 1000} {...common} />
            ) : (
              <input type={f.type || "text"} maxLength={f.max || 200} autoComplete={f.autoComplete} {...common} />
            )}
            {f.hint && <small id={`${id}-hint`} className="lf-hint">{f.hint}</small>}
            {err && <small id={`${id}-err`} className="lf-err">{err}</small>}
          </div>
        );
      })}

      <div className="lf-hp" aria-hidden="true">
        <label htmlFor="lf-website">Leave this empty</label>
        <input id="lf-website" ref={honeypot} tabIndex={-1} autoComplete="off" />
      </div>

      <div className="lf-field lf-consent">
        <label>
          <input id="lf-consent" type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-invalid={errors.consent ? "true" : undefined} />
          <span>{consentText}</span>
        </label>
        {errors.consent && <small className="lf-err">{errors.consent}</small>}
      </div>

      {status === "error" && <p className="lf-server-err" role="alert">{serverError}</p>}
      <button type="submit" className="primary-button" disabled={status === "sending"}>
        {status === "sending" ? "Sending…" : submitLabel}
      </button>
    </form>
  );
}
