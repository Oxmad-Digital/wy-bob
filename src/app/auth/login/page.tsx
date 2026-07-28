"use client";
import { signIn, getSession, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useLanguage } from "@/contexts/LanguageContext";
import "../../page.css";
import "./login.css";

function IconEmail() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/>
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
}

function IconLock() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

function IconEye() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function IconEyeOff() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function IconAlert() {
  return (
    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0}}>
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="8" x2="12" y2="12"/>
      <line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

function LoginContent() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/dashboard";
  const { data: session } = useSession();
  const { t } = useLanguage();

  useEffect(() => {
    if (session?.user && !loading) {
      router.push(session.user?.role === "admin" ? "/admin" : redirectTo);
    }
  }, [session, router, loading]);

  function validateEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError(t.login.errors.fill);
      return;
    }

    if (!validateEmail(email)) {
      setError(t.login.errors.invalidEmail);
      return;
    }

    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError(t.login.errors.weakPassword);
      return;
    }

    setLoading(true);
    setResendState("idle");
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);

    if (res?.error) {
      setError(res.error === "CredentialsSignin" ? t.login.errors.invalid : res.error);
      return;
    }

    const updatedSession = await getSession();
    router.push(updatedSession?.user?.role === "admin" ? "/admin" : redirectTo);
  }

  const isUnverifiedError = /non vérifié|not verified/i.test(error);

  async function handleResendVerification() {
    setResendState("sending");
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
    } finally {
      setResendState("sent");
    }
  }

  return (
    <div className="container">
      <Navbar />

      <div className="loginZone">
        <div className="login-card">

          <div className="login-header">
            <div className="login-logo">WYBOB</div>
            <p className="login-welcome">{t.login.welcome}</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="login-inputs">
              <div className="login-field">
                <label>{t.login.emailLabel}</label>
                <div className="login-input-wrap">
                  <IconEmail />
                  <input
                    type="email"
                    placeholder="tom.exemple@gmail.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="off"
                    required
                  />
                </div>
              </div>

              <div className="login-field">
                <label>{t.login.passwordLabel}</label>
                <div className="login-input-wrap">
                  <IconLock />
                  <input
                    type={showPwd ? "text" : "password"}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    aria-label={showPwd ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                  >
                    {showPwd ? <IconEyeOff /> : <IconEye />}
                  </button>
                </div>
              </div>
            </div>

            <div className="login-actions">
              <div className="login-options">
                <label className="login-remember">
                  <input type="checkbox" />
                  {t.login.remember}
                </label>
                <Link href="/auth/forgot-password">{t.login.forgot}</Link>
              </div>

              {error && (
                <div className="login-error">
                  <IconAlert />
                  <span>{error}</span>
                  {isUnverifiedError && (
                    <button
                      type="button"
                      className="login-resend-link"
                      onClick={handleResendVerification}
                      disabled={resendState !== "idle"}
                    >
                      {resendState === "sending"
                        ? t.login.resendVerificationSending
                        : resendState === "sent"
                        ? t.login.resendVerificationSent
                        : t.login.resendVerification}
                    </button>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="login-btn"
                disabled={loading || !email || !password}
              >
                {loading ? t.login.loading : t.login.submit}
              </button>
            </div>
          </form>

          <div className="login-footer">
            <p>{t.login.noAccount}</p>
            <Link href="/auth/register">{t.login.createAccount}</Link>
          </div>

        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
