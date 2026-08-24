"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const { t } = useLanguage();
  const p = t.dashboard.profile;

  const [form, setForm] = useState({ name: "", phone: "" });

  useEffect(() => {
    if (session?.user?.name) {
      setForm(f => ({ ...f, name: session.user.name }));
    }
  }, [session?.user?.name]);

  const [pwForm, setPwForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [infoMsg, setInfoMsg] = useState<{ type: string; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ type: string; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  async function handleInfoSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setInfoMsg({ type: "error", text: p.errors.nameEmpty });
      return;
    }
    setLoading(true);
    setInfoMsg(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), phone: form.phone }),
      });
      const data = await res.json();
      if (res.ok) {
        await update({ name: form.name.trim() });
        setInfoMsg({ type: "success", text: p.success.profile });
      } else {
        setInfoMsg({ type: "error", text: data.message });
      }
    } catch {
      setInfoMsg({ type: "error", text: p.errors.network });
    } finally {
      setLoading(false);
    }
  }

  async function handlePasswordSave(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwMsg({ type: "error", text: p.errors.noMatch });
      return;
    }
    setPwLoading(true);
    setPwMsg(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: pwForm.currentPassword,
          newPassword: pwForm.newPassword,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
        setPwMsg({ type: "success", text: p.success.password });
      } else {
        setPwMsg({ type: "error", text: data.message });
      }
    } catch {
      setPwMsg({ type: "error", text: p.errors.network });
    } finally {
      setPwLoading(false);
    }
  }

  return (
    <div>
      <h1 className="db-page-title">{p.title}</h1>
      <div className="db-wrapper">

        {/* Personal info */}
        <div className="db-card db-card-narrow">
          <p className="db-section-title">{p.personalInfo}</p>
          <form onSubmit={handleInfoSave} className="db-form">

            <div className="db-form-row">
              <label className="db-form-label">{p.fullName}</label>
              <input
                className="db-form-input"
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                minLength={2}
              />
            </div>

            <div className="db-form-row">
              <label className="db-form-label">{p.email}</label>
              <input
                className="db-form-input db-form-input-disabled"
                type="email"
                value={session?.user?.email || ""}
                disabled
              />
              <span className="db-form-hint">{p.emailHint}</span>
            </div>

            <div className="db-form-row">
              <label className="db-form-label">{p.phone}</label>
              <input
                className="db-form-input"
                type="tel"
                placeholder="ex : +33 6 12 34 56 78"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              />
            </div>

            {infoMsg && (
              <p className={infoMsg.type === "success" ? "db-form-success" : "db-form-error"}>
                {infoMsg.text}
              </p>
            )}

            <button className="db-form-btn" type="submit" disabled={loading}>
              {loading ? p.saving : p.save}
            </button>
          </form>
        </div>

        {/* Password */}
        <div className="db-card db-card-narrow">
          <p className="db-section-title">{p.changePassword}</p>
          <form onSubmit={handlePasswordSave} className="db-form">

            <div className="db-form-row">
              <label className="db-form-label">{p.currentPassword}</label>
              <input
                className="db-form-input"
                type="password"
                value={pwForm.currentPassword}
                onChange={e => setPwForm(f => ({ ...f, currentPassword: e.target.value }))}
                required
              />
            </div>

            <div className="db-form-row">
              <label className="db-form-label">{p.newPassword}</label>
              <input
                className="db-form-input"
                type="password"
                value={pwForm.newPassword}
                onChange={e => setPwForm(f => ({ ...f, newPassword: e.target.value }))}
                required
                minLength={6}
              />
            </div>

            <div className="db-form-row">
              <label className="db-form-label">{p.confirmPassword}</label>
              <input
                className="db-form-input"
                type="password"
                value={pwForm.confirmPassword}
                onChange={e => setPwForm(f => ({ ...f, confirmPassword: e.target.value }))}
                required
              />
            </div>

            {pwMsg && (
              <p className={pwMsg.type === "success" ? "db-form-success" : "db-form-error"}>
                {pwMsg.text}
              </p>
            )}

            <button className="db-form-btn" type="submit" disabled={pwLoading}>
              {pwLoading ? p.changing : p.changeBtn}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
