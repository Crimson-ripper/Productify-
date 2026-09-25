import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Copy,
  Check,
  Mail,
  Phone,
  KeyRound,
  Award
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import SEO from "@/components/SEO";
import ImageUpload from "@/components/ImageUpload";
import { toast } from "sonner";

export default function SellerOnboarding() {
  const { user, registerEmail, sendSellerOtp, confirmSellerOtp, checkUsername, activateSeller, upgradeSellerTier } = useAuth();
  const navigate = useNavigate();

  // Current Step: 1 | 2 | 3 | 4
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  // STEP 1: Account
  const [firstName, setFirstName] = useState(user?.name?.split(" ")[0] || "");
  const [surname, setSurname] = useState(user?.surname || (user?.name?.split(" ").slice(1).join(" ") || ""));
  const [email, setEmail] = useState(user?.email || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");

  // STEP 2: Verification
  const [emailCode, setEmailCode] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [phoneSent, setPhoneSent] = useState(false);
  const [emailVerified, setEmailVerified] = useState(Boolean(user?.email_verified || user?.auth_provider === "google"));
  const [phoneVerified, setPhoneVerified] = useState(Boolean(user?.phone_verified));
  const [sendingEmailCode, setSendingEmailCode] = useState(false);
  const [sendingPhoneCode, setSendingPhoneCode] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);

  // STEP 3: Store Profile
  const [username, setUsername] = useState(user?.username || "");
  const [storename, setStorename] = useState(user?.storename || "");
  const [storeLogoUrl, setStoreLogoUrl] = useState(user?.store_logo_url || "");
  const [storeBio, setStoreBio] = useState("");
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState(null); // null | { available: boolean, reason?: string }

  // STEP 4: Finished & Plan Selection
  const [recoveryKey, setRecoveryKey] = useState("");
  const [copiedKey, setCopiedKey] = useState(false);
  const [selectedTier, setSelectedTier] = useState(user?.seller_tier || "free"); // "free" | "plus" | "pro"
  const [tierChanging, setTierChanging] = useState(false);

  // Populate from logged-in user if status changes
  useEffect(() => {
    if (user) {
      setFirstName((prev) => prev || (user.name ? user.name.split(" ")[0] : ""));
      setSurname((prev) => prev || user.surname || (user.name ? user.name.split(" ").slice(1).join(" ") : ""));
      setEmail((prev) => prev || user.email || "");
      setPhone((prev) => prev || user.phone || "");
      setAvatarUrl((prev) => prev || user.avatar_url || "");
      setUsername((prev) => prev || user.username || "");
      setStorename((prev) => prev || user.storename || "");
      if (user.email_verified || user.auth_provider === "google") setEmailVerified(true);
      if (user.phone_verified) setPhoneVerified(true);
      if (user.seller_tier) setSelectedTier(user.seller_tier);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Live username debounce check
  useEffect(() => {
    const cleanUname = username.trim().toLowerCase();
    if (!cleanUname || cleanUname.length < 3) {
      setUsernameStatus(cleanUname.length > 0 ? { available: false, reason: "At least 3 characters required." } : null);
      return;
    }

    const timer = setTimeout(async () => {
      setUsernameChecking(true);
      const res = await checkUsername(cleanUname);
      setUsernameStatus(res);
      setUsernameChecking(false);
    }, 400);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  // Handle Step 1 -> Step 2
  const handleStep1Submit = async (e) => {
    e.preventDefault();
    if (!firstName.trim()) return toast.error("Please enter your first name.");
    if (!surname.trim()) return toast.error("Please enter your surname.");
    if (!email.trim() || !email.includes("@")) return toast.error("Please enter a valid email address.");
    if (!phone.trim() || phone.replace(/\D/g, "").length < 7) return toast.error("Please enter a valid mobile phone number.");

    if (!user) {
      if (!password || password.length < 6) return toast.error("Password must be at least 6 characters.");
      if (password !== confirmPassword) return toast.error("Passwords do not match.");

      setBusy(true);
      try {
        await registerEmail({
          email: email.trim().toLowerCase(),
          password,
          name: `${firstName.trim()} ${surname.trim()}`,
          surname: surname.trim(),
          phone: phone.trim(),
          avatar_url: avatarUrl,
          role: "buyer"
        });
        toast.success("Account registered! Please verify your email and phone.");
        setStep(2);
      } catch (err) {
        toast.error(err.response?.data?.detail || "Registration failed. This email might already exist.");
      } finally {
        setBusy(false);
      }
    } else {
      setStep(2);
    }
  };

  // Step 2: Send OTP
  const handleSendCode = async (type) => {
    const val = type === "email" ? email : phone;
    if (type === "email") setSendingEmailCode(true);
    else setSendingPhoneCode(true);

    try {
      const res = await sendSellerOtp(type, val);
      if (type === "email") {
        setEmailSent(true);
        toast.success(`Verification code sent to ${val}`);
        if (res.debug_code) toast.info(`Preview code: ${res.debug_code}`);
      } else {
        setPhoneSent(true);
        toast.success(`SMS verification code sent to ${val}`);
        if (res.debug_code) toast.info(`Preview SMS code: ${res.debug_code}`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to send code to ${val}`);
    } finally {
      if (type === "email") setSendingEmailCode(false);
      else setSendingPhoneCode(false);
    }
  };

  // Step 2: Confirm OTP
  const handleVerifyCode = async (type) => {
    const val = type === "email" ? email : phone;
    const code = type === "email" ? emailCode : phoneCode;
    if (!code || code.trim().length < 4) return toast.error("Please enter the verification code.");

    if (type === "email") setVerifyingEmail(true);
    else setVerifyingPhone(true);

    try {
      await confirmSellerOtp(type, val, code);
      if (type === "email") {
        setEmailVerified(true);
        toast.success("Email verified successfully!");
      } else {
        setPhoneVerified(true);
        toast.success("Phone verified successfully!");
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || err.message || "Invalid code. Please try again.");
    } finally {
      if (type === "email") setVerifyingEmail(false);
      else setVerifyingPhone(false);
    }
  };

  // Step 2 -> Step 3
  const handleStep2Continue = () => {
    if (!emailVerified) return toast.error("Please verify your email address before continuing.");
    if (!phoneVerified) return toast.error("Please verify your mobile phone number before continuing.");
    setStep(3);
  };

  // Step 3 -> Step 4
  const handleStep3Submit = async (e) => {
    e.preventDefault();
    const cleanUname = username.trim().toLowerCase();
    if (!cleanUname || cleanUname.length < 3) return toast.error("Please choose a valid username (min 3 characters).");
    if (usernameStatus && !usernameStatus.available) return toast.error(usernameStatus.reason || "Username is unavailable.");
    if (!storename.trim()) return toast.error("Please enter a store or node name.");

    setBusy(true);
    try {
      const res = await activateSeller({
        phone: phone.trim(),
        username: cleanUname,
        storename: storename.trim(),
        store_logo_url: storeLogoUrl,
        avatar_url: avatarUrl,
        tier: "free"
      });
      if (res.recovery_key) {
        setRecoveryKey(res.recovery_key);
      }
      toast.success("Seller account activated successfully!");
      setStep(4);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Activation failed. Please check your details.");
    } finally {
      setBusy(false);
    }
  };

  // Copy Emergency Key
  const handleCopyKey = () => {
    if (!recoveryKey) return;
    navigator.clipboard.writeText(recoveryKey);
    setCopiedKey(true);
    toast.success("Recovery key copied to clipboard! Save this in a secure place.");
    setTimeout(() => setCopiedKey(false), 3000);
  };

  // Select optional tier on Step 4
  const handleSelectTier = async (tier) => {
    setSelectedTier(tier);
    if (tier === "free") {
      toast.success("Free Starter Plan selected. No credit card required.");
      return;
    }
    setTierChanging(true);
    try {
      await upgradeSellerTier(tier);
      toast.success(`Upgraded to Productify ${tier === "pro" ? "Pro" : "Plus"}!`);
    } catch {
      toast.info(`Productify ${tier === "pro" ? "Pro" : "Plus"} selected!`);
    } finally {
      setTierChanging(false);
    }
  };

  return (
    <>
      <SEO
        title="Seller Onboarding — Productify"
        description="Complete your seller registration, 1:1 verification, and launch your Seller Studio."
        path="/seller/onboarding"
      />

      <div style={{ minHeight: "calc(100vh - 180px)", background: "var(--paper, #f7f7f4)", padding: "40px 6% 80px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>

          {/* Stepper Navigation Header */}
          <div style={{ marginBottom: 32, textAlign: "center" }}>
            <div className="eyebrow" style={{ justifyContent: "center", marginBottom: 8 }}>
              <span className="eyebrow-line" /> SELLER ONBOARDING
            </div>
            <h1 style={{ font: "600 clamp(28px, 4vw, 42px) 'Space Grotesk', sans-serif", letterSpacing: "-0.05em", margin: "0 0 12px", color: "var(--ink, #101112)" }}>
              Activate your seller account<em>.</em>
            </h1>
            <p style={{ color: "var(--muted, #747570)", fontSize: "0.95rem", margin: 0 }}>
              Complete the 4 steps below to start listing digital products & renting GPU compute nodes.
            </p>
          </div>

          {/* Visual Progress Stepper Bar */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--line, #dedfd9)",
              borderRadius: 14,
              padding: "20px 24px",
              marginBottom: 32,
              boxShadow: "0 2px 10px rgba(0,0,0,0.02)"
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, position: "relative" }}>
              {[
                { s: 1, label: "Account", sub: "Personal info" },
                { s: 2, label: "Verification", sub: "1:1 Email & Phone" },
                { s: 3, label: "Store Profile", sub: "Username & Logo" },
                { s: 4, label: "Finished", sub: "Plan & Launch" }
              ].map(({ s, label, sub }) => {
                const isCurrent = step === s;
                const isDone = step > s;
                return (
                  <div
                    key={s}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      opacity: isCurrent || isDone ? 1 : 0.55,
                      transition: "all 0.2s"
                    }}
                  >
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: "50%",
                        background: isDone
                          ? "var(--green, #70d59e)"
                          : isCurrent
                          ? "var(--ink, #101112)"
                          : "var(--paper, #f7f7f4)",
                        color: isDone ? "#0d3c22" : isCurrent ? "var(--lime, #c8f04c)" : "var(--muted, #747570)",
                        border: isCurrent
                          ? "2px solid var(--ink, #101112)"
                          : isDone
                          ? "2px solid #57be84"
                          : "1px solid var(--line, #dedfd9)",
                        display: "grid",
                        placeItems: "center",
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        fontFamily: "'DM Mono', monospace",
                        marginBottom: 6
                      }}
                    >
                      {isDone ? <Check size={16} strokeWidth={3} /> : `0${s}`}
                    </div>
                    <b style={{ fontSize: "0.85rem", color: isCurrent ? "var(--ink, #101112)" : "inherit" }}>{label}</b>
                    <small style={{ fontSize: "0.72rem", color: "var(--muted, #747570)", marginTop: 2 }}>{sub}</small>
                  </div>
                );
              })}
            </div>

            {/* Stepper horizontal line */}
            <div style={{ height: 4, background: "var(--line, #dedfd9)", borderRadius: 10, marginTop: 16, overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100}%`,
                  background: "var(--lime, #c8f04c)",
                  transition: "width 0.3s ease"
                }}
              />
            </div>
          </div>

          {/* MAIN FORM CARD */}
          <div
            style={{
              background: "#ffffff",
              border: "1px solid var(--line, #dedfd9)",
              borderRadius: 14,
              padding: "36px 32px",
              boxShadow: "0 4px 20px rgba(0,0,0,0.03)"
            }}
          >

            {/* ===================== STEP 1: ACCOUNT INFORMATION ===================== */}
            {step === 1 && (
              <form onSubmit={handleStep1Submit} className="dashboard-form" style={{ maxWidth: "100%" }}>
                <div style={{ marginBottom: 12 }}>
                  <div className="eyebrow"><span className="eyebrow-line" /> STEP 1 OF 4</div>
                  <h2 style={{ font: "600 24px 'Space Grotesk', sans-serif", margin: "6px 0 4px" }}>
                    Account credentials<em>.</em>
                  </h2>
                  <p style={{ color: "var(--muted, #747570)", fontSize: "0.88rem", margin: 0 }}>
                    Enter your legal name and contact details. Each seller account is strictly bound 1:1 to unique credentials.
                  </p>
                </div>

                {user && (
                  <div style={{ padding: "12px 16px", background: "rgba(101, 86, 232, 0.08)", border: "1px solid rgba(101, 86, 232, 0.25)", color: "var(--ink)", borderRadius: 8, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 8 }}>
                    <ShieldCheck size={18} color="var(--violet, #6556e8)" />
                    <span>Signed in as <b>{user.email}</b>. We have pre-filled your available details.</span>
                  </div>
                )}

                <div className="two-col">
                  <label>
                    First Name
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. Alexander"
                      required
                    />
                  </label>
                  <label>
                    Last Name / Surname
                    <input
                      type="text"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                      placeholder="e.g. Vance"
                      required
                    />
                  </label>
                </div>

                <div className="two-col">
                  <label>
                    Email Address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alexander@example.com"
                      required
                      disabled={Boolean(user?.email)}
                    />
                  </label>
                  <label>
                    Mobile Phone Number
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 234-5678"
                      required
                    />
                  </label>
                </div>

                {!user && (
                  <div className="two-col">
                    <label>
                      Password
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </label>
                    <label>
                      Confirm Password
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                    </label>
                  </div>
                )}

                {/* Profile Picture (Optional) */}
                <div style={{ marginTop: 8 }}>
                  <label style={{ display: "block", marginBottom: 6 }}>
                    Profile Picture <small style={{ color: "var(--muted, #747570)", textTransform: "none" }}>(Optional)</small>
                  </label>
                  <ImageUpload
                    value={avatarUrl}
                    onChange={setAvatarUrl}
                    label="Upload your personal profile picture"
                    testid="seller-onboarding-avatar"
                  />
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                  <button type="submit" disabled={busy} className="primary-button" style={{ padding: "14px 28px", fontSize: "0.95rem" }}>
                    {busy ? "Checking…" : "Continue to Verification"} <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {/* ===================== STEP 2: DUAL VERIFICATION ===================== */}
            {step === 2 && (
              <div>
                <div style={{ marginBottom: 20 }}>
                  <div className="eyebrow"><span className="eyebrow-line" /> STEP 2 OF 4</div>
                  <h2 style={{ font: "600 24px 'Space Grotesk', sans-serif", margin: "6px 0 4px" }}>
                    Verify email & phone<em>.</em>
                  </h2>
                  <p style={{ color: "var(--muted, #747570)", fontSize: "0.88rem", margin: 0 }}>
                    To protect buyers and sellers, every seller account must be confirmed with 1 unique email and 1 unique mobile phone.
                  </p>
                </div>

                {/* Email Verification Box */}
                <div
                  style={{
                    background: emailVerified ? "rgba(112, 213, 158, 0.1)" : "#fafaf8",
                    border: emailVerified ? "1px solid #70d59e" : "1px solid var(--line, #dedfd9)",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 20
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: emailVerified ? "#70d59e" : "var(--ink, #101112)", color: emailVerified ? "#0d3c22" : "var(--lime, #c8f04c)", display: "grid", placeItems: "center" }}>
                        <Mail size={16} />
                      </div>
                      <div>
                        <b style={{ fontSize: "0.95rem", display: "block" }}>Email Address</b>
                        <small style={{ color: "var(--muted, #747570)" }}>{email}</small>
                      </div>
                    </div>

                    {emailVerified ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#e9f3e5", color: "#277c50", padding: "4px 10px", borderRadius: 100, fontSize: "0.78rem", fontWeight: 700 }}>
                        <CheckCircle2 size={14} /> Verified ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendCode("email")}
                        disabled={sendingEmailCode}
                        className="secondary-button"
                        style={{ padding: "8px 16px", fontSize: "0.82rem" }}
                      >
                        {sendingEmailCode ? "Sending…" : emailSent ? "Resend Code" : "Get code"}
                      </button>
                    )}
                  </div>

                  {!emailVerified && emailSent && (
                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit code"
                        value={emailCode}
                        onChange={(e) => setEmailCode(e.target.value)}
                        style={{ flex: 1, padding: "10px 14px", border: "1px solid var(--line, #dedfd9)", background: "#fff", fontSize: "1rem", letterSpacing: "2px", fontFamily: "'DM Mono', monospace" }}
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyCode("email")}
                        disabled={verifyingEmail || !emailCode}
                        className="primary-button"
                        style={{ padding: "10px 20px", fontSize: "0.85rem" }}
                      >
                        {verifyingEmail ? "Verifying…" : "Confirm"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Phone Verification Box */}
                <div
                  style={{
                    background: phoneVerified ? "rgba(112, 213, 158, 0.1)" : "#fafaf8",
                    border: phoneVerified ? "1px solid #70d59e" : "1px solid var(--line, #dedfd9)",
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 24
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: "50%", background: phoneVerified ? "#70d59e" : "var(--ink, #101112)", color: phoneVerified ? "#0d3c22" : "var(--lime, #c8f04c)", display: "grid", placeItems: "center" }}>
                        <Phone size={16} />
                      </div>
                      <div>
                        <b style={{ fontSize: "0.95rem", display: "block" }}>Mobile Phone</b>
                        <small style={{ color: "var(--muted, #747570)" }}>{phone}</small>
                      </div>
                    </div>

                    {phoneVerified ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#e9f3e5", color: "#277c50", padding: "4px 10px", borderRadius: 100, fontSize: "0.78rem", fontWeight: 700 }}>
                        <CheckCircle2 size={14} /> Verified ✓
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSendCode("phone")}
                        disabled={sendingPhoneCode}
                        className="secondary-button"
                        style={{ padding: "8px 16px", fontSize: "0.82rem" }}
                      >
                        {sendingPhoneCode ? "Sending…" : phoneSent ? "Resend SMS" : "Get code"}
                      </button>
                    )}
                  </div>

                  {!phoneVerified && phoneSent && (
                    <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="Enter 6-digit SMS code"
                        value={phoneCode}
                        onChange={(e) => setPhoneCode(e.target.value)}
                        style={{ flex: 1, padding: "10px 14px", border: "1px solid var(--line, #dedfd9)", background: "#fff", fontSize: "1rem", letterSpacing: "2px", fontFamily: "'DM Mono', monospace" }}
                      />
                      <button
                        type="button"
                        onClick={() => handleVerifyCode("phone")}
                        disabled={verifyingPhone || !phoneCode}
                        className="primary-button"
                        style={{ padding: "10px 20px", fontSize: "0.85rem" }}
                      >
                        {verifyingPhone ? "Verifying…" : "Confirm"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Back / Next buttons */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-button text-button-dark"
                    style={{ padding: "10px 14px" }}
                  >
                    <ArrowLeft size={16} /> Back to Account
                  </button>

                  <button
                    type="button"
                    onClick={handleStep2Continue}
                    disabled={!emailVerified || !phoneVerified}
                    className="primary-button"
                    style={{ padding: "14px 28px", fontSize: "0.95rem" }}
                  >
                    Continue to Store Profile <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* ===================== STEP 3: STORE PROFILE & UNIQUE USERNAME ===================== */}
            {step === 3 && (
              <form onSubmit={handleStep3Submit} className="dashboard-form" style={{ maxWidth: "100%" }}>
                <div style={{ marginBottom: 16 }}>
                  <div className="eyebrow"><span className="eyebrow-line" /> STEP 3 OF 4</div>
                  <h2 style={{ font: "600 24px 'Space Grotesk', sans-serif", margin: "6px 0 4px" }}>
                    Store profile & handle<em>.</em>
                  </h2>
                  <p style={{ color: "var(--muted, #747570)", fontSize: "0.88rem", margin: 0 }}>
                    Choose your unique seller handle and brand your storefront.
                  </p>
                </div>

                {/* Unique Username */}
                <div>
                  <label>
                    Seller Username <small style={{ color: "var(--violet, #6556e8)", fontWeight: 700 }}>(Must be unique)</small>
                    <div style={{ position: "relative" }}>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                        placeholder="e.g. quantum-compute or alex-designs"
                        required
                        minLength={3}
                        maxLength={30}
                        style={{ paddingRight: 40 }}
                      />
                      <div style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: "0.82rem" }}>
                        {usernameChecking ? (
                          <span style={{ color: "var(--muted, #747570)" }}>Checking…</span>
                        ) : usernameStatus?.available ? (
                          <span style={{ color: "#10B981", fontWeight: 700 }}>✓ Available</span>
                        ) : usernameStatus && !usernameStatus.available ? (
                          <span style={{ color: "#EF4444", fontWeight: 700 }}>✗ Taken</span>
                        ) : null}
                      </div>
                    </div>
                  </label>
                  {usernameStatus && !usernameStatus.available && (
                    <small style={{ color: "#EF4444", display: "block", marginTop: 4, fontSize: "0.78rem" }}>
                      {usernameStatus.reason}
                    </small>
                  )}
                  <small style={{ color: "var(--muted, #747570)", display: "block", marginTop: 4, fontSize: "0.75rem" }}>
                    Your public URL will be: <b>productifynow.com/@{username || "your-username"}</b>
                  </small>
                </div>

                {/* Store Name */}
                <div style={{ marginTop: 12 }}>
                  <label>
                    Store Name / Node Brand <small style={{ color: "var(--muted, #747570)", textTransform: "none" }}>(Does not need to be unique)</small>
                    <input
                      type="text"
                      value={storename}
                      onChange={(e) => setStorename(e.target.value)}
                      placeholder="e.g. Apex Render Farm & Digital Assets"
                      required
                    />
                  </label>
                </div>

                {/* Store Profile Picture / Logo (Optional) */}
                <div style={{ marginTop: 12 }}>
                  <label style={{ display: "block", marginBottom: 6 }}>
                    Store Profile Picture / Brand Logo <small style={{ color: "var(--muted, #747570)", textTransform: "none" }}>(Optional)</small>
                  </label>
                  <ImageUpload
                    value={storeLogoUrl}
                    onChange={setStoreLogoUrl}
                    label="Upload store logo or host avatar"
                    testid="seller-onboarding-store-logo"
                  />
                </div>

                {/* Store Bio */}
                <div style={{ marginTop: 12 }}>
                  <label>
                    Store Description / Hardware Bio <small style={{ color: "var(--muted, #747570)", textTransform: "none" }}>(Optional)</small>
                    <textarea
                      value={storeBio}
                      onChange={(e) => setStoreBio(e.target.value)}
                      placeholder="Specializing in production-grade 3D shaders and high-availability dual RTX 4090 inference rigs..."
                      style={{ minHeight: 80 }}
                    />
                  </label>
                </div>

                {/* Action buttons */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 24 }}>
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-button text-button-dark"
                    style={{ padding: "10px 14px" }}
                  >
                    <ArrowLeft size={16} /> Back to Verification
                  </button>

                  <button
                    type="submit"
                    disabled={busy || (usernameStatus && !usernameStatus.available)}
                    className="primary-button"
                    style={{ padding: "14px 28px", fontSize: "0.95rem" }}
                  >
                    {busy ? "Activating…" : "Activate Seller Account"} <ArrowRight size={16} />
                  </button>
                </div>
              </form>
            )}

            {/* ===================== STEP 4: FINISHED & PLAN SELECTION ===================== */}
            {step === 4 && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 28 }}>
                  <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--lime, #c8f04c)", color: "var(--ink, #101112)", display: "grid", placeItems: "center", margin: "0 auto 14px" }}>
                    <CheckCircle2 size={32} />
                  </div>
                  <h2 style={{ font: "600 28px 'Space Grotesk', sans-serif", margin: "0 0 6px" }}>
                    Welcome to the Seller Guild<em>!</em>
                  </h2>
                  <p style={{ color: "var(--muted, #747570)", fontSize: "0.95rem", maxWidth: 540, margin: "0 auto" }}>
                    Your seller account is 100% verified. You can start creating listings immediately or choose an optional membership upgrade.
                  </p>
                </div>

                {/* Emergency Recovery Key Box */}
                {recoveryKey && (
                  <div
                    style={{
                      background: "rgba(245, 158, 11, 0.08)",
                      border: "1px solid rgba(245, 158, 11, 0.35)",
                      borderRadius: 12,
                      padding: 18,
                      marginBottom: 28
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#B45309", fontWeight: 700, fontSize: "0.85rem", marginBottom: 6 }}>
                      <KeyRound size={16} /> EMERGENCY ACCOUNT RECOVERY KEY
                    </div>
                    <p style={{ fontSize: "0.82rem", color: "#78350F", margin: "0 0 10px", lineHeight: 1.5 }}>
                      If you ever lose access to your verified email or mobile phone, this key allows you to safely recover your seller account and balance. Store it securely!
                    </p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <code style={{ flex: 1, padding: "8px 12px", background: "#fff", border: "1px solid rgba(245, 158, 11, 0.4)", borderRadius: 6, font: "700 0.95rem 'DM Mono', monospace", color: "var(--ink)" }}>
                        {recoveryKey}
                      </code>
                      <button
                        type="button"
                        onClick={handleCopyKey}
                        className="secondary-button"
                        style={{ padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, fontSize: "0.82rem" }}
                      >
                        {copiedKey ? <Check size={14} color="#10B981" /> : <Copy size={14} />}
                        {copiedKey ? "Copied" : "Copy Key"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Plan Selection Cards */}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
                    <h3 style={{ font: "600 18px 'Space Grotesk', sans-serif", margin: 0 }}>
                      Choose your membership plan
                    </h3>
                    <small style={{ color: "var(--muted, #747570)", font: "11px 'DM Mono', monospace" }}>
                      Subscriptions are optional · change anytime
                    </small>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, opacity: tierChanging ? 0.6 : 1, pointerEvents: tierChanging ? "none" : "auto", transition: "opacity 0.2s" }}>
                    
                    {/* Free Starter Tier */}
                    <div
                      onClick={() => handleSelectTier("free")}
                      style={{
                        background: selectedTier === "free" ? "#ffffff" : "#fafaf8",
                        border: selectedTier === "free" ? "2px solid var(--ink, #101112)" : "1px solid var(--line, #dedfd9)",
                        borderRadius: 12,
                        padding: 20,
                        cursor: "pointer",
                        position: "relative",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ font: "700 10px 'DM Mono'", textTransform: "uppercase", letterSpacing: "1px", color: "var(--muted, #747570)" }}>STARTER</span>
                        {selectedTier === "free" && (
                          <span style={{ background: "var(--lime, #c8f04c)", color: "var(--ink, #101112)", font: "800 10px 'DM Mono'", padding: "2px 8px", borderRadius: 100 }}>
                            ACTIVE ✓
                          </span>
                        )}
                      </div>
                      <div style={{ font: "800 24px 'Space Grotesk', sans-serif", margin: "6px 0 2px" }}>$0 <small style={{ font: "400 11px 'DM Mono'", color: "var(--muted)" }}>/ forever</small></div>
                      <p style={{ fontSize: "0.78rem", color: "var(--muted, #747570)", marginBottom: 12 }}>100% Free activation with standard 10% commission on sales.</p>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: 6 }}>
                        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={14} color="#10B981" /> Unlimited digital products</li>
                        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={14} color="#10B981" /> GPU rental node listings</li>
                        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Check size={14} color="#10B981" /> Weekly automated bank payouts</li>
                      </ul>
                    </div>

                    {/* Productify Plus Tier */}
                    <div
                      onClick={() => handleSelectTier("plus")}
                      style={{
                        background: selectedTier === "plus" ? "rgba(101, 86, 232, 0.05)" : "#fafaf8",
                        border: selectedTier === "plus" ? "2px solid var(--violet, #6556e8)" : "1px solid var(--line, #dedfd9)",
                        borderRadius: 12,
                        padding: 20,
                        cursor: "pointer",
                        position: "relative",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ font: "700 10px 'DM Mono'", textTransform: "uppercase", letterSpacing: "1px", color: "var(--violet, #6556e8)" }}>PLUS</span>
                        {selectedTier === "plus" ? (
                          <span style={{ background: "var(--violet, #6556e8)", color: "#fff", font: "800 10px 'DM Mono'", padding: "2px 8px", borderRadius: 100 }}>
                            ACTIVE ✓
                          </span>
                        ) : (
                          <span style={{ font: "700 10px 'DM Mono'", color: "var(--muted)" }}>OPTIONAL</span>
                        )}
                      </div>
                      <div style={{ font: "800 24px 'Space Grotesk', sans-serif", margin: "6px 0 2px" }}>$12 <small style={{ font: "400 11px 'DM Mono'", color: "var(--muted)" }}>/ month</small></div>
                      <p style={{ fontSize: "0.78rem", color: "var(--muted, #747570)", marginBottom: 12 }}>Cut fees by 50% and receive 48-hour expedited payouts.</p>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: 6 }}>
                        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={14} color="var(--violet)" /> <b>5% Reduced Marketplace Fee</b></li>
                        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={14} color="var(--violet)" /> Priority search ranking</li>
                        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Sparkles size={14} color="var(--violet)" /> 48-Hour expedited cashouts</li>
                      </ul>
                    </div>

                    {/* Productify Pro Tier */}
                    <div
                      onClick={() => handleSelectTier("pro")}
                      style={{
                        background: selectedTier === "pro" ? "rgba(245, 158, 11, 0.08)" : "#fafaf8",
                        border: selectedTier === "pro" ? "2px solid #F59E0B" : "1px solid var(--line, #dedfd9)",
                        borderRadius: 12,
                        padding: 20,
                        cursor: "pointer",
                        position: "relative",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <span style={{ font: "700 10px 'DM Mono'", textTransform: "uppercase", letterSpacing: "1px", color: "#D97706" }}>PRO</span>
                        {selectedTier === "pro" ? (
                          <span style={{ background: "#F59E0B", color: "#000", font: "800 10px 'DM Mono'", padding: "2px 8px", borderRadius: 100 }}>
                            ACTIVE ✓
                          </span>
                        ) : (
                          <span style={{ font: "700 10px 'DM Mono'", color: "var(--muted)" }}>OPTIONAL</span>
                        )}
                      </div>
                      <div style={{ font: "800 24px 'Space Grotesk', sans-serif", margin: "6px 0 2px" }}>$29 <small style={{ font: "400 11px 'DM Mono'", color: "var(--muted)" }}>/ month</small></div>
                      <p style={{ fontSize: "0.78rem", color: "var(--muted, #747570)", marginBottom: 12 }}>Keep 100% of sales with zero fee and instant automated payouts.</p>
                      <ul style={{ listStyle: "none", padding: 0, margin: 0, fontSize: "0.8rem", display: "flex", flexDirection: "column", gap: 6 }}>
                        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Award size={14} color="#F59E0B" /> <b>0% Marketplace Fee</b></li>
                        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Award size={14} color="#F59E0B" /> Instant 15-Minute bank cashouts</li>
                        <li style={{ display: "flex", alignItems: "center", gap: 6 }}><Award size={14} color="#F59E0B" /> Golden Badge & GPU telemetry</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Final Launch Button */}
                <div style={{ textAlign: "center", paddingTop: 10, borderTop: "1px solid var(--line, #dedfd9)" }}>
                  <button
                    type="button"
                    onClick={() => navigate("/seller-studio")}
                    className="primary-button"
                    style={{ padding: "16px 36px", fontSize: "1.05rem", fontWeight: 800, width: "100%", maxWidth: 380 }}
                  >
                    Complete & Launch Seller Studio <ArrowRight size={18} />
                  </button>
                  <div style={{ marginTop: 12, fontSize: "0.82rem", color: "var(--muted, #747570)" }}>
                    You can manage your listings, banking, and subscription in Seller Studio anytime.
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </div>
    </>
  );
}
