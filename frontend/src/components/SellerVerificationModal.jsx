import { useState } from "react";
import { X, ShieldCheck, Mail, Phone, KeyRound, AlertTriangle, ArrowRight, CheckCircle2, Copy, Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function SellerVerificationModal({ isOpen, onClose }) {
  const { user, sendSellerOtp, confirmSellerOtp, activateSeller, recoverSellerAccount } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("verify"); // "verify" | "recovery"
  
  // Verification states
  const [step, setStep] = useState(1); // 1: Email, 2: Phone, 3: Success & Recovery Key
  const [emailCode, setEmailCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailDebugCode, setEmailDebugCode] = useState("");

  const [phone, setPhone] = useState(user?.phone || "");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneDebugCode, setPhoneDebugCode] = useState("");

  const [recoveryKey, setRecoveryKey] = useState("");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Recovery states
  const [recoveryType, setRecoveryType] = useState("recovery_key"); // "recovery_key" | "password"
  const [recoveryProof, setRecoveryProof] = useState("");
  const [recoveryPassword, setRecoveryPassword] = useState("");
  const [newContactValue, setNewContactValue] = useState("");
  const [recoverySuccess, setRecoverySuccess] = useState(false);

  if (!isOpen) return null;

  // STEP 1: Email OTP
  const handleSendEmailOtp = async () => {
    setBusy(true); setErrorMsg("");
    try {
      const res = await sendSellerOtp("email", user?.email || "");
      setEmailSent(true);
      if (res.debug_code) setEmailDebugCode(res.debug_code);
      toast.success(`Verification code sent to ${user?.email}`);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || "Failed to send email verification code");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmEmailOtp = async (e) => {
    e.preventDefault();
    if (!emailCode.trim()) return;
    setBusy(true); setErrorMsg("");
    try {
      await confirmSellerOtp("email", user?.email || "", emailCode.trim());
      setEmailVerified(true);
      toast.success("Email verified successfully!");
      setStep(2);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || "Invalid verification code");
    } finally {
      setBusy(false);
    }
  };

  // STEP 2: Phone OTP (Strict 1:1 Check)
  const handleSendPhoneOtp = async () => {
    if (!phone.trim() || phone.trim().length < 8) {
      setErrorMsg("Please enter a valid phone number with country code (e.g. +1 555-0199 or +91 9876543210)");
      return;
    }
    setBusy(true); setErrorMsg("");
    try {
      const res = await sendSellerOtp("phone", phone.trim());
      setPhoneSent(true);
      if (res.debug_code) setPhoneDebugCode(res.debug_code);
      toast.success(`SMS verification code sent to ${phone.trim()}`);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || "Could not send phone verification code");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmPhoneOtp = async (e) => {
    e.preventDefault();
    if (!phoneCode.trim()) return;
    setBusy(true); setErrorMsg("");
    try {
      await confirmSellerOtp("phone", phone.trim(), phoneCode.trim());
      setPhoneVerified(true);
      toast.success("Phone number verified successfully!");
      
      // Now activate seller account
      const actRes = await activateSeller(phone.trim());
      setRecoveryKey(actRes.recovery_key || "PROD-SEC-SAVED-SAFELY");
      setStep(3);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || "Invalid verification code");
    } finally {
      setBusy(false);
    }
  };

  // Copy Recovery Key
  const copyKey = () => {
    if (!recoveryKey) return;
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    toast.success("Recovery key copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  // Finish and open studio
  const handleFinish = () => {
    onClose();
    navigate("/seller-studio");
  };

  // RECOVERY HANDLER
  const handleRecoverySubmit = async (e) => {
    e.preventDefault();
    setBusy(true); setErrorMsg("");
    try {
      await recoverSellerAccount({
        recovery_type: recoveryType,
        proof_code: recoveryProof.trim(),
        password: recoveryPassword,
        new_value: newContactValue.trim()
      });
      setRecoverySuccess(true);
      toast.success("Identity verified! Credentials updated with 24-hr security hold.");
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || err.message || "Recovery identity confirmation failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 540, width: "92%", padding: "28px", borderRadius: "14px", position: "relative" }}
      >
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 18, right: 18, background: "none", border: "none", color: "var(--muted, #94A3B8)", cursor: "pointer" }}
        >
          <X size={20} />
        </button>

        {/* Tab Toggle: Verify vs Recover */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid var(--border, #272A38)", paddingBottom: "12px" }}>
          <button
            type="button"
            onClick={() => { setMode("verify"); setErrorMsg(""); }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.95rem",
              padding: "6px 12px",
              color: mode === "verify" ? "var(--primary, #6366F1)" : "var(--muted, #94A3B8)",
              borderBottom: mode === "verify" ? "2px solid var(--primary, #6366F1)" : "2px solid transparent"
            }}
          >
            Seller Verification
          </button>
          <button
            type="button"
            onClick={() => { setMode("recovery"); setErrorMsg(""); }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.95rem",
              padding: "6px 12px",
              color: mode === "recovery" ? "var(--primary, #6366F1)" : "var(--muted, #94A3B8)",
              borderBottom: mode === "recovery" ? "2px solid var(--primary, #6366F1)" : "2px solid transparent"
            }}
          >
            Lost Access / Recovery
          </button>
        </div>

        {errorMsg && (
          <div style={{ background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#FCA5A5", padding: "10px 14px", borderRadius: "8px", fontSize: "0.88rem", marginBottom: "16px" }}>
            {errorMsg}
          </div>
        )}

        {/* ===================== MODE: VERIFY ===================== */}
        {mode === "verify" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <ShieldCheck size={24} color="var(--primary, #6366F1)" />
              <h2 style={{ margin: 0, fontSize: "1.35rem" }}>Activate Seller Account</h2>
            </div>
            <p style={{ color: "var(--muted, #94A3B8)", fontSize: "0.88rem", marginTop: 4, marginBottom: 20 }}>
              <b>1 Seller = 1 Email & 1 Phone Number</b>. Verify both to unlock listing GPU rentals & digital software.
            </p>

            {/* Stepper indicators */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "22px" }}>
              <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: step >= 1 ? "var(--primary, #6366F1)" : "var(--border, #272A38)" }} />
              <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: step >= 2 ? "var(--primary, #6366F1)" : "var(--border, #272A38)" }} />
              <div style={{ flex: 1, height: "4px", borderRadius: "2px", background: step >= 3 ? "#10B981" : "var(--border, #272A38)" }} />
            </div>

            {/* STEP 1: EMAIL VERIFICATION */}
            {step === 1 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, marginBottom: "8px" }}>
                  <Mail size={16} /> Step 1: Verify Registered Email
                </div>
                <div style={{ background: "var(--bg, #0B0D14)", border: "1px solid var(--border, #272A38)", borderRadius: "8px", padding: "12px 14px", marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.95rem" }}>{user?.email || "No email on file"}</span>
                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    disabled={busy || emailSent}
                    className="text-button"
                    style={{ fontSize: "0.85rem", cursor: "pointer", color: "var(--primary, #6366F1)" }}
                  >
                    {emailSent ? "Code Sent ✓" : "Send 6-digit Code"}
                  </button>
                </div>

                {emailDebugCode && (
                  <div style={{ fontSize: "0.8rem", color: "#10B981", background: "rgba(16, 185, 129, 0.1)", padding: "6px 10px", borderRadius: "6px", marginBottom: "12px" }}>
                    <b>Preview OTP code:</b> {emailDebugCode} (enter this below)
                  </div>
                )}

                {emailSent && (
                  <form onSubmit={handleConfirmEmailOtp}>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px", color: "var(--muted, #94A3B8)" }}>Enter 6-digit Email Verification Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value)}
                      placeholder="e.g. 123456"
                      required
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border, #272A38)", background: "var(--bg, #0B0D14)", color: "#fff", fontSize: "1.1rem", letterSpacing: "3px", textAlign: "center", marginBottom: "14px" }}
                    />
                    <button
                      type="submit"
                      disabled={busy || emailCode.length < 6}
                      className="primary-button full"
                      style={{ width: "100%" }}
                    >
                      {busy ? "Verifying…" : "Confirm Email & Proceed"} <ArrowRight size={16} />
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* STEP 2: PHONE NUMBER VERIFICATION (1:1 Binding) */}
            {step === 2 && (
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, marginBottom: "8px" }}>
                  <Phone size={16} /> Step 2: Bind & Verify Unique Phone Number
                </div>
                <p style={{ fontSize: "0.82rem", color: "var(--muted, #94A3B8)", marginBottom: "12px" }}>
                  Each seller account is strictly bound to 1 unique mobile phone number for payouts and 2FA.
                </p>

                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px", color: "var(--muted, #94A3B8)" }}>Mobile Phone Number (with Country Code)</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 555-0199 or +91 9876543210"
                      disabled={phoneSent}
                      style={{ flex: 1, padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border, #272A38)", background: "var(--bg, #0B0D14)", color: "#fff", fontSize: "0.95rem" }}
                    />
                    <button
                      type="button"
                      onClick={handleSendPhoneOtp}
                      disabled={busy || phoneSent || !phone.trim()}
                      className="primary-button"
                      style={{ whiteSpace: "nowrap", padding: "10px 16px", fontSize: "0.85rem" }}
                    >
                      {phoneSent ? "Sent ✓" : "Send SMS OTP"}
                    </button>
                  </div>
                </div>

                {phoneDebugCode && (
                  <div style={{ fontSize: "0.8rem", color: "#10B981", background: "rgba(16, 185, 129, 0.1)", padding: "6px 10px", borderRadius: "6px", marginBottom: "12px" }}>
                    <b>Preview SMS OTP code:</b> {phoneDebugCode} (enter this below)
                  </div>
                )}

                {phoneSent && (
                  <form onSubmit={handleConfirmPhoneOtp}>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px", color: "var(--muted, #94A3B8)" }}>Enter 6-digit SMS Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      placeholder="e.g. 654321"
                      required
                      style={{ width: "100%", padding: "10px 14px", borderRadius: "8px", border: "1px solid var(--border, #272A38)", background: "var(--bg, #0B0D14)", color: "#fff", fontSize: "1.1rem", letterSpacing: "3px", textAlign: "center", marginBottom: "14px" }}
                    />
                    <button
                      type="submit"
                      disabled={busy || phoneCode.length < 6}
                      className="primary-button full"
                      style={{ width: "100%" }}
                    >
                      {busy ? "Verifying Phone…" : "Verify Phone & Activate Seller"} <ArrowRight size={16} />
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* STEP 3: ACTIVATION COMPLETE & RECOVERY KEY */}
            {step === 3 && (
              <div>
                <div style={{ textAlign: "center", marginBottom: "16px" }}>
                  <CheckCircle2 size={44} color="#10B981" style={{ margin: "0 auto 8px" }} />
                  <h3 style={{ margin: 0, fontSize: "1.2rem" }}>Seller Account Activated!</h3>
                  <p style={{ color: "var(--muted, #94A3B8)", fontSize: "0.85rem", marginTop: 4 }}>
                    Your email and phone number are officially verified and bound to your seller account.
                  </p>
                </div>

                <div style={{ background: "rgba(245, 158, 11, 0.1)", border: "1px solid rgba(245, 158, 11, 0.3)", borderRadius: "10px", padding: "14px", marginBottom: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#F59E0B", fontWeight: 600, fontSize: "0.88rem", marginBottom: "6px" }}>
                    <KeyRound size={16} /> Emergency Seller Recovery Key
                  </div>
                  <p style={{ fontSize: "0.8rem", color: "var(--muted, #94A3B8)", margin: "0 0 10px" }}>
                    Save this key in a secure place. If you ever lose access to your phone or email, this key allows you to safely recover your seller account.
                  </p>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <code style={{ flex: 1, background: "var(--bg, #0B0D14)", padding: "8px 12px", borderRadius: "6px", fontSize: "0.95rem", color: "#F3F4F6", letterSpacing: "1px" }}>
                      {recoveryKey}
                    </code>
                    <button
                      type="button"
                      onClick={copyKey}
                      className="secondary-button"
                      style={{ padding: "8px 12px", display: "flex", alignItems: "center", gap: "4px" }}
                    >
                      {copied ? <Check size={14} color="#10B981" /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleFinish}
                  className="primary-button full"
                  style={{ width: "100%", padding: "12px", fontSize: "1rem" }}
                >
                  Enter Seller Studio <ArrowRight size={17} />
                </button>
              </div>
            )}
          </>
        )}

        {/* ===================== MODE: RECOVERY / RESET ===================== */}
        {mode === "recovery" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
              <KeyRound size={22} color="#F59E0B" />
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Recover Seller Credentials</h2>
            </div>
            <p style={{ color: "var(--muted, #94A3B8)", fontSize: "0.85rem", marginTop: 4, marginBottom: 16 }}>
              Lost access to your verified mobile number or email? Confirm your identity to safely re-bind your seller credentials.
            </p>

            <div style={{ background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.25)", padding: "10px 14px", borderRadius: "8px", fontSize: "0.8rem", color: "#FCA5A5", marginBottom: "16px", display: "flex", gap: "8px", alignItems: "flex-start" }}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>
                <b>Anti-Theft Protection:</b> Changing a verified phone or email triggers an automatic <b>24-hour security hold on balance withdrawals</b> to prevent unauthorized funds diversion.
              </span>
            </div>

            {recoverySuccess ? (
              <div style={{ textAlign: "center", padding: "16px 0" }}>
                <CheckCircle2 size={40} color="#10B981" style={{ margin: "0 auto 8px" }} />
                <h4 style={{ margin: "0 0 6px" }}>Credentials Updated Successfully</h4>
                <p style={{ color: "var(--muted, #94A3B8)", fontSize: "0.85rem" }}>
                  Your seller account has been re-bound to your new credentials. Withdrawal hold is now active for 24 hours.
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="primary-button"
                  style={{ marginTop: "12px" }}
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleRecoverySubmit}>
                <div style={{ marginBottom: "14px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px", color: "var(--muted, #94A3B8)" }}>
                    Select Proof of Identity
                  </label>
                  <select
                    value={recoveryType}
                    onChange={(e) => setRecoveryType(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border, #272A38)", background: "var(--bg, #0B0D14)", color: "#fff" }}
                  >
                    <option value="recovery_key">Emergency Recovery Key (PROD-SEC-...)</option>
                    <option value="password">Account Password</option>
                  </select>
                </div>

                {recoveryType === "recovery_key" ? (
                  <div style={{ marginBottom: "14px" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px", color: "var(--muted, #94A3B8)" }}>
                      Enter 24-character Recovery Key
                    </label>
                    <input
                      type="text"
                      value={recoveryProof}
                      onChange={(e) => setRecoveryProof(e.target.value)}
                      placeholder="e.g. PROD-ABC123XYZ..."
                      required
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border, #272A38)", background: "var(--bg, #0B0D14)", color: "#fff", letterSpacing: "1px" }}
                    />
                  </div>
                ) : (
                  <div style={{ marginBottom: "14px" }}>
                    <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px", color: "var(--muted, #94A3B8)" }}>
                      Enter Account Password
                    </label>
                    <input
                      type="password"
                      value={recoveryPassword}
                      onChange={(e) => setRecoveryPassword(e.target.value)}
                      placeholder="Your current password"
                      required
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border, #272A38)", background: "var(--bg, #0B0D14)", color: "#fff" }}
                    />
                  </div>
                )}

                <div style={{ marginBottom: "18px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "6px", color: "var(--muted, #94A3B8)" }}>
                    New Replacement Mobile Phone or Email
                  </label>
                  <input
                    type="text"
                    value={newContactValue}
                    onChange={(e) => setNewContactValue(e.target.value)}
                    placeholder="+1 555-0199 or name@example.com"
                    required
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "8px", border: "1px solid var(--border, #272A38)", background: "var(--bg, #0B0D14)", color: "#fff" }}
                  />
                  <small style={{ color: "var(--muted, #94A3B8)", fontSize: "0.75rem", display: "block", marginTop: "4px" }}>
                    Must not already be bound to another seller account.
                  </small>
                </div>

                <button
                  type="submit"
                  disabled={busy || !newContactValue.trim()}
                  className="primary-button full"
                  style={{ width: "100%", padding: "11px" }}
                >
                  {busy ? "Verifying & Updating…" : "Verify Identity & Reset Access"}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
