import { useEffect, useMemo, useState } from "react";
import "./FinmindEnhancements.css";

const INR = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(value) || 0);
const monthKey = () => new Date().toISOString().slice(0, 7);
const todayKey = () => new Date().toISOString().slice(0, 10);
const readJSON = (key, fallback) => { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback; } catch { return fallback; } };

export default function FinmindEnhancements({ userKey = "guest", transactions = [], totalIncome = 0, totalExpenses = 0, balance = 0, activePage = "Dashboard", setActivePage = () => {}, onAddTransaction = () => {}, theme = "light" }) {
  const storageKey = `finmind_features_${userKey || "guest"}`;
  const [settings, setSettings] = useState(() => readJSON(storageKey, { monthlyBudget: 8000, monthlySavings: 1000, goalName: "Emergency fund", goalTarget: 12000, goalSaved: 0, hiddenCards: [], onboardingDone: false, streakStart: todayKey(), challengeDone: false }));
  const [showPalette, setShowPalette] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [setupBudget, setSetupBudget] = useState(String(settings.monthlyBudget || 8000));
  const [setupGoal, setSetupGoal] = useState(settings.goalName || "Emergency fund");
  const [setupTarget, setSetupTarget] = useState(String(settings.goalTarget || 12000));
  const [goalContribution, setGoalContribution] = useState("");
  const [goalWithdrawal, setGoalWithdrawal] = useState("");
  const [goalEditMode, setGoalEditMode] = useState(false);
  const [goalSavedEdit, setGoalSavedEdit] = useState(String(settings.goalSaved ?? 0));
  const [goalTargetEdit, setGoalTargetEdit] = useState(String(settings.goalTarget ?? 12000));
  const [goalNameEdit, setGoalNameEdit] = useState(settings.goalName || "Emergency fund");

  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(settings)); }, [settings, storageKey]);
  useEffect(() => { if (!settings.onboardingDone) setShowSetup(true); }, [settings.onboardingDone]);
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setShowPalette(true); setPaletteQuery(""); }
      if (event.key === "Escape") { setShowPalette(false); setShowCustomize(false); setShowReport(false); setShowSetup(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const currentMonthTransactions = useMemo(() => transactions.filter((t) => String(t.transaction_date || "").slice(0, 7) === monthKey()), [transactions]);
  const monthIncome = currentMonthTransactions.filter((t) => t.transaction_type === "income").reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const monthExpenses = currentMonthTransactions.filter((t) => t.transaction_type === "expense").reduce((sum, t) => sum + Number(t.amount || 0), 0);
  const flexibleSpend = Math.max(0, Number(settings.monthlyBudget || 0) - monthExpenses - Number(settings.monthlySavings || 0));
  const budgetUsed = Number(settings.monthlyBudget) > 0 ? Math.min(100, (monthExpenses / Number(settings.monthlyBudget)) * 100) : 0;
  const budgetRemaining = Number(settings.monthlyBudget || 0) - monthExpenses;
  const recentDays = new Set(transactions.filter((t) => t.transaction_type === "expense").map((t) => t.transaction_date).filter(Boolean));
  const daysLogged = recentDays.size;
  const topCategory = useMemo(() => {
    const totals = {};
    currentMonthTransactions.filter((t) => t.transaction_type === "expense").forEach((t) => { totals[t.category || "Other"] = (totals[t.category || "Other"] || 0) + Number(t.amount || 0); });
    return Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
  }, [currentMonthTransactions]);

  const update = (patch) => setSettings((current) => ({ ...current, ...patch }));
  const go = (page) => { setActivePage(page); setShowPalette(false); setPaletteQuery(""); };
  const commands = [
    { label: "Dashboard", detail: "Overview and safe-to-spend", action: () => go("Dashboard") },
    { label: "Transactions", detail: "Search and manage entries", action: () => go("Transactions") },
    { label: "Cash flow", detail: "Explore income and expenses", action: () => go("Cash flow") },
    { label: "Budget", detail: "Review budget progress", action: () => go("Budget") },
    { label: "Add expense", detail: "Open transaction form", action: () => { setShowPalette(false); onAddTransaction(); } },
    { label: "Monthly recap", detail: "View and export this month", action: () => { setShowPalette(false); setShowReport(true); } },
    { label: "Customize dashboard", detail: "Choose visible cards", action: () => { setShowPalette(false); setShowCustomize(true); } },
  ].filter((item) => `${item.label} ${item.detail}`.toLowerCase().includes(paletteQuery.toLowerCase()));

  const exportCSV = () => {
    const rows = [["Date", "Type", "Category", "Description", "Amount"], ...currentMonthTransactions.map((t) => [t.transaction_date, t.transaction_type, t.category, t.description, t.amount])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const link = document.createElement("a"); link.href = url; link.download = `finmind-monthly-recap-${monthKey()}.csv`; link.click(); URL.revokeObjectURL(url);
  };
  const visible = (name) => !settings.hiddenCards.includes(name);
  const toggleCard = (name) => update({ hiddenCards: visible(name) ? [...settings.hiddenCards, name] : settings.hiddenCards.filter((item) => item !== name) });

  return <>
    {activePage === "Dashboard" && <section className="fm-feature-stack">
      <div className="fm-hero-card">
        <div className="fm-hero-copy"><span className="fm-eyebrow">YOUR MONTH AT A GLANCE</span><h2>Money clarity starts here.</h2><p>Based on the transactions and budget you have entered in FINMIND.</p><div className="fm-hero-value">{INR(flexibleSpend)} <span>safe-to-spend estimate</span></div><div className="fm-hero-actions"><button type="button" onClick={onAddTransaction}>＋ Add transaction</button><button type="button" className="fm-hero-secondary" onClick={() => setShowReport(true)}>View monthly recap ↗</button></div></div>
        <div className="fm-hero-ring" style={{ "--fm-progress": `${budgetUsed}%` }}><div><strong>{Math.round(budgetUsed)}%</strong><span>budget used</span></div></div>
        <div className="fm-hero-bottom"><span>Monthly budget <strong>{INR(settings.monthlyBudget)}</strong></span><span>Spent <strong>{INR(monthExpenses)}</strong></span><span>Planned savings <strong>{INR(settings.monthlySavings)}</strong></span></div>
      </div>
      <div className="fm-feature-toolbar"><div><span className="fm-eyebrow">PERSONAL MONEY TOOLS</span><h3>Your money toolkit</h3></div><button type="button" className="fm-outline-button" onClick={() => setShowCustomize(true)}>⚙ Customize dashboard</button><button type="button" className="fm-command-hint" onClick={() => setShowPalette(true)}>⌘ K <span>Quick actions</span></button></div>
      <div className="fm-feature-grid">
        {visible("budget") && <article className="fm-feature-card"><div className="fm-card-top"><span className="fm-feature-icon mint">◷</span><span className={`fm-status ${budgetUsed >= 100 ? "danger" : budgetUsed >= 80 ? "warn" : "good"}`}>{budgetUsed >= 100 ? "Limit reached" : budgetUsed >= 80 ? "Near limit" : "On track"}</span></div><h3>Monthly budget</h3><div className="fm-feature-number">{INR(budgetRemaining)}</div><p>left from {INR(settings.monthlyBudget)} planned</p><div className="fm-progress"><span style={{ width: `${budgetUsed}%` }} /></div><div className="fm-card-foot"><span>{INR(monthExpenses)} spent</span><button onClick={() => go("Budget")}>Manage budget ↗</button></div><button className="fm-text-action" onClick={() => setShowSetup(true)}>Edit plan</button></article>}
        {visible("goal") && <article className="fm-feature-card"><div className="fm-card-top"><span className="fm-feature-icon violet">◇</span><span className="fm-status good">Goal tracker</span></div><h3>{settings.goalName || "Savings goal"}</h3><div className="fm-feature-number">{INR(settings.goalSaved)}</div><p>of {INR(settings.goalTarget)} saved</p><div className="fm-progress violet-progress"><span style={{ width: `${Math.min(100, Number(settings.goalTarget) ? Number(settings.goalSaved) / Number(settings.goalTarget) * 100 : 0)}%` }} /></div><div className="fm-card-foot"><span>{Math.round(Number(settings.goalTarget) ? Number(settings.goalSaved) / Number(settings.goalTarget) * 100 : 0)}% complete</span><button type="button" onClick={() => { setGoalEditMode((current) => !current); setGoalSavedEdit(String(settings.goalSaved ?? 0)); setGoalTargetEdit(String(settings.goalTarget ?? 12000)); setGoalNameEdit(settings.goalName || "Emergency fund"); }}>{goalEditMode ? "Cancel edit" : "Edit goal"}</button></div>
          {goalEditMode && <div className="fm-goal-edit">
            <label>Goal name<input value={goalNameEdit} maxLength={60} onChange={(e) => setGoalNameEdit(e.target.value)} /></label>
            <label>Current saved (₹)<input type="number" min="0" value={goalSavedEdit} onChange={(e) => setGoalSavedEdit(e.target.value)} /></label>
            <label>Target amount (₹)<input type="number" min="1" value={goalTargetEdit} onChange={(e) => setGoalTargetEdit(e.target.value)} /></label>
            <button type="button" onClick={() => { const saved = Math.max(0, Number(goalSavedEdit) || 0); const target = Math.max(1, Number(goalTargetEdit) || 1); update({ goalName: goalNameEdit.trim() || "Savings goal", goalSaved: saved, goalTarget: target }); setGoalEditMode(false); }}>Save changes</button>
          </div>}
          <div className="fm-inline-form"><input aria-label="Add savings contribution" type="number" min="1" value={goalContribution} onChange={(e) => setGoalContribution(e.target.value)} placeholder="Add savings ₹"/><button type="button" onClick={() => { const amount = Number(goalContribution); if (amount > 0) { update({ goalSaved: Number(settings.goalSaved || 0) + amount }); setGoalContribution(""); } }}>Add</button></div>
          <div className="fm-inline-form fm-withdraw-form"><input aria-label="Withdraw from savings goal" type="number" min="1" max={settings.goalSaved} value={goalWithdrawal} onChange={(e) => setGoalWithdrawal(e.target.value)} placeholder="Withdraw from fund ₹"/><button type="button" disabled={!goalWithdrawal || Number(goalWithdrawal) <= 0 || Number(goalWithdrawal) > Number(settings.goalSaved)} onClick={() => { const amount = Number(goalWithdrawal); if (amount > 0 && amount <= Number(settings.goalSaved)) { update({ goalSaved: Number(settings.goalSaved) - amount }); setGoalWithdrawal(""); } }}>Withdraw</button></div></article>}
        {visible("challenge") && <article className="fm-feature-card fm-challenge-card"><div className="fm-card-top"><span className="fm-feature-icon amber">✦</span><span className="fm-status good">7-day challenge</span></div><h3>Know where it goes</h3><p>Log your spending each day for one week. Small awareness creates better habits.</p><div className="fm-challenge-days">{Array.from({ length: 7 }, (_, i) => <span key={i} className={i < Math.min(7, daysLogged) ? "done" : ""}>{i < Math.min(7, daysLogged) ? "✓" : i + 1}</span>)}</div><div className="fm-card-foot"><span>{Math.min(7, daysLogged)} of 7 days with expense records</span><button onClick={() => go("Transactions")}>Review entries ↗</button></div><small className="fm-disclaimer">Uses recorded dates; it is not a verified consecutive-day streak.</small></article>}
        {visible("insight") && <article className="fm-feature-card fm-insight-feature"><div className="fm-card-top"><span className="fm-feature-icon blue">✧</span><span className="fm-status">Data-based insight</span></div><h3>Your monthly insight</h3>{topCategory ? <><div className="fm-feature-number">{topCategory[0]}</div><p>Your highest recorded expense category this month, at {INR(topCategory[1])}.</p></> : <p>Add a few expenses this month to unlock a category insight based on your own records.</p>}<div className="fm-card-foot"><span>Month to date</span><button onClick={() => go("Cash flow")}>Explore trends ↗</button></div></article>}
      </div>
    </section>}

    {showSetup && <div className="fm-modal-backdrop" role="presentation"><section className="fm-modal" role="dialog" aria-modal="true" aria-labelledby="fm-setup-title"><div className="fm-modal-kicker">A QUICK START</div><h2 id="fm-setup-title">Make FINMIND yours.</h2><p>Set a starting plan. You can change these values any time. This plan is stored in this browser for your signed-in profile.</p><form onSubmit={(e) => { e.preventDefault(); update({ monthlyBudget: Math.max(0, Number(setupBudget) || 0), goalName: setupGoal.trim() || "Savings goal", goalTarget: Math.max(1, Number(setupTarget) || 1), onboardingDone: true }); setShowSetup(false); }}><label>Monthly spending budget (₹)<input type="number" min="0" value={setupBudget} onChange={(e) => setSetupBudget(e.target.value)} required /></label><label>Savings goal name<input value={setupGoal} onChange={(e) => setSetupGoal(e.target.value)} maxLength={60} required /></label><label>Savings target (₹)<input type="number" min="1" value={setupTarget} onChange={(e) => setSetupTarget(e.target.value)} required /></label><div className="fm-modal-actions"><button type="button" className="fm-outline-button" onClick={() => { update({ onboardingDone: true }); setShowSetup(false); }}>Skip for now</button><button type="submit" className="fm-primary-button">Save my plan →</button></div></form></section></div>}

    {showPalette && <div className="fm-modal-backdrop fm-palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowPalette(false); }}><section className="fm-command-modal" role="dialog" aria-modal="true" aria-label="Quick actions"><div className="fm-command-search"><span>⌕</span><input autoFocus value={paletteQuery} onChange={(e) => setPaletteQuery(e.target.value)} placeholder="Search pages and actions…" /></div><div className="fm-command-list">{commands.map((command) => <button key={command.label} onClick={command.action}><span className="fm-command-dot">↗</span><span><strong>{command.label}</strong><small>{command.detail}</small></span><kbd>↵</kbd></button>)}{commands.length === 0 && <p className="fm-empty-command">No matching actions.</p>}</div><footer><span>↑↓ Navigate by typing</span><span>ESC to close</span></footer></section></div>}

    {showCustomize && <div className="fm-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCustomize(false); }}><section className="fm-modal" role="dialog" aria-modal="true" aria-labelledby="fm-customize-title"><div className="fm-modal-kicker">YOUR WORKSPACE</div><h2 id="fm-customize-title">Customize dashboard</h2><p>Choose which personal money cards appear on the dashboard.</p>{[["budget", "Monthly budget"], ["goal", "Savings goal"], ["challenge", "7-day challenge"], ["insight", "Monthly insight"]].map(([key, label]) => <label className="fm-toggle-row" key={key}><span>{label}</span><input type="checkbox" checked={visible(key)} onChange={() => toggleCard(key)} /></label>)}<div className="fm-modal-actions"><button className="fm-primary-button" onClick={() => setShowCustomize(false)}>Done</button></div></section></div>}

    {showReport && <div className="fm-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowReport(false); }}><section className="fm-modal fm-report-modal" role="dialog" aria-modal="true" aria-labelledby="fm-report-title"><div className="fm-modal-kicker">MONTHLY RECAP · {monthKey()}</div><h2 id="fm-report-title">Your money, this month.</h2><p>A recap of the transactions recorded in FINMIND for the current calendar month.</p><div className="fm-report-grid"><div><span>Income recorded</span><strong>{INR(monthIncome)}</strong></div><div><span>Expenses recorded</span><strong>{INR(monthExpenses)}</strong></div><div><span>Net cash flow</span><strong>{INR(monthIncome - monthExpenses)}</strong></div><div><span>Transactions</span><strong>{currentMonthTransactions.length}</strong></div></div><div className="fm-report-highlight"><span>Largest expense category</span><strong>{topCategory ? `${topCategory[0]} · ${INR(topCategory[1])}` : "No expense data yet"}</strong></div><p className="fm-disclaimer">This recap includes only entries recorded in FINMIND. It is not a bank statement.</p><div className="fm-modal-actions"><button className="fm-outline-button" onClick={() => window.print()}>Print / Save PDF</button><button className="fm-outline-button" onClick={exportCSV}>Export CSV</button><button className="fm-primary-button" onClick={() => setShowReport(false)}>Done</button></div></section></div>}
  </>;
}
