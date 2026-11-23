import { Children, useEffect, useMemo, useRef, useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import FinmindEnhancements from "./FinmindEnhancements.jsx";
import "./App.css";
const API = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

function AuthScreen({ onLogin, theme, onThemeChange }) {
    const [mode, setMode] = useState("login");
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    async function handleSubmit(event) {
        event.preventDefault();
        setLoading(true);
        setError("");
        setNotice("");
        try {
            const endpoint = mode === "login" ? "/auth/login" : "/auth/signup";
            const response = await fetch(`${API}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    mode === "signup"
                        ? { full_name: fullName.trim(), email: email.trim(), password }
                        : { email: email.trim(), password }
                ),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                const detail = typeof data.detail === "string" ? data.detail : "";
                throw new Error(detail || (mode === "signup" ? "Could not create your account." : "Email or password is incorrect."));
            }
            if (mode === "signup") {
                setMode("login");
                setFullName("");
                setPassword("");
                setNotice("Your account is ready. Sign in to continue.");
                return;
            }
            if (!data.access_token) throw new Error("The server did not return a login token. Please try again.");
            onLogin(data.access_token, email.trim());
        } catch (err) {
            setError(err.message || "Could not connect to FINMIND. Check that the backend is running.");
        } finally {
            setLoading(false);
        }
    }
    async function handleGoogleSuccess(googleResponse) {
        setLoading(true);
        setError("");
        setNotice("");

        try {
            if (!googleResponse.credential) {
                throw new Error("Google did not return an ID token.");
            }

            const response = await fetch(`${API}/auth/google`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    credential: googleResponse.credential,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                throw new Error(
                    typeof data.detail === "string"
                        ? data.detail
                        : "Google sign-in failed. Please try again."
                );
            }

            if (!data.access_token) {
                throw new Error("The server did not return a login token.");
            }

            onLogin(data.access_token, "");
        } catch (err) {
            setError(err.message || "Google sign-in failed.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="auth-shell" data-theme={theme}>
            <div className="auth-glow auth-glow-one" />
            <div className="auth-glow auth-glow-two" />
            <div className="auth-theme-control">
                <span>Appearance</span>
                <Select ariaLabel="Choose theme" value={theme} onChange={(e) => onThemeChange(e.target.value)} className="theme-select">
                    <option value="light">☀ Light</option>
                    <option value="dark">◐ Dark</option>
                    <option value="extra-dark">● Extra dark</option>
                </Select>
            </div>
            <section className="auth-card">
                <div className="auth-door-art" aria-hidden="true">
                    <div className="auth-door-halo" />
                    <div className="auth-door-cash cash-one">₹</div>
                    <div className="auth-door-cash cash-two">₹</div>
                    <div className="auth-door-cash cash-three">✦</div>
                    <svg className="auth-door-svg" viewBox="0 0 220 190" role="img" aria-label="An open door with money symbols">
                        <defs>
                            <linearGradient id="doorFace" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="currentColor" stopOpacity=".96" />
                                <stop offset="100%" stopColor="currentColor" stopOpacity=".72" />
                            </linearGradient>
                            <linearGradient id="doorLight" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stopColor="#c7ef9c" stopOpacity=".92" />
                                <stop offset="100%" stopColor="#7ba94c" stopOpacity=".12" />
                            </linearGradient>
                        </defs>
                        <ellipse cx="115" cy="165" rx="74" ry="7" fill="currentColor" opacity=".12" />
                        <path d="M114 31 L168 45 L168 158 L114 145 Z" fill="url(#doorLight)" stroke="#8ebc61" strokeOpacity=".6" />
                        <path d="M70 39 L116 27 L116 146 L70 158 Z" fill="url(#doorFace)" stroke="currentColor" strokeOpacity=".48" strokeWidth="1.2" />
                        <path d="M78 45 L108 37 L108 139 L78 147 Z" fill="none" stroke="currentColor" strokeOpacity=".15" />
                        <path d="M116 27 L129 34 L129 151 L116 146 Z" fill="#777f72" opacity=".34" />
                        <circle cx="105" cy="95" r="3" fill="#b4d98c" />
                        <path d="M42 165 H182" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.3" strokeLinecap="round" />
                        <rect x="139" y="72" width="18" height="10" rx="2" fill="#b7df8c" transform="rotate(18 139 72)" />
                        <path d="M142 75 l12 4 M144 72 l-1 7 M151 75 l-1 7" stroke="#36502b" strokeOpacity=".65" strokeWidth=".7" />
                        <circle cx="151" cy="105" r="7" fill="#e7c777" stroke="#8f753c" strokeWidth="1" />
                        <circle cx="151" cy="105" r="4" fill="none" stroke="#8f753c" strokeWidth=".8" />
                        <path d="M143 128 l8 -4 l7 5 l-8 4 Z" fill="#b7df8c" />
                    </svg>
                </div>
                <div className="auth-heading">
                    <h1>{mode === "login" ? "Sign in or create\na new account" : "A better relationship\nwith money starts here"}</h1>
                    <p>Your money. Your clarity. Your future.</p>
                </div>
                <div className="auth-mode-switch" role="tablist" aria-label="Authentication mode">
                    <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "selected" : ""} onClick={() => { setMode("login"); setError(""); setNotice(""); }}>Sign in</button>
                    <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "selected" : ""} onClick={() => { setMode("signup"); setError(""); setNotice(""); }}>Create account</button>
                </div>
                <div className="auth-social-stack auth-social-row">
                    <div className="auth-social-button google-login-wrap">
                       <GoogleLogin
  onSuccess={handleGoogleSuccess}
  onError={() => setError("Google sign-in failed. Please try again.")}
  text="continue_with"
  shape="rectangular"
  theme="filled_black"
  width="280"
/>
                    </div>

                </div>
                <div className="auth-divider"><span>OR CONTINUE WITH EMAIL</span></div>
                <form className="auth-form" onSubmit={handleSubmit}>
                    {mode === "signup" && (
                        <label className="auth-label">Full name
                            <input
                                type="text"
                                autoComplete="name"
                                placeholder="Your full name"
                                minLength={2}
                                maxLength={100}
                                required
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                            />
                        </label>
                    )}
                    <label className="auth-label">Email address
                        <input type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    </label>
                    <label className="auth-label">Password
                        <div className="auth-password-wrap">
                            <input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} minLength={mode === "signup" ? 8 : 1} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} />
                            <button type="button" className="auth-show-password" onClick={() => setShowPassword((v) => !v)}>{showPassword ? "Hide" : "Show"}</button>
                        </div>
                    </label>
                    {mode === "login" && <div className="auth-helper-row"><span>Protected with secure authentication</span><span>JWT session</span></div>}
                    {error && <p className="auth-message auth-error" role="alert">{error}</p>}
                    {notice && <p className="auth-message auth-notice" role="status">{notice}</p>}
                    <button className="auth-submit" type="submit" disabled={loading}>{loading ? <><span className="auth-spinner" /> Please wait…</> : mode === "login" ? "Sign in to FINMIND  →" : "Create my account  →"}</button>
                </form>
                <p className="auth-switch-copy">{mode === "login" ? "New to FINMIND?" : "Already have an account?"} <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setNotice(""); }}>{mode === "login" ? "Create an account" : "Sign in instead"}</button></p>
                <div className="auth-security-note"><span>✦</span> Your financial data stays tied to your account. Never share your password.</div>
                <p className="auth-legal">By continuing, you agree to our <span>Terms of Service</span> and <span>Privacy Policy</span>.</p>
            </section>
            <div className="auth-footer"><span>FINMIND</span><span>Build better money habits, one decision at a time.</span></div>
        </main>
    );
}

const money = (value) =>
    new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
    }).format(Number(value) || 0);
const shortMoney = (value) => {
    const n = Number(value) || 0;
    if (Math.abs(n) >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (Math.abs(n) >= 1000) return `₹${(n / 1000).toFixed(1)}k`;
    return money(n);
};
const today = () => new Date().toISOString().slice(0, 10);
const dateLabel = (value) => {
    if (!value) return "No date";
    const d = new Date(`${value}T00:00:00`);
    return Number.isNaN(d.getTime())
        ? value
        : d.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
        });
};
const iconFor = (category = "") => {
    const c = category.toLowerCase();
    if (c.includes("food") || c.includes("grocer")) return "◉";
    if (c.includes("salary") || c.includes("income")) return "↗";
    if (c.includes("travel") || c.includes("transport")) return "↗";
    if (c.includes("shop")) return "◇";
    if (c.includes("health")) return "+";
    if (c.includes("education")) return "▤";
    if (c.includes("rent") || c.includes("home")) return "⌂";
    return "₹";
};
function Icon({ name, size = 17 }) {
    const paths = {
        dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
        accounts: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
        transactions: <><path d="M4 7h15l-4-4" /><path d="M20 17H5l4 4" /></>,
        cashflow: <><path d="M3 3v18h18" /><path d="m6 15 4-5 4 3 6-8" /></>,
        budget: <><rect x="3" y="5" width="18" height="15" rx="2" /><path d="M3 10h18M7 3v4M17 3v4" /></>,
        investments: <><path d="M3 17 9 11l4 4 8-9" /><path d="M15 6h6v6" /></>,
        learning: <><path d="M3 5.5A2.5 2.5 0 0 1 5.5 3H21v16H5.5A2.5 2.5 0 0 0 3 21z" /><path d="M3 5.5v15M7 7h10M7 11h8" /></>,
        support: <><path d="M4 13v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="12" width="4" height="7" rx="2" /><rect x="17" y="12" width="4" height="7" rx="2" /><path d="M17 20h-5" /></>,
        search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
        bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
        plus: <><path d="M12 5v14M5 12h14" /></>,
        arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
        calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
        sparkle: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2z" /><path d="m19 14 1 3 3 1-3 1-1 3-1-3-3-1 3-1z" /></>,
        close: <><path d="m18 6-12 12M6 6l12 12" /></>,
        chevron: <path d="m7 10 5 5 5-5" />,
        "chevron-down": <path d="m7 10 5 5 5-5" />,
        user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>,
        "credit-card": <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="M2.5 10h19M7 15h3" /></>,
        palette: <><circle cx="12" cy="12" r="9" /><circle cx="8" cy="9" r="1" /><circle cx="12" cy="6.5" r="1" /><circle cx="16" cy="9" r="1" /><path d="M12 21c-1.5 0-2.5-1-2.5-2.2S10.5 16 12 16h1.5c1.2 0 2-.8 2-1.8" /></>,
        "help-circle": <><circle cx="12" cy="12" r="9" /><path d="M9.6 9a2.5 2.5 0 1 1 4.2 1.8c-1.2 1-1.8 1.3-1.8 2.7M12 17h.01" /></>,
        "log-out": <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    };
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            {paths[name] || paths.dashboard}
        </svg>
    );
}
function Card({ children, className = "" }) {
    return <section className={`card ${className}`}>{children}</section>;
}
function CardHeading({ title, subtitle, action }) {
    return (
        <div className="card-heading">
            <div>
                <h2>{title}</h2>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {action}
        </div>
    );
}
function Select({ value, onChange, children, ariaLabel = "Select option", className = "" }) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);
    const options = Children.toArray(children)
        .filter((child) => child && child.props)
        .map((child) => ({
            value: String(child.props.value ?? child.props.children),
            label: child.props.children,
            disabled: Boolean(child.props.disabled),
        }));

    useEffect(() => {
        if (!open) return undefined;
        const closeOnOutside = (event) => {
            if (rootRef.current && !rootRef.current.contains(event.target)) setOpen(false);
        };
        const closeOnEscape = (event) => {
            if (event.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", closeOnOutside);
        document.addEventListener("keydown", closeOnEscape);
        return () => {
            document.removeEventListener("pointerdown", closeOnOutside);
            document.removeEventListener("keydown", closeOnEscape);
        };
    }, [open]);

    const selected = options.find((option) => option.value === String(value)) || options[0];

    return (
        <div className={`finmind-select ${open ? "is-open" : ""} ${className}`} ref={rootRef}>
            <button
                type="button"
                className="finmind-select-trigger"
                aria-label={ariaLabel}
                aria-haspopup="listbox"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
                onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        setOpen(true);
                    }
                }}
            >
                <span>{selected?.label ?? value}</span>
                <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 7.5 5 5 5-5" /></svg>
            </button>
            {open && (
                <div className="finmind-select-menu" role="listbox" aria-label={ariaLabel}>
                    {options.map((option) => (
                        <button
                            type="button"
                            role="option"
                            aria-selected={option.value === String(value)}
                            disabled={option.disabled}
                            key={option.value}
                            className={`finmind-select-option ${option.value === String(value) ? "selected" : ""}`}
                            onClick={() => {
                                onChange({ target: { value: option.value } });
                                setOpen(false);
                            }}
                        >
                            <span>{option.label}</span>
                            {option.value === String(value) && <span className="finmind-select-check">✓</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
function CashFlowChart({ transactions, range }) {
    const data = useMemo(() => {
        const days = range === "30d" ? 30 : range === "7d" ? 7 : 14;
        const now = new Date();
        const daysList = Array.from({ length: days }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1 - i));
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
            const daily = transactions.filter((t) => t.transaction_date === key);
            const income = daily.filter((t) => t.transaction_type === "income").reduce((sum, t) => sum + Number(t.amount || 0), 0);
            const expenses = daily.filter((t) => t.transaction_type === "expense").reduce((sum, t) => sum + Number(t.amount || 0), 0);
            return {
                key,
                label: days <= 7
                    ? d.toLocaleDateString("en-IN", { weekday: "short" })
                    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
                income,
                expenses,
                savings: income - expenses,
            };
        });
        return daysList;
    }, [transactions, range]);

    const maxValue = Math.max(1, ...data.flatMap((d) => [d.income, d.expenses]));
    const chartTop = 18;
    const chartBottom = 176;
    const chartHeight = chartBottom - chartTop;
    const plotLeft = 48;
    const plotRight = 692;
    const slot = (plotRight - plotLeft) / data.length;
    const barWidth = Math.max(3, Math.min(data.length > 14 ? 7 : 15, slot * 0.27));
    const gridValues = [1, 0.75, 0.5, 0.25, 0];
    const formatAxis = (value) => {
        if (value >= 100000) return `₹${(value / 100000).toFixed(value % 100000 === 0 ? 0 : 1)}L`;
        if (value >= 1000) return `₹${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}k`;
        return value === 0 ? "₹0" : `₹${Math.round(value)}`;
    };

    return (
        <div className="cash-chart">
            <div className="chart-legend">
                <span><i className="legend-green" /> Income</span>
                <span><i className="legend-orange" /> Expenses</span>
                <span><i className="legend-yellow" /> Net savings</span>
            </div>
            {transactions.length === 0 ? (
                <div className="chart-empty">
                    <div className="empty-chart-icon">↗</div>
                    <strong>Your cash flow starts here</strong>
                    <span>Add a transaction to see your financial activity.</span>
                </div>
            ) : (
                <svg className="cash-chart-svg" viewBox="0 0 700 218" role="img" aria-label="Daily income and expenses chart" preserveAspectRatio="xMidYMid meet">
                    {gridValues.map((fraction, i) => {
                        const y = chartTop + chartHeight * (1 - fraction);
                        return (
                            <g key={fraction}>
                                <line x1={plotLeft} x2={plotRight} y1={y} y2={y} className="chart-gridline" />
                                <text x={plotLeft - 9} y={y + 4} textAnchor="end" className="chart-axis">
                                    {formatAxis(maxValue * fraction)}
                                </text>
                            </g>
                        );
                    })}
                    {data.map((d, i) => {
                        const center = plotLeft + slot * i + slot / 2;
                        const incomeH = (d.income / maxValue) * chartHeight;
                        const expenseH = (d.expenses / maxValue) * chartHeight;
                        const incomeX = center - barWidth - 2;
                        const expenseX = center + 2;
                        const showLabel = data.length <= 7 || (data.length <= 14 ? i % 2 === 0 : i % 5 === 0 || i === data.length - 1);
                        return (
                            <g key={d.key}>
                                {d.income > 0 && <rect x={incomeX} y={chartBottom - incomeH} width={barWidth} height={Math.max(2, incomeH)} rx="3" fill="#9bcf65" className="chart-bar" />}
                                {d.expenses > 0 && <rect x={expenseX} y={chartBottom - expenseH} width={barWidth} height={Math.max(2, expenseH)} rx="3" fill="#e9a16b" className="chart-bar" />}
                                {showLabel && <text x={center} y="202" textAnchor="middle" className="chart-axis">{d.label}</text>}
                                {(d.income > 0 || d.expenses > 0) && (
                                    <title>{`${d.label}: Income ${money(d.income)}, expenses ${money(d.expenses)}, net ${money(d.savings)}`}</title>
                                )}
                            </g>
                        );
                    })}
                </svg>
            )}
            <div className="chart-footnote">
                <span>Based on recorded transactions</span>
                <span>{range === "30d" ? "Last 30 days" : range === "7d" ? "Last 7 days" : "Last 14 days"}</span>
            </div>
        </div>
    );
}
function SpendingBreakdown({ transactions }) {
    const colors = ["#9bcf56", "#f3ad65", "#e8e95a", "#8cbd46", "#b4d879", "#b7c9a0", "#d9ded3"];
    const expenses = useMemo(() => {
        const totals = {};
        transactions
            .filter((t) => t.transaction_type === "expense")
            .forEach((t) => {
                const category = t.category || "Other";
                totals[category] = (totals[category] || 0) + Number(t.amount || 0);
            });
        const total = Object.values(totals).reduce((sum, amount) => sum + amount, 0);
        return Object.entries(totals)
            .map(([name, amount]) => ({
                name,
                amount,
                percentage: total ? (amount / total) * 100 : 0,
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [transactions]);
    return (
        <div className="spending-content">
            {expenses.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-state-icon">₹</span>
                    <p>No expenses recorded yet.</p>
                    <span>Add an expense to see your spending breakdown.</span>
                </div>
            ) : (
                <>
                    <div className="spending-bars">
                        {expenses.slice(0, 6).map((item, i) => (
                            <div className="spending-bar-row" key={item.name}>
                                <div className="spending-bar-label">
                                    <span>{item.name}</span>
                                    <strong>{Math.round(item.percentage)}%</strong>
                                </div>
                                <div className="spending-track">
                                    <div
                                        className="spending-fill"
                                        style={{
                                            width: `${item.percentage}%`,
                                            background: colors[i % colors.length],
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="spending-total">
                        <span>Total recorded expenses</span>
                        <strong>{money(expenses.reduce((sum, item) => sum + item.amount, 0))}</strong>
                    </div>
                </>
            )}
        </div>
    );
}
function HealthGauge({ income, expenses }) {
    const percentage = income > 0
        ? Math.max(0, Math.min(100, Math.round(((income - expenses) / income) * 100)))
        : 0;
    const radius = 68;
    const circumference = Math.PI * radius;
    const offset = circumference * (1 - percentage / 100);
    return (
        <div className="gauge-wrap">
            <svg viewBox="0 0 180 112" className="gauge-svg" aria-label={`Savings rate ${percentage}%`}>
                <path
                    d="M 22 91 A 68 68 0 0 1 158 91"
                    fill="none"
                    stroke="#eef0eb"
                    strokeWidth="17"
                    strokeLinecap="round"
                />
                <path
                    d="M 22 91 A 68 68 0 0 1 158 91"
                    fill="none"
                    stroke="#a2cf60"
                    strokeWidth="17"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
            <div className="gauge-number">{percentage}%</div>
            <div className="gauge-caption">Net income retained</div>
        </div>
    );
}
function TransactionTable({
    transactions,
    compact = false,
    onEdit,
    onDelete,
}) {
    const list = compact ? transactions.slice(0, 5) : transactions;
    if (list.length === 0) {
        return (
            <div className="empty-state">
                <span className="empty-state-icon">↗</span>
                <p>No transactions yet</p>
                <span>Add your first income or expense to populate this table.</span>
            </div>
        );
    }
    return (
        <div className="table-scroll">
            <table className="transactions-table">
                <thead>
                    <tr>
                        <th>TRANSACTION</th>
                        <th>CATEGORY</th>
                        <th>DATE</th>
                        <th>AMOUNT</th>
                        <th>ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map((t) => (
                        <tr key={t.id}>
                            <td>
                                <div className="transaction-cell">
                                    <span className={`transaction-symbol ${t.transaction_type}`}>
                                        {iconFor(t.category)}
                                    </span>
                                    <div className="transaction-description">
                                        <strong>{t.description || t.category || "Transaction"}</strong>
                                        <span>{t.transaction_type === "income" ? "Money received" : "Money spent"}</span>
                                    </div>
                                </div>
                            </td>
                            <td><span className="category-pill">{t.category || "Other"}</span></td>
                            <td className="date-cell">{dateLabel(t.transaction_date)}</td>
                            <td className={`amount-cell ${t.transaction_type}`}>
                                {t.transaction_type === "income" ? "+" : "−"}{money(t.amount)}
                            </td>
                            <td className="transaction-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => onEdit(t)}
                                >
                                    Edit
                                </button>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => onDelete(t.id)}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
function TransactionModal({
    onClose,
    onSubmit,
    saving,
    error,
    token,
    initialTransaction = null,
    editing = false,
}) {
    const [form, setForm] = useState({
        amount: initialTransaction?.amount ?? "",
        transaction_type: initialTransaction?.transaction_type ?? "expense",
        category: initialTransaction?.category ?? "Food",
        description: initialTransaction?.description ?? "",
        transaction_date: initialTransaction?.transaction_date ?? today(),
    });
    
    const [suggestion, setSuggestion] = useState(null);
    const [suggestionLoading, setSuggestionLoading] = useState(false);
    const [suggestionError, setSuggestionError] = useState("");
    const [suggestionDismissed, setSuggestionDismissed] = useState(false);

    useEffect(() => {
        const description = form.description.trim();

        setSuggestion(null);
        setSuggestionError("");
        setSuggestionDismissed(false);

        if (
            form.transaction_type !== "expense" ||
            description.length < 3 ||
            !token
        ) {
            setSuggestionLoading(false);
            return undefined;
        }

        let cancelled = false;

        const timer = setTimeout(async () => {
            setSuggestionLoading(true);

            try {
                const response = await fetch(
                    `${API}/transactions/suggest-category`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                        },
                        body: JSON.stringify({ description }),
                    }
                );

                const data = await response.json().catch(() => ({}));

                if (!response.ok) {
                    throw new Error(
                        typeof data.detail === "string"
                            ? data.detail
                            : "Could not suggest a category."
                    );
                }

                if (!cancelled) {
                    setSuggestion({
                        category: data.suggested_category,
                        confidence: data.confidence,
                    });
                }
            } catch (err) {
                if (!cancelled) {
                    setSuggestionError(
                        err.message || "Category suggestion unavailable."
                    );
                }
            } finally {
                if (!cancelled) {
                    setSuggestionLoading(false);
                }
            }
        }, 500);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [form.description, form.transaction_type, token]);

    const categories = form.transaction_type === "income"
        ? ["Salary", "Freelance", "Investment", "Gift", "Other"]
        : ["Food", "Transport", "Shopping", "Rent", "Health", "Education", "Bills", "Entertainment", "Travel", "Other"];
    const update = (key, value) =>
        setForm((current) => ({ ...current, [key]: value }));
    const submit = async (event) => {
        event.preventDefault();
        const success = await onSubmit({
            ...form,
            amount: Number(form.amount),
        });
        if (success) onClose();
    };
    return (
        <div className="modal-backdrop" onMouseDown={(e) => {
            if (e.target === e.currentTarget) onClose();
        }}>
            <section className="transaction-modal" role="dialog" aria-modal="true" aria-labelledby="transaction-modal-title">
                <div className="modal-heading">
                    <div>
                        <span className="eyebrow">YOUR MONEY, IN FOCUS</span>
                        <h2 id="transaction-modal-title">
                            {editing ? "Edit transaction" : "Add transaction"}
                        </h2>
                        <p>Record money coming in or going out.</p>
                    </div>
                    <button className="icon-button" onClick={onClose} aria-label="Close dialog">
                        <Icon name="close" />
                    </button>
                </div>
                <form onSubmit={submit}>
                    <div className="type-switch">
                        <button
                            type="button"
                            className={form.transaction_type === "expense" ? "selected expense-option" : ""}
                            onClick={() => {
                                update("transaction_type", "expense");
                                update("category", "Food");
                            }}
                        >
                            − Expense
                        </button>
                        <button
                            type="button"
                            className={form.transaction_type === "income" ? "selected income-option" : ""}
                            onClick={() => {
                                update("transaction_type", "income");
                                update("category", "Salary");
                            }}
                        >
                            + Income
                        </button>
                    </div>
                    <label className="form-label">
                        Amount (₹)
                        <input
                            required
                            min="0.01"
                            step="0.01"
                            type="number"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={form.amount}
                            onChange={(e) => update("amount", e.target.value)}
                        />
                    </label>
                    <label className="form-label">
                        Description
                        <input
                            required
                            maxLength="200"
                            placeholder="e.g. Monthly salary"
                            value={form.description}
                            onChange={(e) => update("description", e.target.value)}
                        />
                    </label>
                    <div className="form-row">
                        <label className="form-label">
                            Category
                            <Select
                                value={form.category}
                                onChange={(e) => update("category", e.target.value)}
                                ariaLabel="Transaction category"
                                className="form-category-select"
                            >
                                {categories.map((category) => (
                                    <option key={category} value={category}>{category}</option>
                                ))}
                            </Select>
                        </label>
                        <label className="form-label">
                            Date
                            <input
                                required
                                type="date"
                                value={form.transaction_date}
                                onChange={(e) => update("transaction_date", e.target.value)}
                            />
                        </label>
                    </div>
                    
                    {form.transaction_type === "expense" && (
                        <div
                            style={{
                                marginTop: "-4px",
                                marginBottom: "16px",
                                padding: "12px",
                                border: "1px solid var(--border, #dfe5d8)",
                                borderRadius: "12px",
                                fontSize: "13px",
                            }}
                        >
                            <strong>AI category suggestion</strong>

                            {suggestionLoading && (
                                <p>Analyzing your description...</p>
                            )}

                            {!suggestionLoading && suggestion && (
                                <>
                                    <p style={{ margin: "8px 0" }}>
                                        Suggested:{" "}
                                        <strong>{suggestion.category}</strong>
                                        {" · "}
                                        Model confidence:{" "}
                                        {(
                                            Number(suggestion.confidence) * 100
                                        ).toFixed(1)}%
                                    </p>

                                    {suggestion.category !== form.category &&
                                        !suggestionDismissed && (
                                            <button
                                                type="button"
                                                className="btn-secondary"
                                                onClick={() => {
                                                    update(
                                                        "category",
                                                        suggestion.category
                                                    );
                                                    setSuggestionDismissed(true);
                                                }}
                                            >
                                                Use suggested category
                                            </button>
                                        )}

                                    {suggestion.category === form.category && (
                                        <p style={{ marginBottom: 0 }}>
                                            Your selected category matches the suggestion.
                                        </p>
                                    )}
                                </>
                            )}

                            {!suggestionLoading &&
                                !suggestion &&
                                !suggestionError && (
                                    <p style={{ marginBottom: 0 }}>
                                        Enter an expense description to get a suggestion.
                                    </p>
                                )}

                            {suggestionError && (
                                <p role="status" style={{ marginBottom: 0 }}>
                                    Suggestion unavailable. You can still choose a
                                    category manually.
                                </p>
                            )}

                            <p
                                style={{
                                    marginBottom: 0,
                                    marginTop: "8px",
                                    opacity: 0.7,
                                }}
                            >
                                AI suggestions can be incorrect. Please review
                                the category before saving.
                            </p>
                        </div>
                    )}

                    {error && <div className="form-error">{error}</div>}
                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-primary" disabled={saving}>
                            {saving
                                ? "Saving..."
                                : editing
                                    ? "Update transaction"
                                    : "Save transaction"}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    );
}
function App() {
    const [theme, setTheme] = useState(() => localStorage.getItem("finmind_theme") || "light");
    function changeTheme(nextTheme) {
        setTheme(nextTheme);
        localStorage.setItem("finmind_theme", nextTheme);
    }
    const [transactions, setTransactions] = useState([]);
    const [summary, setSummary] = useState(null);
    const [token, setToken] = useState(
        () => localStorage.getItem("finmind_token") || ""
    );

    const [userEmail, setUserEmail] = useState(
        () => localStorage.getItem("finmind_email") || ""
    );
    const [profile, setProfile] = useState(() => ({
        id: localStorage.getItem("finmind_user_id") || "",
        full_name: localStorage.getItem("finmind_full_name") || "",
        email: localStorage.getItem("finmind_email") || "",
    }));

    // Prefer the name saved by the backend; use the email handle as a fallback.
    const displayName = profile.full_name?.trim()
        || (userEmail
            ? userEmail.split("@")[0]
                .replace(/[._-]+/g, " ")
                .replace(/\s+/g, " ")
                .trim()
                .replace(/\b\w/g, (char) => char.toUpperCase())
            : "Your account");
    const initials = displayName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0].toUpperCase())
        .join("") || "U";

    function handleLogin(newToken, email) {
        localStorage.setItem("finmind_token", newToken);
        localStorage.setItem("finmind_email", email);
        setToken(newToken);
        setUserEmail(email);
    }

    function logout() {
        localStorage.removeItem("finmind_token");
        localStorage.removeItem("finmind_email");
        localStorage.removeItem("finmind_user_id");
        localStorage.removeItem("finmind_full_name");
        setToken("");
        setUserEmail("");
        setProfile({ id: "", full_name: "", email: "" });
        setTransactions([]);
        setSummary(null);
    }
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState(null);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");
    const [range, setRange] = useState("7d");
    const [activePage, setActivePage] = useState("Dashboard");
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [aiQuestion, setAiQuestion] = useState("");
    const [spendingForecast, setSpendingForecast] = useState(null);
    const [unusualSpending, setUnusualSpending] = useState(null);
    const [personalizedInsights, setPersonalizedInsights] = useState([]);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsError, setAnalyticsError] = useState("");
    const [upgradeVisible, setUpgradeVisible] = useState(true);
    const [accountMenuOpen, setAccountMenuOpen] = useState(false);

    function openAddTransaction() {
        setEditingTransaction(null);
        setFormError("");
        setModalOpen(true);
    }
    async function loadData() {
        setLoading(true);
        setApiError("");
        try {
            const [transactionsResponse, summaryResponse] = await Promise.all([
                fetch(`${API}/transactions?skip=0&limit=100&sort_by=date&order=desc`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }),
                fetch(`${API}/transactions/summary`, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }),
            ]);
            if (!transactionsResponse.ok || !summaryResponse.ok) {
                throw new Error("The API returned an error. Check that your backend is running.");
            }
            const transactionData = await transactionsResponse.json();
            const summaryData = await summaryResponse.json();
            setTransactions(
                Array.isArray(transactionData)
                    ? transactionData
                    : transactionData.transactions || []
            );
            setSummary(summaryData);
        } catch (error) {
            setApiError(
                "Cannot connect to FINMIND API. Start the FastAPI backend at 127.0.0.1:8000 and refresh."
            );
            console.error("FINMIND API error:", error);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        if (!token) {
            setSpendingForecast(null);
            setUnusualSpending(null);
            setPersonalizedInsights([]);
            return undefined;
        }
        let cancelled = false;
        const headers = { Authorization: `Bearer ${token}` };
        async function loadAnalytics() {
            setAnalyticsLoading(true);
            setAnalyticsError("");
            try {
                const [forecastResponse, unusualResponse, insightsResponse] = await Promise.all([
                    fetch(`${API}/analytics/spending-forecast`, { headers }),
                    fetch(`${API}/analytics/unusual-spending`, { headers }),
                    fetch(`${API}/analytics/personalized-insights`, { headers }),
                ]);
                if (!forecastResponse.ok || !unusualResponse.ok || !insightsResponse.ok) {
                    throw new Error("One or more analytics endpoints returned an error.");
                }
                const [forecastData, unusualData, insightsData] = await Promise.all([
                    forecastResponse.json(), unusualResponse.json(), insightsResponse.json(),
                ]);
                if (!cancelled) {
                    setSpendingForecast(forecastData);
                    setUnusualSpending(unusualData);
                    setPersonalizedInsights(Array.isArray(insightsData.insights) ? insightsData.insights : []);
                }
            } catch (error) {
                if (!cancelled) setAnalyticsError("Analytics are temporarily unavailable. Check that the backend has the new analytics routes.");
                console.error("FINMIND analytics error:", error);
            } finally {
                if (!cancelled) setAnalyticsLoading(false);
            }
        }
        loadAnalytics();
        return () => { cancelled = true; };
    }, [token, transactions]);

    useEffect(() => {
        let cancelled = false;

        async function loadProfile() {
            if (!token) {
                setProfile({ id: "", full_name: "", email: "" });
                return;
            }

            try {
                const response = await fetch(`${API}/auth/me`, {
                    headers: { Authorization: `Bearer ${token}` },
                });

                if (response.status === 401) {
                    if (!cancelled) logout();
                    return;
                }
                if (!response.ok) {
                    throw new Error("Could not load your account profile.");
                }

                const data = await response.json();
                if (cancelled) return;

                const nextProfile = {
                    id: data.id || "",
                    full_name: data.full_name || "",
                    email: data.email || userEmail,
                };
                setProfile(nextProfile);
                if (nextProfile.id) localStorage.setItem("finmind_user_id", nextProfile.id);
                if (nextProfile.full_name) localStorage.setItem("finmind_full_name", nextProfile.full_name);
                if (nextProfile.email) {
                    localStorage.setItem("finmind_email", nextProfile.email);
                    setUserEmail(nextProfile.email);
                }
            } catch (error) {
                console.error("FINMIND profile error:", error);
            }
        }

        loadProfile();
        return () => {
            cancelled = true;
        };
    }, [token]);

    useEffect(() => {
        if (token) {
            loadData();
        } else {
            setTransactions([]);
            setSummary(null);
            setLoading(false);
        }
    }, [token]);
    async function addTransaction(payload) {
        setSaving(true);
        setFormError("");
        try {
            const response = await fetch(`${API}/transactions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data.detail
                        ? typeof data.detail === "string"
                            ? data.detail
                            : JSON.stringify(data.detail)
                        : "Could not save this transaction."
                );
            }
            await loadData();
            return true;
        } catch (error) {
            setFormError(error.message || "Could not save transaction.");
            return false;
        } finally {
            setSaving(false);
        }
    }
    async function deleteTransaction(id) {
        const confirmed = window.confirm(
            "Are you sure you want to delete this transaction?"
        );
        if (!confirmed) return;
        try {
            const response = await fetch(`${API}/transactions/${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });
            if (!response.ok) {
                throw new Error("Could not delete this transaction.");
            }
            await loadData();
        } catch (error) {
            window.alert(error.message || "Delete failed.");
        }
    }
    async function updateTransaction(payload) {
        if (!editingTransaction) return false;
        setSaving(true);
        setFormError("");
        try {
            const response = await fetch(
                `${API}/transactions/${editingTransaction.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                }
            );
            const data = await response.json();
            if (!response.ok) {
                throw new Error(
                    data.detail
                        ? typeof data.detail === "string"
                            ? data.detail
                            : JSON.stringify(data.detail)
                        : "Could not update this transaction."
                );
            }
            await loadData();
            setEditingTransaction(null);
            return true;
        } catch (error) {
            setFormError(
                error.message || "Could not update transaction."
            );
            return false;
        } finally {
            setSaving(false);
        }
    }
    const totalIncome = Number(summary?.total_income ?? 0);
    const totalExpenses = Number(summary?.total_expenses ?? 0);
    const balance = Number(summary?.balance ?? totalIncome - totalExpenses);
    const transactionCount = Number(summary?.transaction_count ?? transactions.length);
    const filteredTransactions = useMemo(() => {
        return transactions.filter((t) => {
            const matchesSearch = `${t.description || ""} ${t.category || ""}`
                .toLowerCase()
                .includes(search.toLowerCase());
            const matchesType =
                filterType === "all" || t.transaction_type === filterType;
            return matchesSearch && matchesType;
        });
    }, [transactions, search, filterType]);
    const topExpense = useMemo(() => {
        const totals = {};
        transactions
            .filter((t) => t.transaction_type === "expense")
            .forEach((t) => {
                const category = t.category || "Other";
                totals[category] = (totals[category] || 0) + Number(t.amount || 0);
            });
        return Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
    }, [transactions]);
    const insights = useMemo(() => {
        const result = [];
        if (transactions.length === 0) {
            return [
                {
                    title: "Start with your first transaction",
                    description: "Record your income and expenses to unlock personalized spending insights.",
                    tag: "Getting started",
                },
            ];
        }
        if (totalIncome === 0 && totalExpenses > 0) {
            result.push({
                title: "Record your income",
                description: "You have expenses recorded but no income. Add your income for a more complete financial picture.",
                tag: "Suggested action",
            });
        } else if (totalIncome > 0) {
            const rate = ((totalIncome - totalExpenses) / totalIncome) * 100;
            result.push({
                title: rate >= 20 ? "Your recorded cash flow is positive" : "Review your savings rate",
                description: `Your current recorded net balance is ${money(totalIncome - totalExpenses)}. This calculation uses only the transactions entered in FINMIND.`,
                tag: `${Math.round(rate)}% net-to-income`,
            });
        }
        if (topExpense) {
            result.push({
                title: `${topExpense[0]} is your largest expense category`,
                description: `You have recorded ${money(topExpense[1])} in ${topExpense[0]}. Review these entries to decide whether spending changes are needed.`,
                tag: "Spending breakdown",
            });
        }
        if (transactions.length < 5) {
            result.push({
                title: "Build a more complete picture",
                description: "Add more transactions across different days. A small sample may not reflect your normal spending patterns.",
                tag: "Data quality",
            });
        }
        return result;
    }, [transactions, totalIncome, totalExpenses, topExpense]);
    const handleInsightQuestion = (event) => {
        event.preventDefault();
        if (!aiQuestion.trim()) return;
        const answer = `Based on the data currently available in FINMIND: total recorded income is ${money(totalIncome)}, recorded expenses are ${money(totalExpenses)}, and the net balance is ${money(balance)}. ${topExpense
            ? `Your largest recorded expense category is ${topExpense[0]} at ${money(topExpense[1])}.`
            : "Record expenses to identify your largest spending category."
            } This is a rule-based summary of your data, not an external AI financial recommendation.`;
        window.alert(answer);
        setAiQuestion("");
    };
    const pages = ["Dashboard", "Accounts", "Transactions", "Cash flow", "Budget", "Investments", "Learning center", "Support"];

    if (!token) {
        return <AuthScreen onLogin={handleLogin} theme={theme} onThemeChange={changeTheme} />;
    }

    return (
        <div className="finmind-app" data-theme={theme}>
            <aside className="sidebar">
                <a
                    href="#dashboard"
                    className="brand-logo"
                    onClick={() => setActivePage("Dashboard")}
                >
                    <span className="brand-wordmark" aria-label="FINMIND">FINMIND<span>.</span></span>
                </a>
                <div className="nav-caption">WORKSPACE</div>
                <nav className="sidebar-nav">
                    {pages.map((page) => {
                        const iconMap = {
                            Dashboard: "dashboard",
                            Accounts: "accounts",
                            Transactions: "transactions",
                            "Cash flow": "cashflow",
                            Budget: "budget",
                            Investments: "investments",
                            "Learning center": "learning",
                            Support: "support",
                        };
                        return (
                            <button
                                key={page}
                                className={`nav-item ${activePage === page ? "active" : ""}`}
                                onClick={() => setActivePage(page)}
                            >
                                <Icon name={iconMap[page]} />
                                <span>{page}</span>
                            </button>
                        );
                    })}
                </nav>
                <div className="sidebar-bottom">
                    {upgradeVisible && (
                        <div className="upgrade-card">
                            <div className="upgrade-symbol">✦</div>
                            <button type="button" className="upgrade-close" aria-label="Dismiss upgrade card" onClick={() => setUpgradeVisible(false)}>×</button>
                            <h3>Upgrade to Pro</h3>
                            <p>Unlock deeper insights and clearer financial reports.</p>
                            <button type="button" className="upgrade-button" onClick={() => window.alert("Pro features are not configured yet.")}>
                                Explore Pro <span>→</span>
                            </button>
                        </div>
                    )}
                </div>
            </aside>
            <main className="main-area">
                <header className="topbar">
                    <label className="search-box">
                        <Icon name="search" size={16} />
                        <input
                            type="search"
                            placeholder="Quick search transactions..."
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setActivePage("Transactions");
                            }}
                        />
                    </label>
                    <div className="topbar-actions">
                        <button className="top-icon-button" aria-label="Notifications" onClick={() => window.alert("No new notifications.")}>
                            <Icon name="bell" />
                        </button>
                        <div className="account-menu-wrap">
                            <button
                                type="button"
                                className="top-user account-menu-trigger"
                                aria-haspopup="menu"
                                aria-expanded={accountMenuOpen}
                                onClick={() => setAccountMenuOpen((open) => !open)}
                            >
                                <span className="user-avatar small" aria-label={`${displayName} avatar`}>{initials}</span>
                                <span className="account-trigger-copy">
                                    <strong>{displayName}</strong>
                                    <span>Personal finance</span>
                                </span>
                                <Icon name="chevron-down" size={14} />
                            </button>
                            {accountMenuOpen && (
                                <>
                                    <button
                                        type="button"
                                        className="account-menu-dismiss"
                                        aria-label="Close account menu"
                                        onClick={() => setAccountMenuOpen(false)}
                                    />
                                    <div className="account-dropdown" role="menu">
                                        <div className="account-dropdown-header">
                                            <span className="user-avatar" aria-label={`${displayName} avatar`}>{initials}</span>
                                            <div>
                                                <strong>{displayName}</strong>
                                                <span>Personal finance account</span>
                                            </div>
                                        </div>
                                        <button type="button" className="account-menu-item" role="menuitem" onClick={() => { setAccountMenuOpen(false); window.alert("Profile settings are coming soon."); }}>
                                            <Icon name="user" size={16} /> <span>Profile</span>
                                        </button>
                                        <button type="button" className="account-menu-item" role="menuitem" onClick={() => { setAccountMenuOpen(false); window.alert("Subscription options are coming soon."); }}>
                                            <Icon name="credit-card" size={16} /> <span>Subscription</span><em>PRO</em>
                                        </button>
                                        <div className="account-menu-settings">
                                            <div className="account-menu-item static-item"><Icon name="palette" size={16} /><span>Appearance</span></div>
                                            <Select ariaLabel="Choose theme" value={theme} onChange={(e) => changeTheme(e.target.value)} className="theme-select">
                                                <option value="light">Light</option>
                                                <option value="dark">Dark</option>
                                                <option value="extra-dark">Extra dark</option>
                                            </Select>
                                        </div>
                                        <button type="button" className="account-menu-item" role="menuitem" onClick={() => { setAccountMenuOpen(false); window.alert("Help center is coming soon."); }}>
                                            <Icon name="help-circle" size={16} /> <span>Help center</span>
                                        </button>
                                        <div className="account-menu-divider" />
                                        <button type="button" className="account-menu-item signout-item" role="menuitem" onClick={() => { setAccountMenuOpen(false); logout(); }}>
                                            <Icon name="log-out" size={16} /> <span>Sign out</span>
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <button type="button" className="add-widget-button" onClick={openAddTransaction}>
                            <Icon name="plus" size={15} /> Add transaction
                        </button>
                    </div>
                </header>
                {apiError && (
                    <div className="api-banner">
                        <span>{apiError}</span>
                        <button onClick={loadData}>Retry</button>
                    </div>
                )}
                <div className="page-heading">
                    <div>
                        <span className="eyebrow">PERSONAL FINANCE</span>
                        <h1>
                            {activePage === "Dashboard"
                                ? "Financial overview"
                                : activePage === "Transactions"
                                    ? "All transactions"
                                    : activePage}
                        </h1>
                        <p>Understand your money. Make smarter decisions.</p>
                    </div>
                    <div className="heading-actions">
                        <Select value={range} onChange={(e) => setRange(e.target.value)}>
                            <option value="7d">7 days</option>
                            <option value="14d">14 days</option>
                            <option value="30d">30 days</option>
                        </Select>
                        <button type="button" className="btn-primary" onClick={openAddTransaction}>
                            <Icon name="plus" size={15} /> Add transaction
                        </button>
                    </div>
                </div>
                {!loading && <FinmindEnhancements
                    userKey={profile.id || userEmail || "guest"}
                    transactions={transactions}
                    totalIncome={totalIncome}
                    totalExpenses={totalExpenses}
                    balance={balance}
                    activePage={activePage}
                    setActivePage={setActivePage}
                    onAddTransaction={openAddTransaction}
                    theme={theme}
                />}
                {loading ? (
                    <div className="loading-panel">
                        <span className="loading-spinner" />
                        <p>Loading your financial overview...</p>
                    </div>
                ) : (
                    <>
                        {activePage === "Dashboard" ? (
                            <div className="overview-layout">
                                <div className="metrics-row" aria-label="Financial summary">
                                    <div className="metric-card metric-income">
                                        <span>Total income</span><strong>{money(totalIncome)}</strong>
                                        <small>↗ Recorded money received</small>
                                        <i aria-hidden="true"><Icon name="arrow" size={17} /></i>
                                    </div>
                                    <div className="metric-card metric-expense">
                                        <span>Total expenses</span><strong>{money(totalExpenses)}</strong>
                                        <small>↘ Recorded money spent</small>
                                        <i aria-hidden="true"><Icon name="arrow" size={17} /></i>
                                    </div>
                                    <div className="metric-card metric-balance">
                                        <span>Saved balance</span><strong>{money(balance)}</strong>
                                        <small>{balance >= 0 ? "↗" : "↘"} Income minus expenses</small>
                                        <i aria-hidden="true"><Icon name="dashboard" size={17} /></i>
                                    </div>
                                </div>
                                <div className="primary-column">
                                    <Card className="cash-flow-card">
                                        <CardHeading
                                            title="Cash flow"
                                            subtitle="Income and expenses from your recorded transactions"
                                            action={<Select value={range} onChange={(e) => setRange(e.target.value)}>
                                                <option value="7d">7 days</option>
                                                <option value="14d">14 days</option>
                                                <option value="30d">30 days</option>
                                            </Select>}
                                        />
                                        <CashFlowChart transactions={transactions} range={range} />
                                    </Card>
                                    <div className="lower-grid">
                                        <Card>
                                            <CardHeading
                                                title="Cost analysis"
                                                subtitle="Spending by category"
                                            />
                                            <SpendingBreakdown transactions={transactions} />
                                        </Card>
                                        <Card>
                                            <CardHeading
                                                title="Financial health"
                                                subtitle="Net balance compared with income"
                                            />
                                            <HealthGauge income={totalIncome} expenses={totalExpenses} />
                                            <div className="health-footer">
                                                <span>Income</span><strong>{money(totalIncome)}</strong>
                                                <span>Expenses</span><strong>{money(totalExpenses)}</strong>
                                            </div>
                                        </Card>
                                        <Card className="goal-card">
                                            <CardHeading title="Goal tracker" subtitle="Plan your next financial milestone" />
                                            <div className="goal-placeholder">
                                                <div className="goal-illustration">◈</div>
                                                <div>
                                                    <strong>Emergency fund</strong>
                                                    <p>Set a savings target and track progress here.</p>
                                                </div>
                                            </div>
                                            <div className="goal-note">
                                                Goal tracking is a visual placeholder and does not yet save targets.
                                            </div>
                                        </Card>
                                    </div>
                                    <Card className="transaction-card">
                                        <CardHeading
                                            title={activePage === "Transactions" ? "All transactions" : "Transaction history"}
                                            subtitle={`${filteredTransactions.length} recorded entries`}
                                            action={<button className="text-button" onClick={() => setActivePage("Transactions")}>View all →</button>}
                                        />
                                        <div className="table-filters">
                                            <label className="mini-search">
                                                <Icon name="search" size={14} />
                                                <input
                                                    placeholder="Search transactions"
                                                    value={search}
                                                    onChange={(e) => setSearch(e.target.value)}
                                                />
                                            </label>
                                            <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                                                <option value="all">All types</option>
                                                <option value="income">Income</option>
                                                <option value="expense">Expenses</option>
                                            </Select>
                                        </div>
                                        <TransactionTable
                                            transactions={filteredTransactions}
                                            compact={activePage !== "Transactions"}
                                            onEdit={(transaction) => {
                                                setEditingTransaction(transaction);
                                                setFormError("");
                                                setModalOpen(true);
                                            }}
                                            onDelete={deleteTransaction}
                                        />
                                    </Card>
                                </div>
                                <aside className="right-column">
                                    <Card className="insights-card">
                                        <CardHeading
                                            title="AI insights"
                                            subtitle="Observations based on your records"
                                            action={<span className="ai-sparkle"><Icon name="sparkle" size={16} /></span>}
                                        />
                                        <div className="insights-list">
                                            {(personalizedInsights.length ? personalizedInsights : insights).map((insight, index) => (
                                                <div className="insight-item" key={`${insight.title}-${index}`}>
                                                    <span className="insight-number">{String(index + 1).padStart(2, "0")}</span>
                                                    <div>
                                                        <strong>{insight.title}</strong>
                                                        <p>{insight.description}</p>
                                                        <span className="insight-tag">{insight.tag}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <form className="insight-question" onSubmit={handleInsightQuestion}>
                                            <Icon name="sparkle" size={15} />
                                            <input
                                                value={aiQuestion}
                                                onChange={(e) => setAiQuestion(e.target.value)}
                                                placeholder="Ask about your finances..."
                                            />
                                            <button type="submit" aria-label="Submit financial question">→</button>
                                        </form>
                                        <p className="insight-disclaimer">
                                            Rule-based insights only. This is not an external AI service or financial advice.
                                        </p>
                                    </Card>
                                    <Card className="insights-card">
                                        <CardHeading title="Spending prediction" subtitle="Next 30 days · baseline estimate" />
                                        {analyticsLoading && !spendingForecast ? (
                                            <p>Calculating forecast…</p>
                                        ) : spendingForecast ? (
                                            <div className="insights-list">
                                                <div className="insight-item">
                                                    <span className="insight-number">↗</span>
                                                    <div>
                                                        <strong>{money(spendingForecast.predicted_expenses_next_30_days)}</strong>
                                                        <p>Estimated spending for the next 30 days, based on the most recent 30 days.</p>
                                                        <span className="insight-tag">Data quality: {spendingForecast.data_quality}</span>
                                                        <p>{spendingForecast.note}</p>
                                                        {spendingForecast.change_vs_previous_30_days_pct !== null && (
                                                            <p>Change vs. previous 30 days: {spendingForecast.change_vs_previous_30_days_pct}%</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ) : <p>{analyticsError || "Forecast unavailable."}</p>}
                                    </Card>
                                    <Card className="insights-card">
                                        <CardHeading title="Unusual spending" subtitle="Compared with your own category history" />
                                        {analyticsLoading && !unusualSpending ? (
                                            <p>Checking transactions…</p>
                                        ) : unusualSpending ? (
                                            unusualSpending.alerts.length ? (
                                                <div className="insights-list">
                                                    {unusualSpending.alerts.slice(0, 5).map((alert) => (
                                                        <div className="insight-item" key={alert.transaction_id}>
                                                            <span className="insight-number">!</span>
                                                            <div>
                                                                <strong>{alert.category}: {money(alert.amount)}</strong>
                                                                <p>{alert.message} {alert.description} · {alert.date}</p>
                                                                <span className="insight-tag">Personal threshold: {money(alert.threshold)}</span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p>No unusual expenses flagged from the available history. Categories with too little history are not scored.</p>
                                            )
                                        ) : <p>{analyticsError || "Unusual-spending detection unavailable."}</p>}
                                        {unusualSpending && <p className="insight-disclaimer">{unusualSpending.note}</p>}
                                    </Card>
                                    <Card className="my-card">
                                        <CardHeading
                                            title="My card"
                                            subtitle="Quick actions"
                                            action={<span className="demo-label">DEMO</span>}
                                        />
                                        <div className="bank-card">
                                            <div className="bank-card-top">
                                                <span>FINMIND</span>
                                                <strong>VISA</strong>
                                            </div>
                                            <div className="chip">▦</div>
                                            <div className="card-number">•••• &nbsp; •••• &nbsp; •••• &nbsp; 7890</div>
                                            <div className="bank-card-footer">
                                                <span>FINMIND USER</span>
                                                <span>03/30</span>
                                            </div>
                                        </div>
                                        <div className="quick-actions">
                                            {[
                                                ["Top up", "＋"],
                                                ["Send", "↗"],
                                                ["Request", "↓"],
                                                ["History", "◷"],
                                            ].map(([label, icon]) => (
                                                <button
                                                    className="quick-action"
                                                    key={label}
                                                    onClick={() => label === "History" ? setActivePage("Transactions") : window.alert(`${label} is a demo action. Banking transfers are not connected.`)}
                                                >
                                                    <span>{icon}</span>
                                                    <small>{label}</small>
                                                </button>
                                            ))}
                                        </div>
                                    </Card>
                                    <Card className="recent-card">
                                        <CardHeading
                                            title="Recent activity"
                                            subtitle="Latest recorded transactions"
                                            action={<button className="text-button" onClick={() => setActivePage("Transactions")}>All →</button>}
                                        />
                                        <div className="recent-list">
                                            {transactions.slice(0, 5).length === 0 ? (
                                                <p className="recent-empty">Your recent activity will appear here.</p>
                                            ) : transactions.slice(0, 5).map((t) => (
                                                <div className="recent-row" key={t.id}>
                                                    <span className={`recent-icon ${t.transaction_type}`}>
                                                        {iconFor(t.category)}
                                                    </span>
                                                    <div className="recent-details">
                                                        <strong>{t.description || t.category}</strong>
                                                        <span>{dateLabel(t.transaction_date)}</span>
                                                    </div>
                                                    <strong className={`recent-amount ${t.transaction_type}`}>
                                                        {t.transaction_type === "income" ? "+" : "−"}{shortMoney(t.amount)}
                                                    </strong>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                </aside>
                            </div>
                        ) : activePage === "Transactions" ? (
                            <div className="page-content transactions-page">
                                <Card className="transaction-card">
                                    <CardHeading
                                        title="All transactions"
                                        subtitle={`${filteredTransactions.length} recorded entries`}
                                        action={<button type="button" className="btn-primary" onClick={openAddTransaction}><Icon name="plus" size={15} /> Add transaction</button>}
                                    />
                                    <div className="table-filters">
                                        <label className="mini-search">
                                            <Icon name="search" size={14} />
                                            <input placeholder="Search transactions" value={search} onChange={(e) => setSearch(e.target.value)} />
                                        </label>
                                        <Select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                                            <option value="all">All types</option>
                                            <option value="income">Income</option>
                                            <option value="expense">Expenses</option>
                                        </Select>
                                    </div>
                                    <TransactionTable
                                        transactions={filteredTransactions}
                                        compact={false}
                                        onEdit={(transaction) => { setEditingTransaction(transaction); setFormError(""); setModalOpen(true); }}
                                        onDelete={deleteTransaction}
                                    />
                                </Card>
                            </div>
                        ) : activePage === "Cash flow" ? (
                            <div className="page-content feature-page">
                                <Card className="cash-flow-card">
                                    <CardHeading title="Cash flow analysis" subtitle="Income and expenses from your recorded transactions" action={<Select value={range} onChange={(e) => setRange(e.target.value)}><option value="7d">7 days</option><option value="14d">14 days</option><option value="30d">30 days</option></Select>} />
                                    <CashFlowChart transactions={transactions} range={range} />
                                </Card>
                                <div className="lower-grid">
                                    <Card><CardHeading title="Income" subtitle="Total recorded money received" /><h2>{money(totalIncome)}</h2></Card>
                                    <Card><CardHeading title="Expenses" subtitle="Total recorded money spent" /><h2>{money(totalExpenses)}</h2></Card>
                                    <Card><CardHeading title="Net cash flow" subtitle="Income minus expenses" /><h2>{money(balance)}</h2></Card>
                                </div>
                            </div>
                        ) : activePage === "Accounts" ? (
                            <div className="page-content feature-page">
                                <div className="lower-grid">
                                    <Card><CardHeading title="Account overview" subtitle="Your current FINMIND balance" /><h2>{money(balance)}</h2><p>Calculated from recorded income and expenses.</p></Card>
                                    <Card><CardHeading title="Total money received" subtitle="Across all recorded transactions" /><h2>{money(totalIncome)}</h2></Card>
                                    <Card><CardHeading title="Total money spent" subtitle="Across all recorded transactions" /><h2>{money(totalExpenses)}</h2></Card>
                                </div>
                                <Card><CardHeading title="Account activity" subtitle="Transactions that affect your balance" /><TransactionTable transactions={filteredTransactions} compact={false} onEdit={(transaction) => { setEditingTransaction(transaction); setFormError(""); setModalOpen(true); }} onDelete={deleteTransaction} /></Card>
                                <p className="insight-disclaimer">Bank connections and multiple account management are not connected yet. These figures are based on your recorded transactions.</p>
                            </div>
                        ) : activePage === "Budget" ? (
                            <div className="page-content feature-page">
                                <div className="lower-grid">
                                    <Card><CardHeading title="Monthly spending" subtitle="Total expenses currently recorded" /><h2>{money(totalExpenses)}</h2><p>Use this as a starting point for setting a budget.</p></Card>
                                    <Card><CardHeading title="Remaining balance" subtitle="Income minus recorded expenses" /><h2>{money(balance)}</h2></Card>
                                    <Card><CardHeading title="Top expense category" subtitle="Based on your recorded data" /><h2>{topExpense ? topExpense[0] : "No data yet"}</h2><p>{topExpense ? money(topExpense[1]) : "Add expense transactions to see a category summary."}</p></Card>
                                </div>
                                <Card><CardHeading title="Budget planner" subtitle="Budget limits and progress tracking" /><p>Budget limits are not saved yet. This page currently summarizes your actual transactions so you can plan your next budget.</p><button className="btn-primary" onClick={() => setActivePage("Transactions")}>Review transactions</button></Card>
                            </div>
                        ) : activePage === "Investments" ? (
                            <div className="page-content feature-page">
                                <div className="lower-grid">
                                    <Card><CardHeading title="Investment portfolio" subtitle="Portfolio tracking status" /><h2>Not connected</h2><p>Investment accounts and market prices are not connected to FINMIND yet.</p></Card>
                                    <Card><CardHeading title="Financial snapshot" subtitle="Your recorded cash position" /><h2>{money(balance)}</h2><p>This is your recorded net balance, not an investment valuation.</p></Card>
                                </div>
                                <Card><CardHeading title="Next step" subtitle="Prepare your investment records" /><p>Track investments only after adding verified purchase values, dates, and quantities. No investment returns are calculated on this demo page.</p></Card>
                            </div>
                        ) : activePage === "Learning center" ? (
                            <div className="page-content feature-page">
                                <div className="lower-grid">
                                    <Card><CardHeading title="Budgeting basics" subtitle="Build a spending plan" /><p>List essential expenses first, set realistic limits, and compare actual spending with your plan each week.</p></Card>
                                    <Card><CardHeading title="Emergency fund" subtitle="Prepare for unexpected costs" /><p>Estimate essential monthly costs and work toward a cash reserve that fits your circumstances.</p></Card>
                                    <Card><CardHeading title="Understand cash flow" subtitle="Know what comes in and goes out" /><p>Review income, expenses, and the difference between them before making financial decisions.</p></Card>
                                </div>
                            </div>
                        ) : (
                            <div className="page-content feature-page">
                                <Card><CardHeading title="FINMIND support" subtitle="Help and project status" /><p>For this prototype, support is available inside the app interface. API-backed transaction features are connected; bank transfers, bank linking, and external AI services are not configured.</p><p>If something is not working, check the frontend and backend terminals for the error message.</p><button className="btn-primary" onClick={() => setActivePage("Dashboard")}>Back to dashboard</button></Card>
                            </div>
                        )}
                        <footer className="dashboard-footer">
                            <span>FINMIND · Personal financial intelligence</span>
                            <span>{transactionCount} recorded transactions · Data from your API</span>
                        </footer>
                    </>
                )}
            </main>
            {modalOpen && (
                <TransactionModal
                    token = {token}
                    onClose={() => {
                        setModalOpen(false);
                        setEditingTransaction(null);
                        setFormError("");
                    }}
                    onSubmit={
                        editingTransaction ? updateTransaction : addTransaction
                    }
                    saving={saving}
                    error={formError}
                    initialTransaction={editingTransaction}
                    editing={Boolean(editingTransaction)}
                />
            )}
        </div>
    );
}
export default App;
