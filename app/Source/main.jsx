import { applyTravelExpensePlan, assertTravelRevisions } from "./romTransfer.js";
import ExitApp from "./ExitApp";
import BusinessActivityNav from "./BusinessActivityNav.jsx";
import InspectionBrief from "./InspectionBrief.jsx";
import PeriodDisclosure from "./PeriodDisclosure.jsx";
import FindThings from "./FindThings.jsx";
import Rearview from "./Rearview.jsx";
import EditionSettings, { Tribute, initialEditions } from "./Edition.jsx";
import Destinations from "./Destinations.jsx";
import { validateDestinations } from "./destinations.js";
import { StarterGate, Preferences, accents } from "./Starter.jsx";
import FamilySetup from "./FamilySetup.jsx";
import ToolsNav from "./ToolsNav.jsx";
import PersonalReview from "./PersonalReview.jsx";
import MovePlanner from "./MovePlanner.jsx";
import { reportInspectionMonth } from "./businessReports.js";
import BusinessReports from "./BusinessReports.jsx";
import { canRemoveOriginal } from "./inspectionIncome.js";
import MonthlyInspectionRegister from "./MonthlyInspectionRegister.jsx";
import BusinessPeriodNav from "./BusinessPeriodNav.jsx";
import MonthProgress from "./MonthProgress.jsx";
import { LinkLockBar, LinkGuardDialog, lockLinks, authorizeLinkChange, guardedLinkActions } from "./LinkGuard.jsx";
import { refreshShared, setShared, combine, attach } from "./sharedInspections.js";
import InspectionIncome from "./InspectionIncome.jsx";
import { ledger, jobLabel, incomeRecords, travelRecords, mileageNeedsReview, monthlyIncome } from "./inspectionIncome.js";
import { linkedPayment } from "./debts.js";
import DebtTrackers from "./DebtTrackers.jsx";
import YearComparison from "./YearComparison.jsx";
import Overview from "./Overview.jsx";
import Recovery from "./Recovery.jsx";
import FileLocations from "./FileLocations.jsx";
import YearSetup from "./YearSetup.jsx";
import PersonalWorkspace from "./PersonalWorkspace.jsx";
import Transfers from "./Transfers.jsx";
import Analytics from "./Analytics.jsx";
import SidebarNav from "./SidebarNav.jsx";
import LoanWorkspace from "./LoanWorkspace.jsx";
import { readLoan, writeLoan } from "./loanWorkbook.js";
import HouseholdWorkspace from "./HouseholdWorkspace.jsx";
import BankImport from "./BankImport.jsx";
import YearSummary from "./YearSummary.jsx";
import React, { useState, useEffect, useRef, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { readBook, writeBook, blankBook, months, baseCategories } from "./workbook.js";
import { BookOpen, CalendarDays, Home, Repeat2, ChartNoAxesCombined, MessageSquare, FolderOpen, Plus, ChevronDown, X, Pencil, Trash2, Save, Link, RefreshCw, Check, Search } from "lucide-react";
const allNavigationItems = [["month", BookOpen, "Business workspace"], ["home", Home, "Personal / Household"], ["loan", BookOpen, "Family Loan"], ["recurring", Repeat2, "Recurring expenses"], ["bank", FolderOpen, "Bank import"], ["summary", BookOpen, "Year-end summary"], ["compare", ChartNoAxesCombined, "Year comparison"], ["links", FolderOpen, "Linked workbooks"]];
const navigationItems = [["brief", BookOpen, "Inspection Brief"], ["find", Search, "Find That Thing"], ["overview", Home, "Home / Overview"], ...allNavigationItems.filter(x => ["month", "home", "loan"].includes(x[0])), ["tax", BookOpen, "Tax Preparation"]];
const toolItems = [["rearview", BookOpen, "Year in the Rearview"], ["edition", BookOpen, "Edition & Tribute"], ...["recurring", "summary", "compare", "bank", "links"].map(k => allNavigationItems.find(x => x[0] === k)), ["business_defaults", BookOpen, "Business Defaults"], ["year_setup", CalendarDays, "Prepare / Refresh Next Year"], ["categories", BookOpen, "Business Categories"], ["debts", BookOpen, "Manage Loan Trackers"], ["move_setup", Home, "Move Planner Settings"], ["recovery", Save, "Backup & Recovery"], ["locations", FolderOpen, "Active Files & Backups"], ["help", BookOpen, "Saving & Workbook Help"], ["preferences", Home, "Modules & appearance"]];
const mergeHiddenOrder = (old, visible) => {
  const remaining = [...visible],
    out = old.map(k => visible.includes(k) ? remaining.shift() : k).filter(Boolean);
  return [... /* @__PURE__ */new Set([...out, ...remaining])];
};
let sharedContext = null;
const token = document.querySelector('meta[name="app-token"]').content;
async function api(path, body) {
  if (body && guardedLinkActions.has(path)) {
    const linkGuard = await authorizeLinkChange(path, body, p => api(p));
    body = {
      ...body,
      linkGuard
    };
  }
  const res = await fetch("/api/" + path, {
    method: body ? "POST" : "GET",
    headers: {
      "X-App-Token": token,
      ...(body ? {
        "Content-Type": "application/json"
      } : {})
    },
    ...(body ? {
      body: JSON.stringify(body)
    } : {})
  });
  const r = await res.json();
  if (!res.ok) throw Error(r.error || "The action failed. Please retry.");
  return r;
}
const currency = n => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
}).format(n);
const sum = (a, key = "amount") => Math.round(a.reduce((v, e) => v + (e[key] ?? 0), 0) * 100) / 100;
const clean = s => s;
function InspectionOrder({
  items,
  renderEntry,
  label,
  onSave,
  onDirty,
  search,
  busy
}) {
  const [order, setOrder] = useState(null),
    [saving, setSaving] = useState(false),
    [error, setError] = useState(""),
    drag = useRef(null);
  useEffect(() => {
    onDirty(order !== null);
    return () => onDirty(false);
  }, [order !== null]);
  function move(id, target) {
    if (saving || busy || id === target) return;
    setOrder(prev => {
      const next = [...prev],
        from = next.indexOf(id),
        to = next.indexOf(target);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, id);
      return next;
    });
  }
  return /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("div", {
    className: "inspection-order-tools"
  }, order === null ? /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("button", {
    disabled: busy || items.length < 2 || !!search.trim(),
    onClick: () => {
      setError("");
      setOrder(items.map(e => e.id));
    }
  }, "Arrange Inspections"), search.trim() && /* @__PURE__ */React.createElement("small", null, "Clear search to arrange the full month.")) : /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("p", null, "Drag entries or use \u2191 / \u2193 to match your statement. Save order when finished."), /* @__PURE__ */React.createElement("button", {
    disabled: saving || busy,
    onClick: async () => {
      setSaving(true);
      setError("");
      try {
        if (await onSave(order)) setOrder(null);else setError("Order was not saved. Your arrangement is still here; review the save error and retry.");
      } catch (e) {
        setError(e.message);
      } finally {
        setSaving(false);
      }
    }
  }, saving ? "Saving\u2026" : "Save Inspection Order"), /* @__PURE__ */React.createElement("button", {
    disabled: saving || busy,
    onClick: () => {
      setOrder(null);
      setError("");
    }
  }, "Cancel Arranging"))), error && /* @__PURE__ */React.createElement("p", {
    role: "alert",
    className: "error"
  }, error), order === null ? renderEntry() : order.map((id, i) => {
    const e = items.find(e2 => e2.id === id);
    return e ? /* @__PURE__ */React.createElement("div", {
      className: "inspection-order-row",
      key: id,
      draggable: !saving && !busy,
      onDragStart: event => {
        drag.current = id;
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", id);
      },
      onDragEnd: () => drag.current = null,
      onDragOver: event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
      },
      onDrop: event => {
        event.preventDefault();
        if (drag.current) move(drag.current, id);
        drag.current = null;
      }
    }, /* @__PURE__ */React.createElement("span", {
      "aria-hidden": "true"
    }, "\u283F"), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("strong", null, label(e)), /* @__PURE__ */React.createElement("small", null, e.amount == null ? "Not entered" : currency(e.amount), " \xB7 ", e.miles == null ? "Miles not entered" : e.miles + " miles")), /* @__PURE__ */React.createElement("button", {
      disabled: saving || busy || i === 0,
      "aria-label": "Move inspection " + (i + 1) + " up",
      onClick: () => move(id, order[i - 1])
    }, "\u2191"), /* @__PURE__ */React.createElement("button", {
      disabled: saving || busy || i === order.length - 1,
      "aria-label": "Move inspection " + (i + 1) + " down",
      onClick: () => move(id, order[i + 1])
    }, "\u2193")) : null;
  }));
}
function App({
  initialProfile
}) {
  const activityStates = useRef({});
  const [activityRequest, setActivityRequest] = useState(null);
  const [activitySection, setActivitySection] = useState("mileage");
  const [findState, setFindState] = useState({
    query: "",
    scope: "all",
    year: "all"
  });
  const [editions, setEditions] = useState(null),
    [editionDirty, setEditionDirty] = useState(false),
    [businessReviewOpen, setBusinessReviewOpen] = useState(false);
  const [profile, setProfile] = useState(initialProfile);
  const modules = profile.preferences.modules;
  useEffect(() => {
    document.documentElement.style.setProperty("--user-accent", accents[profile.preferences.accent]);
    document.title = profile.preferences.title;
  }, [profile]);
  const visibleNav = navigationItems.filter(([k]) => !["month", "activity", "tax"].includes(k) || modules.business).filter(([k]) => k !== "loan" || modules.family).filter(([k]) => k !== "brief" || modules.inspections);
  const visibleTools = toolItems.filter(([k]) => !["recurring", "categories", "bank", "business_defaults"].includes(k) || modules.business).filter(([k]) => k !== "debts" || modules.loans).filter(([k]) => k !== "move_setup" || modules.move);
  const [personalSection, setPersonalSection] = useState(0),
    [transferRequest, setTransferRequest] = useState(null);
  const [moveEnabled, setMoveEnabled] = useState(true);
  const [reportReturn, setReportReturn] = useState(null);
  const [businessDefaultsDraft, setBusinessDefaultsDraft] = useState(null);
  const [businessArea, setBusinessArea] = useState("choose");
  const [progressAction, setProgressAction] = useState(null);
  const [inspectionDirty, setInspectionDirty] = useState(false),
    [inspectionRequest, setInspectionRequest] = useState(null);
  const [inlineCategory, setInlineCategory] = useState(null);
  const [debtState, setDebtState] = useState(null),
    [debtBooks, setDebtBooks] = useState([]),
    [debtPackets, setDebtPackets] = useState([]),
    [debtErrors, setDebtErrors] = useState([]);
  const [comparisonView, setComparisonView] = useState({}),
    [summaryView, setSummaryView] = useState(null);
  const [overviewDirty, setOverviewDirty] = useState(false);
  const [toolsOrder, setToolsOrder] = useState(null),
    [variableOpen, setVariableOpen] = useState(true),
    [recurringOpen, setRecurringOpen] = useState(true);
  const [setupOpen, setSetupOpen] = useState(false);
  const [links, setLinks] = useState({}),
    [year, setYear] = useState((/* @__PURE__ */new Date()).getFullYear()),
    [month, setMonth] = useState(0),
    [tab, setTab] = useState("overview"),
    [book, setBook] = useState(null),
    [base, setBase] = useState(""),
    [revision, setRevision] = useState(""),
    [fileInfo, setFileInfo] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState("Opening local workbooks\u2026"),
    [search, setSearch] = useState(""),
    [opened, setOpened] = useState([]),
    [expandAll, setExpandAll] = useState(false),
    [edit, setEdit] = useState(null),
    [scopeChange, setScopeChange] = useState("single"),
    [noteEdit, setNoteEdit] = useState(null),
    [draftNote, setDraftNote] = useState(""),
    [linkForm, setLinkForm] = useState(null),
    [newYear, setNewYear] = useState(null),
    [manageCats, setManageCats] = useState(false),
    [catName, setCatName] = useState(""),
    [help, setHelp] = useState(false),
    [compare, setCompare] = useState([]),
    [cutoff, setCutoff] = useState(8);
  const [deleteEntry, setDeleteEntry] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState([]);
  const notesRef = useRef(null);
  const informationAsOf = useMemo(() => (/* @__PURE__ */new Date()).toISOString(), [book]);
  const [labelManager, setLabelManager] = useState(null);
  const [housingDrafts, setHousingDrafts] = useState({}),
    [quickRecord, setQuickRecord] = useState(null);
  const [transferDirty, setTransferDirty] = useState(false);
  const [reporting, setReporting] = useState({}),
    [compareLoading, setCompareLoading] = useState(false);
  const [navigationOrder, setNavigationOrder] = useState([]),
    [navigationReady, setNavigationReady] = useState(false);
  const [loanState, setLoanState] = useState(null),
    [loanBusy, setLoanBusy] = useState(false),
    [loanDirty, setLoanDirty] = useState(false);
  const [householdDirty, setHouseholdDirty] = useState(false),
    [incomeDirty, setIncomeDirty] = useState(false);
  const [bankSession, setBankSession] = useState(null);
  const bankDirty = Object.values(bankSession?.choices || {}).some(c => c.action);
  const housingDirty = Object.values(housingDrafts).some(d => d.amount !== "" || d.note !== "");
  function leaveHousing() {
    if (editionDirty || overviewDirty || inspectionDirty || householdDirty || incomeDirty || loanDirty || transferDirty) {
      alert("Finish or cancel the open task before switching pages.");
      return false;
    }
    if (!housingDirty && !bankDirty) return true;
    if (!confirm("You have unsaved " + (bankDirty ? "bank import choices" : "housing amounts or notes") + ". Discard them and continue? Choose Cancel to return and save.")) return false;
    setHousingDrafts({});
    setBankSession(null);
    return true;
  }
  function setHousingDraft(label, key, value) {
    setHousingDrafts(prev => ({
      ...prev,
      [label]: {
        amount: "",
        note: "",
        ...prev[label],
        [key]: value
      }
    }));
  }
  async function recordQuick(event) {
    event.preventDefault();
    if (quickRecord.amount === "" || !Number.isFinite(Number(quickRecord.amount))) return;
    const next = structuredClone(book),
      row = next.records.find(e => e.id === quickRecord.id);
    if (!row || row.state !== "planned") return;
    row.amount = Number(quickRecord.amount);
    row.state = "recorded";
    await save(next, () => setQuickRecord(null));
  }
  async function loadDebts() {
    try {
      const state = await api("debts"),
        cfg = await api("years"),
        packets = [],
        books = [],
        errors = [];
      for (const y of Object.keys(cfg.years)) {
        try {
          const r = await api("workbook?year=" + y);
          books.push(readBook(r.base64, Number(y)));
          packets.push(r);
        } catch (e) {
          errors.push({
            year: y,
            error: e.message
          });
        }
      }
      setDebtState(state);
      setDebtBooks(books);
      setDebtPackets(packets);
      setDebtErrors(errors);
    } catch (e) {
      setError(e.message);
    }
  }
  async function saveDebts(loans) {
    if (!debtState) throw Error("Reload loan trackers first.");
    const r = await api("debts", {
      loans,
      revision: debtState.revision
    });
    setDebtState(r);
  }
  useEffect(() => {
    if (modules.loans) loadDebts();else setDebtState(null);
  }, [modules.loans]);
  async function loadLoan() {
    setLoanBusy(true);
    try {
      const r = await api("loan");
      setLoanState(r.linked ? {
        ...r,
        loan: readLoan(r.base64)
      } : null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoanBusy(false);
    }
  }
  async function previewLoan(path) {
    const r = await api("preview", {
      path
    });
    return {
      ...r,
      loan: readLoan(r.base64)
    };
  }
  async function linkLoan(path, expectedRevision) {
    const preview = await api("preview", {
      path
    });
    readLoan(preview.base64);
    if (expectedRevision && preview.revision !== expectedRevision) throw Error("The selected workbook changed after preview. Preview it again before replacing the link.");
    const r = await api("loan/link", {
      path: preview.path,
      previewRevision: preview.revision
    });
    setLoanState({
      ...r,
      loan: readLoan(r.base64)
    });
    setStatus("Loan workbook linked \xB7 file unchanged");
  }
  async function saveLoan(next) {
    if (!loanState) return false;
    setLoanBusy(true);
    setError("");
    try {
      const base64 = writeLoan(loanState.base64, next),
        res = await api("loan/save", {
          base64,
          revision: loanState.revision,
          loanPath: loanState.path
        });
      setLoanState({
        ...loanState,
        base64,
        revision: res.revision,
        loan: readLoan(base64)
      });
      setStatus("Loan saved \xB7 " + new Date(res.saved).toLocaleTimeString());
      return true;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setLoanBusy(false);
    }
  }
  function loanPanel(compact = false) {
    if (!loanState) return /* @__PURE__ */React.createElement(FamilySetup, {
      api,
      onCreated: r => setLoanState({
        ...r,
        loan: readLoan(r.base64)
      }),
      onLink: linkLoan,
      onBrowse: async () => {
        const r = await api("pick", {});
        return r.path;
      },
      onDirty: setLoanDirty
    });
    return /* @__PURE__ */React.createElement(LoanWorkspace, {
      key: compact ? "loan-compact" : "loan-full",
      state: loanState,
      compact,
      initiallyExpanded: compact,
      year,
      month,
      onLink: linkLoan,
      onPreview: previewLoan,
      onSave: saveLoan,
      onReload: loadLoan,
      onBrowse: async () => {
        const r = await api("pick", {});
        return r.path;
      },
      busy: loanBusy,
      onDirty: setLoanDirty
    });
  }
  useEffect(() => {
    if (modules.family) loadLoan();else setLoanState(null);
  }, [modules.family]);
  async function config() {
    const c = await api("years");
    setProfile(await api("preferences"));
    setLinks(c.years);
    setEditions(c.editions || null);
    setMoveEnabled(c.movePlanner?.enabled !== false);
    setReporting(c.reporting || {});
    setNavigationOrder(c.navigationOrder || []);
    setToolsOrder(c.toolsOrder || null);
    setNavigationReady(true);
    return c.years;
  }
  async function load(y, alreadyChecked = false) {
    if (!alreadyChecked && !leaveHousing()) return;
    setExpandedCategories([]);
    setOpened([]);
    setExpandAll(false);
    setBusy(true);
    setError("");
    setBook(null);
    try {
      sharedContext = await refreshShared(api, readBook);
      const r = await api("workbook?year=" + y);
      const b = readBook(r.base64, y);
      setBook(b);
      setBase(r.base64);
      setRevision(r.revision);
      setFileInfo(r);
      setStatus("Workbook loaded \xB7 changes save directly");
    } catch (e) {
      setError(e.message);
      setStatus("Workbook not loaded");
      setFileInfo(null);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    config().then(c => {
      const y = c[(/* @__PURE__ */new Date()).getFullYear()] ? (/* @__PURE__ */new Date()).getFullYear() : Number(Object.keys(c).sort().at(-1));
      if (y) {
        setYear(y);
        load(y);
      } else setStatus("Link a workbook to begin");
    }).catch(e => setError(e.message));
  }, []);
  useEffect(() => {
    const h = e => {
      if (editionDirty || inspectionDirty || overviewDirty || edit || noteEdit || quickRecord || housingDirty || bankDirty || householdDirty || incomeDirty || loanDirty || transferDirty || setupOpen) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [editionDirty, inspectionDirty, overviewDirty, edit, noteEdit, quickRecord, housingDirty, bankDirty, householdDirty, incomeDirty, loanDirty, transferDirty, setupOpen]);
  useEffect(() => {
    if (businessDefaultsDraft || edit || noteEdit || help || linkForm || newYear || manageCats || deleteEntry || quickRecord || labelManager) {
      const el = document.querySelector("dialog");
      if (el && !el.open) el.showModal();
    }
  }, [businessDefaultsDraft, edit, noteEdit, help, linkForm, newYear, manageCats, deleteEntry, quickRecord, labelManager]);
  async function openBusinessPeriod(y, m) {
    if (busy || !leaveHousing()) return;
    setTab("month");
    setBusinessArea("choose");
    setProgressAction(null);
    setInspectionRequest(null);
    setYear(y);
    setMonth(m);
    setSearch("");
    setExpandedCategories([]);
    setOpened([]);
    setExpandAll(false);
    if (y !== year || !book) {
      if (links[y]) await load(y, true);else {
        setBook(null);
        setFileInfo(null);
        setError("");
        setStatus("No workbook linked for " + y);
      }
    }
  }
  async function chooseYear(y) {
    if (!leaveHousing()) return;
    if (tab === "month") {
      setBusinessArea("choose");
      setProgressAction(null);
      setInspectionRequest(null);
    }
    setExpandedCategories([]);
    setOpened([]);
    setExpandAll(false);
    setYear(y);
    setMonth(0);
    setSearch("");
    if (links[y]) await load(y, true);else {
      setBook(null);
      setFileInfo(null);
      setError("");
      setStatus("No workbook linked for " + y);
    }
  }
  async function loadTravelBooks() {
    const ctx = await api("inspection/context");
    if (ctx.sharedRevision !== sharedContext?.sharedRevision || ctx.books.find(p => p.year === year)?.revision !== revision) throw Error("Expense Book changed. Reload before preparing a travel handoff.");
    return {
      books: ctx.books.map(p => p.year === year ? book : readBook(p.base64, p.year)),
      revisions: ctx.books.map(p => ({
        year: p.year,
        revision: p.revision
      }))
    };
  }
  async function save(next, done, destinations, travelPlan) {
    if (!book) return;
    setBusy(true);
    setError("");
    setStatus("Saving to " + fileInfo.name + "\u2026");
    try {
      await new Promise(r => setTimeout(r, 10));
      const ctx = await api("inspection/context");
      if (!sharedContext || ctx.sharedRevision !== sharedContext.sharedRevision) throw Error("Inspection history changed. Reload before saving.");
      const primary = ctx.books.find(p => p.year === year);
      if (!primary || primary.revision !== revision) throw Error("Workbook changed. Reload before saving.");
      if (travelPlan) assertTravelRevisions(ctx.books, travelPlan);
      const registry = combine(ctx.books.map(p => p.year === year ? next : readBook(p.base64, p.year, true)), next.inspectionLedger);
      registry.linkedYears = ctx.books.map(p => p.year);
      const needed = [...registry.events.map(e => e.date), ...registry.payouts.map(p => p.date), ...Object.values(registry.jobs).flatMap(j => (j.visits || []).map(v => v.date))].filter(Boolean).map(d => Number(d.slice(0, 4)));
      for (const y of needed) if (!registry.linkedYears.includes(y)) throw Error("Link or create the " + y + " workbook before saving this dated activity. Your edits are still open.");
      const packets = ctx.books.map(p => {
        const b = p.year === year ? next : readBook(p.base64, p.year, true);
        return {
          ...p,
          base64: writeBook(p.base64, attach(travelPlan ? applyTravelExpensePlan(b, travelPlan) : b, registry))
        };
      });
      const res = await api("inspection/save", {
        sharedRevision: ctx.sharedRevision,
        shared: registry,
        books: packets,
        ...(destinations ? {
          destinations
        } : {})
      });
      if (res.reporting) setReporting(res.reporting);
      setShared(registry);
      sharedContext = {
        ...ctx,
        books: res.books,
        sharedRevision: res.sharedRevision,
        registry
      };
      const packet = res.books.find(p => p.year === year);
      setBase(packet.base64);
      setRevision(packet.revision);
      setBook(readBook(packet.base64, year));
      setStatus("Saved to workbook \xB7 " + new Date(res.saved).toLocaleTimeString());
      done?.();
      if (debtState?.loans?.length) await loadDebts();
      return true;
    } catch (e) {
      setError(e.message);
      setStatus("Not saved \xB7 your edits are still open");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const active = book?.records.filter(e => e.month === months[month]) || [],
    expenses = active.filter(e => e.kind === "expense" && e.scope === "business"),
    recorded = expenses.filter(e => e.state === "recorded"),
    planned = expenses.filter(e => e.state === "planned"),
    inspections = active.filter(e => e.kind === "inspection"),
    homes = active.filter(e => e.scope === "residence");
  const recurringName = book?.categories.find(c => c.role === "recurring")?.name || "Recurring Expenses";
  const residenceName = book?.categories.find(c => c.role === "residence")?.name || "Residence";
  const isRecurring = e => e.category === recurringName;
  const notesFor = id => book?.notes.filter(n => n.recordId === id) || [];
  const match = e => [e.description, e.category, e.subCategory, e.location, ...notesFor(e.id).map(n => n.text)].join(" ").toLowerCase().includes(search.toLowerCase());
  function add(kind = "expense", category = "Office Expenses", scope = "business", subCategory = "") {
    if (!leaveHousing()) return;
    setInlineCategory(null);
    setScopeChange("single");
    setDraftNote("");
    setEdit({
      id: crypto.randomUUID(),
      month: months[month],
      kind,
      category: kind === "inspection" ? "Inspection" : category,
      subCategory,
      description: "",
      amount: null,
      miles: null,
      location: "",
      sheet: months[month],
      isNew: true,
      state: kind === "inspection" || kind === "income" ? "recorded" : year > (/* @__PURE__ */new Date()).getFullYear() || year === (/* @__PURE__ */new Date()).getFullYear() && month >= (/* @__PURE__ */new Date()).getMonth() ? "planned" : "recorded",
      scope,
      percent: null,
      recurringType: "fixed"
    });
  }
  function openEdit(e) {
    if (!leaveHousing()) return;
    if (e.kind === "inspection" && modules.inspections && (ledger(book).jobs[e.id] || ledger(book).retired.some(r => r.recordId === e.id))) {
      const retired = ledger(book).retired.find(r => r.recordId === e.id);
      if (retired && !retired.jobId) {
        setError("This original bank payout row is excluded from income. Review it in Bank reconciliation.");
        return;
      }
      setTab("month");
      setBusinessArea("inspections");
      setInspectionRequest(retired?.jobId || e.id);
      setTimeout(() => document.querySelector(".inspection-income")?.scrollIntoView?.({
        behavior: "smooth"
      }), 50);
      return;
    }
    setInlineCategory(null);
    setScopeChange("single");
    setDraftNote("");
    setEdit(structuredClone(e));
  }
  async function saveEdit(e) {
    e.preventDefault();
    let next = structuredClone(book);
    let savedEdit = {
      ...edit
    };
    if (inlineCategory?.id === edit.id && edit.kind === "expense" && edit.scope === "business") {
      const name = inlineCategory.name.trim();
      if (!name) {
        setError("Enter a category name, or cancel adding the category.");
        return;
      }
      if (next.categories.some(c => c.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase())) {
        setError("That category already exists. Cancel the new category and select it from the list.");
        return;
      }
      next.categories.push({
        name,
        role: "variable",
        subs: []
      });
      savedEdit = {
        ...edit,
        category: name,
        recurringType: "variable"
      };
    }
    const old = book.records.find(x => x.id === savedEdit.id);
    if (old && old.month !== savedEdit.month) {
      setError("An existing entry stays in its original month. Use Copy to another month to create a separate entry.");
      return;
    }
    const idx = next.records.findIndex(x => x.id === savedEdit.id);
    if (idx < 0) next.records.push(savedEdit);else next.records[idx] = savedEdit;
    if (draftNote.trim()) next.notes.push({
      id: crypto.randomUUID(),
      sheet: savedEdit.sheet,
      cell: savedEdit.amountCell || "New entry",
      recordId: savedEdit.id,
      storage: "app",
      text: draftNote.trim()
    });
    if (savedEdit.kind === "expense") {
      const cat = next.categories.find(c => c.name === savedEdit.category);
      if (cat && savedEdit.subCategory && !cat.subs.includes(savedEdit.subCategory)) cat.subs.push(savedEdit.subCategory);
    }
    if (scopeChange === "forward" && (isRecurring(savedEdit) || savedEdit.scope === "residence")) {
      for (let i = months.indexOf(savedEdit.month) + 1; i < 12; i++) {
        const possible = next.records.filter(r => r.month === months[i] && r.kind === savedEdit.kind && r.scope === savedEdit.scope && r.category === (old?.category || savedEdit.category) && r.subCategory === (old?.subCategory || savedEdit.subCategory));
        let candidates = possible.filter(r => r.description === (old?.description || savedEdit.description));
        if (!candidates.length && possible.length === 1) candidates = possible;
        if (!candidates.length && possible.length > 1) {
          setError("More than one matching recurring expense exists in " + months[i] + ". Save this month only, then edit those future entries individually. Nothing has been saved.");
          return;
        }
        if (candidates.some(r => r.state === "recorded")) continue;
        const row = candidates.find(r => r.state === "planned");
        if (row) {
          Object.assign(row, {
            category: savedEdit.category,
            subCategory: savedEdit.subCategory,
            description: savedEdit.description,
            amount: savedEdit.amount,
            percent: savedEdit.percent,
            recurringType: savedEdit.recurringType
          });
        } else next.records.push({
          ...savedEdit,
          id: crypto.randomUUID(),
          month: months[i],
          state: "planned",
          isNew: true,
          amountCell: null,
          descriptionCell: null,
          milesCell: null,
          locationCell: null,
          sheet: months[i]
        });
      }
    }
    await save(next, () => {
      setEdit(null);
      setInlineCategory(null);
    });
  }
  async function saveNote(e) {
    e.preventDefault();
    const next = structuredClone(book),
      idx = next.notes.findIndex(n => n.id === noteEdit.id);
    if (idx < 0) next.notes.push(noteEdit);else next.notes[idx] = noteEdit;
    await save(next, () => setNoteEdit(null));
  }
  async function removeEntry() {
    if (deleteEntry.kind === "inspection" && !canRemoveOriginal(book, deleteEntry.id)) {
      setError("This source entry supports inspection history or a bank connection. Keep it and review its connections instead.");
      return;
    }
    const next = {
      ...book,
      records: book.records.filter(e => e.id !== deleteEntry.id),
      notes: book.notes.filter(n => n.recordId !== deleteEntry.id)
    };
    await save(next, () => setDeleteEntry(null));
  }
  async function renameCategory(old) {
    const name = prompt("New category name", old);
    if (!name || name === old) return;
    if (book.categories.some(c => c.name === name)) {
      setError("That category already exists.");
      return;
    }
    const next = structuredClone(book);
    next.categories.find(c => c.name === old).name = name;
    next.records.filter(e => e.category === old).forEach(e => e.category = name);
    await save(next);
  }
  async function deleteCategory(name) {
    if (book.records.some(e => e.category === name)) {
      setError("This category has entries. Move those entries to another category or remove them before deleting the category.");
      return;
    }
    await save({
      ...book,
      categories: book.categories.filter(c => c.name !== name)
    });
  }
  async function addSub(c) {
    const sub = prompt("New subcategory for " + c.name);
    if (!sub || c.subs.includes(sub)) return;
    const next = structuredClone(book);
    next.categories.find(x => x.name === c.name).subs.push(sub);
    await save(next);
  }
  function openActivityInspection(row, reportState) {
    if (busy || !leaveHousing()) return;
    setReportReturn({
      year,
      state: reportState
    });
    setMonth(reportInspectionMonth(row));
    setProgressAction(null);
    setInspectionRequest(row.id);
    setBusinessArea("inspections");
    setTab("month");
    setSearch("");
  }
  async function openFound(row) {
    if (!leaveHousing()) return;
    setBusy(true);
    setError("");
    try {
      sharedContext = await refreshShared(api, readBook);
      const packet = await api("workbook?year=" + row.year),
        target = readBook(packet.base64, Number(row.year));
      const note = row.type === "note" ? target.notes.find(n => n.id === row.id) : null,
        transfer = row.type === "transfer" ? target.transfers?.find(t => t.id === row.id) : null,
        entry2 = row.type === "entry" ? target.records.find(r => r.id === row.id) || ledger(target).sources?.find(r => r.id === row.id) : null,
        job = row.type === "entry" ? ledger(target).jobs[row.id] : null;
      if (!(note || transfer || entry2 || job)) throw Error("This result no longer exists. Refresh Search and try again.");
      setYear(Number(row.year));
      setBook(target);
      setBase(packet.base64);
      setRevision(packet.revision);
      setFileInfo(packet);
      setSearch("");
      setProgressAction(null);
      setInspectionRequest(null);
      setTransferRequest(null);
      setReportReturn(null);
      let m = entry2 ? months.indexOf(entry2.month) : note ? months.indexOf(note.sheet) : transfer ? Number(transfer.date.slice(5, 7)) - 1 : row.month;
      setMonth(m >= 0 ? m : row.month);
      if (note) {
        setTab("notes");
        setNoteEdit(structuredClone(note));
      } else if (transfer) {
        setTab("home");
        setPersonalSection(2);
        setTransferRequest(transfer.id);
      } else if (modules.inspections && (entry2?.kind === "inspection" || job)) {
        setTab("month");
        setBusinessArea("inspections");
        setInspectionRequest(job ? row.id : entry2.id);
      } else {
        if (job) throw Error("Enable Inspections & Travel in Modules & appearance to edit this inspection.");
        setTab(entry2.kind === "income" || entry2.scope === "residence" ? "home" : "month");
        setPersonalSection(entry2.kind === "income" ? 0 : 1);
        setBusinessArea(entry2.kind === "inspection" ? "income" : "expenses");
        setInlineCategory(null);
        setScopeChange("single");
        setDraftNote("");
        setEdit(structuredClone(entry2));
      }
      setStatus("Opened search result");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function openReportEntry(targetYear, id) {
    if (!leaveHousing()) return;
    try {
      setBusy(true);
      let target;
      sharedContext = await refreshShared(api, readBook);
      const r = await api("workbook?year=" + targetYear);
      target = readBook(r.base64, Number(targetYear));
      setYear(Number(targetYear));
      setBook(target);
      setBase(r.base64);
      setRevision(r.revision);
      setFileInfo(r);
      const event = id.startsWith("event:") ? ledger(target).events.find(e => e.id === id.slice(6)) : null;
      const entry2 = target?.records.find(r2 => r2.id === (event?.jobId || id)) || ledger(target).sources?.find(r2 => r2.id === (event?.jobId || id));
      if (!entry2) throw Error("Entry not found. Reload the workbook.");
      setMonth(event ? Number(event.date.slice(5, 7)) - 1 : months.indexOf(entry2.month));
      if (event || ledger(target).jobs[entry2.id]) {
        setTab("month");
        setBusinessArea("inspections");
        setInspectionRequest(entry2.id);
      } else {
        setTab("summary");
        openEdit(entry2);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function saveReporting(next) {
    const r = await api("reporting", {
      settings: next,
      previous: reporting
    });
    setReporting(r.reporting);
    setStatus("Reporting preferences saved locally");
  }
  async function compareYears(view) {
    if (view?.scope) setComparisonView(view);
    setTab("compare");
    setError("");
    setCompareLoading(true);
    const list = [];
    try {
      await refreshShared(api, readBook);
    } catch (e) {
      setCompare([{
        year,
        error: e.message
      }]);
      setCompareLoading(false);
      return;
    }
    for (const y of Object.keys(links).sort()) {
      try {
        const r = await api("workbook?year=" + y);
        list.push({
          year: Number(y),
          book: readBook(r.base64, Number(y))
        });
      } catch (e) {
        list.push({
          year: Number(y),
          error: e.message
        });
      }
    }
    setCompare(list);
    setCompareLoading(false);
  }
  async function browse() {
    setBusy(true);
    setError("");
    try {
      const r = await api("pick", {});
      if (r.path) setLinkForm(v => ({
        ...v,
        path: r.path,
        preview: null
      }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function previewLink() {
    setBusy(true);
    setError("");
    try {
      const r = await api("preview", {
        path: linkForm.path
      });
      const d = readBook(r.base64, Number(linkForm.year), true);
      setLinkForm({
        ...linkForm,
        path: r.path,
        preview: d
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function finishLink() {
    setBusy(true);
    setError("");
    try {
      const r = await api("link", {
        year: Number(linkForm.year),
        path: linkForm.path
      });
      sharedContext = await refreshShared(api, readBook);
      setYear(Number(linkForm.year));
      setMonth(0);
      setBook(readBook(r.base64, Number(linkForm.year)));
      setBase(r.base64);
      setRevision(r.revision);
      setFileInfo(r);
      await config();
      setLinkForm(null);
      setStatus("Workbook linked \xB7 file unchanged");
      setTab("month");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function createYear(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const y = Number(newYear.year),
        b64 = blankBook(y, newYear.copy ? modules.business ? book : {
          ...book,
          records: book.records.filter(r2 => r2.scope !== "business")
        } : null);
      const r = await api("create", {
        year: y,
        base64: b64
      });
      sharedContext = await refreshShared(api, readBook);
      setYear(y);
      setMonth(0);
      setBase(b64);
      setBook(readBook(b64, y));
      setRevision(r.revision);
      setFileInfo(r);
      await config();
      setNewYear(null);
      setStatus("New yearly workbook created");
      setTab("month");
    } catch (e2) {
      setError(e2.message);
    } finally {
      setBusy(false);
    }
  }
  async function unlink(y) {
    setBusy(true);
    try {
      await api("unlink", {
        year: Number(y)
      });
      await config();
      if (Number(y) === year) {
        setBook(null);
        setFileInfo(null);
      }
      setStatus("Workbook unlinked; file retained.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function noteBlock(e) {
    const ns = notesFor(e.id),
      open = expandAll || opened.includes(e.id);
    return /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("button", {
      className: "note-toggle " + (ns.length ? "noted" : ""),
      onClick: () => ns.length ? setOpened(opened.includes(e.id) ? opened.filter(x => x !== e.id) : [...opened, e.id]) : setNoteEdit({
        id: crypto.randomUUID(),
        sheet: e.sheet,
        cell: e.amountCell || "New entry",
        recordId: e.id,
        storage: "app",
        text: ""
      })
    }, /* @__PURE__ */React.createElement(MessageSquare, {
      size: 15
    }), ns.length ? `${ns.length} ${ns.length === 1 ? "note" : "notes"}` : "Add Note", ns.length > 0 && /* @__PURE__ */React.createElement(ChevronDown, {
      size: 13
    })), ns.length > 0 && open && /* @__PURE__ */React.createElement("div", {
      className: "entry-notes"
    }, ns.map(n => /* @__PURE__ */React.createElement("div", {
      className: "inline-note",
      key: n.id
    }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("small", null, n.sheet, " \xB7 ", n.cell), /* @__PURE__ */React.createElement("button", {
      onClick: () => setNoteEdit({
        ...n
      })
    }, "Edit Note")), /* @__PURE__ */React.createElement("p", null, clean(n.text) || "(Empty note)"))), /* @__PURE__ */React.createElement("button", {
      className: "text-button",
      onClick: () => setNoteEdit({
        id: crypto.randomUUID(),
        sheet: e.sheet,
        cell: e.amountCell,
        recordId: e.id,
        storage: "app",
        text: ""
      })
    }, "+ Add Another Note")));
  }
  function loanCue(e) {
    if (!modules.loans) return null;
    if (e.kind !== "expense" || !book) return null;
    return (debtState?.loans || []).flatMap(loan => loan.links.filter(link => link.year === book.year && link.recordId === e.id).map(link => {
      const payment = linkedPayment(loan, link, [book]),
        warning = payment.issue || (!payment.complete ? payment.breakdownIssue : "");
      return /* @__PURE__ */React.createElement("button", {
        type: "button",
        key: loan.id,
        className: "loan-expense-cue " + (warning ? "needs-review" : "connected"),
        title: warning || "Open the connected loan and its actual payment history",
        onClick: () => {
          if (leaveHousing()) setTab("debt_" + loan.id);
        }
      }, "Linked Loan: ", loan.name, loan.archived ? " (archived)" : "", warning ? " \xB7 " + warning : "");
    }));
  }
  async function saveInspectionOrder(ids) {
    const rows = book.records.filter(e => e.kind === "inspection" && e.month === months[month]);
    if (ids.length !== rows.length || new Set(ids).size !== ids.length || ids.some(id => !rows.some(e => e.id === id))) throw Error("Inspection entries changed. Cancel arranging and reload before trying again.");
    const byId = new Map(rows.map(e => [e.id, e]));
    let i = 0;
    return await save({
      ...book,
      records: book.records.map(e => byId.has(e.id) ? byId.get(ids[i++]) : e)
    });
  }
  function entry(e, inspection = false) {
    const ns = notesFor(e.id);
    return /* @__PURE__ */React.createElement("article", {
      className: "entry",
      key: e.id
    }, /* @__PURE__ */React.createElement("div", {
      className: "entry-line"
    }, /* @__PURE__ */React.createElement("div", {
      className: "entry-description"
    }, /* @__PURE__ */React.createElement("strong", null, inspection ? clean(ns.find(n => n.cell.startsWith("K"))?.text || "").split("\n")[0] || e.description : e.description || e.subCategory || "Untitled entry"), /* @__PURE__ */React.createElement("small", null, inspection ? [e.location, e.miles !== null ? e.miles + " miles" : ""].filter(Boolean).join(" \xB7 ") : e.subCategory && e.subCategory !== e.description ? e.subCategory : "")), /* @__PURE__ */React.createElement("div", {
      className: "amount"
    }, e.amount === null ? /* @__PURE__ */React.createElement("span", {
      className: "muted"
    }, "Not entered") : currency(e.amount))), /* @__PURE__ */React.createElement("div", {
      className: "entry-bottom"
    }, /* @__PURE__ */React.createElement("div", {
      className: "entry-tools"
    }, !inspection && /* @__PURE__ */React.createElement("span", {
      className: "badge " + e.state
    }, e.state === "planned" ? "Planned" : "Recorded"), noteBlock(e), loanCue(e)), /* @__PURE__ */React.createElement("div", {
      className: "entry-actions"
    }, e.state === "planned" && isRecurring(e) && e.scope === "business" && /* @__PURE__ */React.createElement("button", {
      className: "record-month",
      onClick: () => setQuickRecord({
        id: e.id,
        description: e.description,
        month: e.month,
        amount: e.amount ?? ""
      })
    }, "Record This Month"), /* @__PURE__ */React.createElement("button", {
      "aria-label": "Edit " + e.description,
      onClick: () => openEdit(e)
    }, /* @__PURE__ */React.createElement(Pencil, {
      size: 15
    }), "Edit"), /* @__PURE__ */React.createElement("button", {
      "aria-label": "Remove " + e.description,
      onClick: () => setDeleteEntry(e)
    }, /* @__PURE__ */React.createElement(Trash2, {
      size: 15
    })))), e.scope === "residence" && e.percent !== null && /* @__PURE__ */React.createElement("div", {
      className: "allocation"
    }, "Business-use entry: ", e.percent, "% \xB7 ", currency((e.amount || 0) * e.percent / 100)));
  }
  function categorySection(cat, items, options = {}) {
    const a = items.filter(e => e.state === "recorded"),
      p = items.filter(e => e.state === "planned"),
      shown = items.filter(match),
      key = year + ":" + month + ":" + tab + ":" + (options.key || cat);
    const searching = !!search.trim(),
      open = expandedCategories.includes(key) || searching && shown.length > 0,
      panelId = "category-" + encodeURIComponent(key);
    return /* @__PURE__ */React.createElement("section", {
      className: "category-panel expense-category " + (open ? "expanded" : "collapsed"),
      "data-category": cat,
      key: cat
    }, /* @__PURE__ */React.createElement("div", {
      className: "category-head"
    }, /* @__PURE__ */React.createElement("button", {
      className: "category-disclosure",
      "aria-expanded": open,
      "aria-controls": panelId,
      onClick: () => setExpandedCategories(expandedCategories.includes(key) ? expandedCategories.filter(k => k !== key) : [...expandedCategories, key])
    }, /* @__PURE__ */React.createElement(ChevronDown, {
      className: "disclosure-chevron",
      size: 18
    }), /* @__PURE__ */React.createElement("span", {
      className: "category-label"
    }, /* @__PURE__ */React.createElement("strong", null, cat), /* @__PURE__ */React.createElement("small", null, searching ? shown.length + " matching / " : "", items.length, " ", items.length === 1 ? "Entry" : "Entries")), /* @__PURE__ */React.createElement("span", {
      className: "category-amounts"
    }, /* @__PURE__ */React.createElement("span", null, /* @__PURE__ */React.createElement("small", null, "Recorded"), /* @__PURE__ */React.createElement("strong", null, currency(sum(a)))), p.length > 0 && /* @__PURE__ */React.createElement("span", {
      className: "planned-amount"
    }, /* @__PURE__ */React.createElement("small", null, "Planned"), /* @__PURE__ */React.createElement("strong", null, currency(sum(p)))))), /* @__PURE__ */React.createElement("button", {
      className: "add-purchase",
      onClick: () => add("expense", tab === "home" ? residenceName : options.storageCategory || cat, tab === "home" ? "residence" : "business", options.subCategory || ""),
      "aria-label": "Add purchase to " + cat
    }, /* @__PURE__ */React.createElement(Plus, {
      size: 16
    }), /* @__PURE__ */React.createElement("span", null, "Add"))), open && /* @__PURE__ */React.createElement("div", {
      id: panelId,
      className: "category-details"
    }, shown.length ? shown.map(e => entry(e)) : /* @__PURE__ */React.createElement("div", {
      className: "small-empty"
    }, searching ? "No matching entries." : "No entries this month.")));
  }
  function totalsPanel(rows, annual = false) {
    const sales = incomeRecords(book).filter(e => e.kind === "inspection" && e.state === "recorded" && (annual || e.month === months[month])),
      costs = rows.filter(e => e.kind === "expense" && e.scope === "business" && e.state === "recorded"),
      future = rows.filter(e => e.kind === "expense" && e.scope === "business" && e.state === "planned"),
      net = sum(sales) - sum(costs),
      tone = net < 0 ? "deficit" : net > 0 ? "surplus" : "balanced",
      status2 = net < 0 ? "Deficit" : net > 0 ? "Surplus" : "Balanced";
    return /* @__PURE__ */React.createElement("section", {
      className: "totals-section business-financial-summary " + (annual ? "annual-overview" : "monthly-overview"),
      "aria-label": annual ? "Annual totals" : "Monthly totals"
    }, /* @__PURE__ */React.createElement("div", {
      className: "totals-heading"
    }, /* @__PURE__ */React.createElement("h2", null, annual ? year + " \xB7 Financial Summary" : months[month] + " " + year + " \xB7 Financial Summary"), /* @__PURE__ */React.createElement("span", null, annual ? "Selected year" : "Selected month")), /* @__PURE__ */React.createElement("div", {
      className: "metrics"
    }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("span", null, "Net Customer Receipts"), /* @__PURE__ */React.createElement("strong", {
      "data-metric": "sales"
    }, currency(sum(sales))), /* @__PURE__ */React.createElement("small", null, currency(sum(sales.filter(e => e.amount > 0))), " before refunds")), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("span", null, "Recorded Business Expenses"), /* @__PURE__ */React.createElement("strong", {
      "data-metric": "expenses"
    }, currency(sum(costs))), /* @__PURE__ */React.createElement("small", null, "Household finances separate")), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("span", null, "Refunds Issued"), /* @__PURE__ */React.createElement("strong", {
      "data-metric": "refunds"
    }, currency(Math.abs(sum(sales.filter(e => e.amount < 0))))), /* @__PURE__ */React.createElement("small", null, "Already deducted from net receipts")), /* @__PURE__ */React.createElement("div", {
      className: "net " + tone
    }, /* @__PURE__ */React.createElement("span", null, "Business Surplus / Deficit"), /* @__PURE__ */React.createElement("strong", {
      "data-metric": "net"
    }, currency(net)), /* @__PURE__ */React.createElement("small", {
      className: "result-status"
    }, status2)), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("span", null, "Recorded Miles"), /* @__PURE__ */React.createElement("strong", {
      "data-metric": "miles"
    }, sum(travelRecords(book).filter(e => annual || e.month === months[month]), "miles").toLocaleString(), /* @__PURE__ */React.createElement("em", null, " mi")), /* @__PURE__ */React.createElement("small", null, sum(travelRecords(book).filter(e => (annual || e.month === months[month]) && mileageNeedsReview(book, e)), "miles").toLocaleString(), " mi need review \xB7 included"))), /* @__PURE__ */React.createElement("details", {
      className: "financial-summary-help"
    }, /* @__PURE__ */React.createElement("summary", null, "About These Totals"), /* @__PURE__ */React.createElement("p", null, "Business surplus / deficit = customer payments \u2212 refunds \u2212 recorded business expenses. Original entries retain their recorded month until converted to dated payments. Bank matching does not add income."), /* @__PURE__ */React.createElement("p", null, currency(sum(future)), " in planned business expenses is excluded. Household finances are separate. This is the recorded business result, including recorded loan payments; it is not a tax-adjusted profit figure.")));
  }
  function variableCard() {
    const items = expenses.filter(e => !isRecurring(e));
    return /* @__PURE__ */React.createElement("section", {
      className: "expense-group variable-group"
    }, /* @__PURE__ */React.createElement("div", {
      className: "expense-group-heading"
    }, /* @__PURE__ */React.createElement("button", {
      className: "variable-disclosure",
      "aria-expanded": variableOpen || !!search.trim(),
      "aria-controls": "variable-categories",
      onClick: () => setVariableOpen(!variableOpen)
    }, /* @__PURE__ */React.createElement("span", {
      "aria-hidden": "true"
    }, variableOpen ? "\u25BE" : "\u25B8"), /* @__PURE__ */React.createElement("span", null, /* @__PURE__ */React.createElement("h3", null, "Variable Expenses"), /* @__PURE__ */React.createElement("small", null, "Purchases And Other Non-Recurring Expenditures"))), /* @__PURE__ */React.createElement("div", {
      className: "group-amounts"
    }, /* @__PURE__ */React.createElement("span", null, "Recorded ", /* @__PURE__ */React.createElement("strong", null, currency(sum(items.filter(e => e.state === "recorded"))))), /* @__PURE__ */React.createElement("span", null, "Planned ", /* @__PURE__ */React.createElement("strong", null, currency(sum(items.filter(e => e.state === "planned"))))))), (variableOpen || !!search.trim()) && /* @__PURE__ */React.createElement("div", {
      id: "variable-categories"
    }, book.categories.filter(c => c.name !== residenceName && c.name !== recurringName).map(c => categorySection(c.name, items.filter(e => e.category === c.name)))));
  }
  const housingLabels = ["Mortgage", "Water", "Power", "Sewer", "Internet", "Cell Phone"];
  const housingLabel = e => ({
    "Electric": "Power",
    "Electricity": "Power"
  })[e.subCategory] || e.subCategory || e.description || "Other";
  async function saveHousing(event, label) {
    event.preventDefault();
    const form = event.currentTarget,
      amount = Number(form.elements.amount.value),
      note = form.elements.note.value.trim();
    if (form.elements.amount.value === "" || !Number.isFinite(amount)) return;
    const next = structuredClone(book),
      id = crypto.randomUUID();
    next.records.push({
      id,
      month: months[month],
      kind: "expense",
      category: residenceName,
      subCategory: label,
      description: label,
      amount,
      miles: null,
      location: "",
      sheet: months[month],
      isNew: true,
      state: "recorded",
      scope: "residence",
      percent: null,
      recurringType: label === "Mortgage" ? "fixed" : "variable"
    });
    let cat = next.categories.find(c => c.name === residenceName);
    if (!cat) {
      cat = {
        name: residenceName,
        role: "residence",
        subs: []
      };
      next.categories.push(cat);
    }
    if (!cat.subs.includes(label)) cat.subs.push(label);
    if (note) next.notes.push({
      id: crypto.randomUUID(),
      sheet: months[month],
      cell: "New entry",
      recordId: id,
      storage: "app",
      text: note
    });
    await save(next, () => setHousingDrafts(prev => {
      const copy = {
        ...prev
      };
      delete copy[label];
      return copy;
    }));
  }
  function transferCard() {
    return /* @__PURE__ */React.createElement(Transfers, {
      allowBusiness: modules.business,
      requestId: transferRequest,
      onRequestHandled: () => setTransferRequest(null),
      initiallyExpanded: true,
      key: "transfers-" + year,
      book,
      month,
      onSave: save,
      busy,
      onDirty: setTransferDirty
    });
  }
  function housingCard() {
    return /* @__PURE__ */React.createElement(HouseholdWorkspace, {
      initiallyExpanded: true,
      key: "household-" + year,
      book,
      month,
      onSave: save,
      onEdit: openEdit,
      onNotes: noteBlock,
      renderLoanCue: loanCue,
      busy,
      search,
      onDirty: setHouseholdDirty
    });
  }
  function periodTabs(inHousing = false) {
    return /* @__PURE__ */React.createElement("div", {
      className: inHousing ? "housing-periods" : "workspace-periods"
    }, /* @__PURE__ */React.createElement("div", {
      className: "year-tabs",
      role: "tablist",
      "aria-label": inHousing ? "Housing calendar year" : "Calendar year"
    }, [... /* @__PURE__ */new Set([year, ...Object.keys(links).map(Number)])].sort((a, b) => a - b).map(y => /* @__PURE__ */React.createElement("button", {
      role: "tab",
      "aria-selected": year === y,
      className: year === y ? "selected" : "",
      onClick: () => chooseYear(y),
      key: y
    }, y, !links[y] && /* @__PURE__ */React.createElement("small", null, "Not linked"))), /* @__PURE__ */React.createElement("button", {
      className: "add-year",
      onClick: () => {
        if (leaveHousing()) setNewYear({
          year: Math.max(year, ...Object.keys(links).map(Number)) + 1,
          copy: !!book
        });
      }
    }, /* @__PURE__ */React.createElement(Plus, {
      size: 16
    }), "Add Year"), Object.keys(links).length > 0 && /* @__PURE__ */React.createElement("button", {
      className: "add-year",
      onClick: () => {
        if (leaveHousing()) setSetupOpen(true);
      }
    }, "Prepare / Refresh Next Year")), (inHousing || !["rearview", "compare", "summary", "bank", "activity", "tax"].includes(tab)) && /* @__PURE__ */React.createElement("div", {
      className: "month-tabs",
      role: "tablist",
      "aria-label": inHousing ? "Housing month" : "Month"
    }, months.map((m, i) => /* @__PURE__ */React.createElement("button", {
      role: "tab",
      "aria-selected": month === i,
      className: month === i ? "selected" : "",
      onClick: () => {
        if (!leaveHousing()) return;
        if (tab === "month") {
          setBusinessArea("choose");
          setProgressAction(null);
          setInspectionRequest(null);
        }
        setMonth(i);
        setSearch("");
        setExpandedCategories(inHousing ? [year + ":" + i + ":housing"] : []);
        setOpened([]);
        setExpandAll(false);
      },
      key: m
    }, m))), inHousing && /* @__PURE__ */React.createElement("p", {
      className: "housing-period-hint"
    }, months[month], " ", year, " \xB7 Shared with the workspace and Household finances."));
  }
  function residenceMonthly() {
    return /* @__PURE__ */React.createElement("section", {
      className: "totals-section monthly-overview residence-overview",
      "aria-label": "Monthly household totals"
    }, /* @__PURE__ */React.createElement("div", {
      className: "totals-heading"
    }, /* @__PURE__ */React.createElement("h2", null, months[month], " ", year, " \xB7 Household totals"), /* @__PURE__ */React.createElement("span", null, "Selected month")), /* @__PURE__ */React.createElement("div", {
      className: "metrics"
    }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("span", null, "Recorded household costs"), /* @__PURE__ */React.createElement("strong", {
      "data-metric": "household-recorded"
    }, currency(sum(homes.filter(e => e.state === "recorded")))), /* @__PURE__ */React.createElement("small", null, "Full amounts paid")), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("span", null, "Planned household costs"), /* @__PURE__ */React.createElement("strong", {
      "data-metric": "household-planned"
    }, currency(sum(homes.filter(e => e.state === "planned")))), /* @__PURE__ */React.createElement("small", null, "Kept out of recorded totals")), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("span", null, "Recorded personal income"), /* @__PURE__ */React.createElement("strong", {
      "data-metric": "personal-income"
    }, currency(sum(active.filter(e => e.kind === "income" && e.state === "recorded")))), /* @__PURE__ */React.createElement("small", null, "Separate from inspection sales")), /* @__PURE__ */React.createElement("div", {
      className: "net"
    }, /* @__PURE__ */React.createElement("span", null, "Personal income less household expenses"), /* @__PURE__ */React.createElement("strong", {
      className: sum(active.filter(e => e.kind === "income" && e.state === "recorded")) - sum(homes.filter(e => e.state === "recorded")) < 0 ? "balance-negative" : "balance-positive",
      "data-metric": "personal-net"
    }, currency(sum(active.filter(e => e.kind === "income" && e.state === "recorded")) - sum(homes.filter(e => e.state === "recorded")))), /* @__PURE__ */React.createElement("small", null, "Based on entries recorded here"))));
  }
  function annualSnapshot() {
    if (!book) return /* @__PURE__ */React.createElement("section", {
      className: "annual-snapshot",
      "aria-label": "Annual snapshot"
    }, /* @__PURE__ */React.createElement("h2", null, year, " \xB7 Annual snapshot"), /* @__PURE__ */React.createElement("p", null, busy ? "Loading workbook\u2026" : "Link a workbook to see this year\u2019s totals."));
    const sales = incomeRecords(book).filter(e => e.kind === "inspection" && e.state === "recorded"),
      costs = book.records.filter(e => e.kind === "expense" && e.scope === "business" && e.state === "recorded"),
      planned2 = book.records.filter(e => e.kind === "expense" && e.scope === "business" && e.state === "planned"),
      homes2 = book.records.filter(e => e.scope === "residence");
    return /* @__PURE__ */React.createElement("section", {
      className: "annual-snapshot",
      "aria-label": "Annual snapshot"
    }, /* @__PURE__ */React.createElement("h2", null, year, " \xB7 Annual snapshot"), /* @__PURE__ */React.createElement("p", null, "All recorded activity in the selected year"), modules.business && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("dl", null, [["sales", "Net customer receipts", currency(sum(sales))], ["expenses", "Business expenses", currency(sum(costs))], ["net", "Sales less expenses", currency(sum(sales) - sum(costs))], ["miles", "Recorded miles", sum(travelRecords(book), "miles").toLocaleString() + " mi"], ["planned", "Planned business expenses", currency(sum(planned2))]].filter(([key]) => key !== "miles" || modules.inspections).map(([key, label, value]) => /* @__PURE__ */React.createElement("div", {
      className: "snapshot-row snapshot-" + key,
      key
    }, /* @__PURE__ */React.createElement("dt", null, label), /* @__PURE__ */React.createElement("dd", {
      "data-metric": key
    }, value)))), /* @__PURE__ */React.createElement("p", {
      className: "snapshot-note"
    }, "Business receipts less recorded expenses; planned costs kept separate.")), /* @__PURE__ */React.createElement("div", {
      className: "snapshot-household"
    }, /* @__PURE__ */React.createElement("h3", null, "Personal / household"), /* @__PURE__ */React.createElement("dl", null, /* @__PURE__ */React.createElement("div", {
      className: "snapshot-row"
    }, /* @__PURE__ */React.createElement("dt", null, "Recorded"), /* @__PURE__ */React.createElement("dd", {
      "data-metric": "household"
    }, currency(sum(homes2.filter(e => e.state === "recorded"))))), /* @__PURE__ */React.createElement("div", {
      className: "snapshot-row"
    }, /* @__PURE__ */React.createElement("dt", null, "Planned"), /* @__PURE__ */React.createElement("dd", {
      "data-metric": "household-planned"
    }, currency(sum(homes2.filter(e => e.state === "planned"))))), /* @__PURE__ */React.createElement("div", {
      className: "snapshot-row"
    }, /* @__PURE__ */React.createElement("dt", null, "Personal income"), /* @__PURE__ */React.createElement("dd", {
      "data-metric": "personal-income"
    }, currency(sum(book.records.filter(e => e.kind === "income" && e.state === "recorded"))))), /* @__PURE__ */React.createElement("div", {
      className: "snapshot-row"
    }, /* @__PURE__ */React.createElement("dt", null, "Income less household expenses"), /* @__PURE__ */React.createElement("dd", {
      "data-metric": "personal-net"
    }, currency(sum(book.records.filter(e => e.kind === "income" && e.state === "recorded")) - sum(homes2.filter(e => e.state === "recorded"))))))));
  }
  function selectTool(k) {
    if (!leaveHousing()) return;
    if (k === "business_defaults") {
      setBusinessDefaultsDraft({
        reportingSoftware: "",
        processor: "",
        bankAccount: "",
        ...reporting.businessDefaults,
        savedDestinations: structuredClone(reporting.savedDestinations || [])
      });
      return;
    }
    if (k === "help") {
      setHelp(true);
      return;
    }
    if (k === "year_setup") {
      if (Object.keys(links).length) setSetupOpen(true);else setError("Link a source year first.");
      return;
    }
    if (k === "categories") {
      if (book) setManageCats(true);else setError("Select a linked year first.");
      return;
    }
    if (k === "compare") compareYears();else {
      setTab(k);
      setSearch("");
    }
  }
  function businessWorkspace() {
    return /* @__PURE__ */React.createElement("div", {
      className: "business-section-workspace"
    }, /* @__PURE__ */React.createElement(PersonalWorkspace, {
      labels: ["Variable expenses", "Recurring expenses"],
      idPrefix: "business",
      ariaLabel: "Business expense sections",
      locked: busy || !!edit || !!noteEdit || !!quickRecord
    }, variableCard(), recurringCard()));
  }
  function personalWorkspace() {
    return /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("div", {
      id: "personal-review-focus"
    }), /* @__PURE__ */React.createElement(PersonalReview, {
      key: year + ":" + month,
      book,
      month,
      reporting,
      busy: busy || householdDirty || incomeDirty || transferDirty || loanDirty,
      onSave: saveReporting,
      onOpen: row => {
        if (!leaveHousing()) return;
        setSearch("");
        setPersonalSection(row.type === "transfer" ? 2 : row.area === "Personal income" ? 0 : 1);
        if (row.type === "transfer") setTransferRequest(row.id);else {
          const entry2 = book.records.find(r => r.id === row.id);
          if (entry2) openEdit(entry2);
        }
      }
    }), /* @__PURE__ */React.createElement(PersonalWorkspace, {
      key: "personal-" + modules.family,
      labels: ["Personal income", "Household expenses", "Transfers", ...(modules.family ? ["Family repayments"] : [])],
      selectedOverride: personalSection,
      onSelectedChange: setPersonalSection,
      locked: busy || loanBusy || householdDirty || incomeDirty || loanDirty || transferDirty
    }, personalCard(), housingCard(), transferCard(), modules.family && loanPanel(true)));
  }
  function personalCard() {
    return /* @__PURE__ */React.createElement(HouseholdWorkspace, {
      initiallyExpanded: true,
      key: "income-" + year,
      income: true,
      book,
      month,
      onSave: save,
      onEdit: openEdit,
      onNotes: noteBlock,
      busy,
      search,
      onDirty: setIncomeDirty
    });
  }
  function managedEntries() {
    return book.records.filter(e => e.scope === "residence" && housingLabel(e) === labelManager?.label);
  }
  async function renameHousingLabel(event) {
    event.preventDefault();
    const name = labelManager.name.trim();
    if (!name) return;
    const next = structuredClone(book);
    for (const e of next.records.filter(e2 => e2.scope === "residence" && housingLabel(e2) === labelManager.label)) {
      e.subCategory = name;
      if (e.description === labelManager.label) e.description = name;
    }
    const cat = next.categories.find(c => c.name === residenceName);
    if (cat && !cat.subs.includes(name)) cat.subs.push(name);
    await save(next, () => setLabelManager(null));
  }
  async function removeHousingLabel() {
    const entries = managedEntries();
    if (!confirm("Remove \u201C" + labelManager.label + "\u201D and its " + entries.length + " entries from ALL months in " + year + "? Recorded total: " + currency(sum(entries.filter(e => e.state === "recorded"))) + ". Attached notes will also be removed. A workbook backup is created before saving.")) return;
    const ids = new Set(entries.map(e => e.id));
    await save({
      ...book,
      records: book.records.filter(e => !ids.has(e.id)),
      notes: book.notes.filter(n => !ids.has(n.recordId))
    }, () => setLabelManager(null));
  }
  function recurringCard() {
    const items = expenses.filter(isRecurring),
      group = e => e.subCategory || "Uncategorized",
      labels = [... /* @__PURE__ */new Set([...(book.categories.find(c => c.name === recurringName)?.subs || []), ...items.map(group)])].filter(label => items.some(e => group(e) === label));
    return /* @__PURE__ */React.createElement("section", {
      className: "expense-group recurring-group",
      "aria-label": "Recurring expenses card"
    }, /* @__PURE__ */React.createElement("div", {
      className: "expense-group-heading"
    }, /* @__PURE__ */React.createElement("button", {
      className: "variable-disclosure",
      "aria-expanded": recurringOpen || !!search.trim(),
      "aria-controls": "recurring-categories",
      onClick: () => setRecurringOpen(!recurringOpen)
    }, /* @__PURE__ */React.createElement("span", {
      "aria-hidden": "true"
    }, recurringOpen ? "\u25BE" : "\u25B8"), /* @__PURE__ */React.createElement("span", null, /* @__PURE__ */React.createElement("h3", null, "Recurring Expenses"), /* @__PURE__ */React.createElement("small", null, "Subscriptions, Payments And Other Recurring Costs"))), /* @__PURE__ */React.createElement("div", {
      className: "group-amounts"
    }, /* @__PURE__ */React.createElement("span", null, "Recorded ", /* @__PURE__ */React.createElement("strong", null, currency(sum(items.filter(e => e.state === "recorded"))))), /* @__PURE__ */React.createElement("span", null, "Planned ", /* @__PURE__ */React.createElement("strong", null, currency(sum(items.filter(e => e.state === "planned"))))))), (recurringOpen || !!search.trim()) && /* @__PURE__ */React.createElement("div", {
      id: "recurring-categories"
    }, labels.map(label => categorySection(label, items.filter(e => group(e) === label), {
      key: "recurring:" + label,
      storageCategory: recurringName,
      subCategory: label === "Uncategorized" ? "" : label
    })), !items.length && /* @__PURE__ */React.createElement("div", {
      className: "small-empty"
    }, "No recurring expenses this month.")));
  }
  useEffect(() => {
    lockLinks();
  }, [tab, year, month, businessArea, !!linkForm, !!newYear, setupOpen]);
  const brandLogo = profile.preferences.logo ? /* @__PURE__ */React.createElement("img", {
    className: "brand-custom-logo",
    alt: "Your logo",
    src: "/logo.png?v=" + profile.revision
  }) : null;
  const modalOpen = businessDefaultsDraft || edit || noteEdit || help || linkForm || newYear || manageCats || deleteEntry || quickRecord || labelManager;
  return /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("div", {
    className: "app-shell",
    inert: !!modalOpen || busy || setupOpen
  }, /* @__PURE__ */React.createElement("aside", null, /* @__PURE__ */React.createElement("div", {
    className: "brand"
  }, brandLogo || /* @__PURE__ */React.createElement("svg", {
    className: "brand-diamonds",
    viewBox: "0 0 706 468",
    role: "img",
    "aria-label": "Double Diamond logo"
  }, /* @__PURE__ */React.createElement("path", {
    d: "M228 25 L431 234 L228 443 L25 234 Z M477 25 L680 234 L477 443 L274 234 Z",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "36",
    strokeLinejoin: "miter"
  })), /* @__PURE__ */React.createElement("div", null, profile.preferences.title, /* @__PURE__ */React.createElement("small", null, profile.preferences.tagline))), /* @__PURE__ */React.createElement("p", {
    className: "developer-credit"
  }, "Developed by ", /* @__PURE__ */React.createElement("strong", null, "Double Diamond Labs"), /* @__PURE__ */React.createElement("span", null, " - Adventure On!")), /* @__PURE__ */React.createElement(Tribute, {
    settings: editions || initialEditions
  }), /* @__PURE__ */React.createElement("p", {
    className: "brand-version"
  }, "Version 3.32.53-alpha.2 \xB7 Experimental"), /* @__PURE__ */React.createElement(SidebarNav, {
    collapsibleKeys: ["month"],
    renderBelow: key => key === "month" ? /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement(BusinessPeriodNav, {
      year,
      month,
      links,
      busy,
      onOpen: openBusinessPeriod
    }), /* @__PURE__ */React.createElement(BusinessActivityNav, {
      active: tab === "activity",
      section: activitySection,
      busy,
      onOpen: section => {
        if (busy || !leaveHousing()) return;
        setActivitySection(section);
        setActivityRequest({
          section
        });
        setTab("activity");
        setSearch("");
      }
    })) : null,
    items: [...visibleNav, ...(modules.move && moveEnabled ? [["move", Home, "Move & Housing Planner"]] : []), ...(modules.loans ? debtState?.loans || [] : []).filter(l => !l.archived).map(l => ["debt_" + l.id, BookOpen, l.name])],
    order: navigationOrder,
    ready: navigationReady,
    active: tab,
    onSelect: k => {
      if (!leaveHousing()) return;
      if (k === "month") setBusinessArea("choose");
      k === "compare" ? compareYears() : (setTab(k), setSearch(""));
    },
    onSave: async order => {
      const r = await api("navigation", {
        order: mergeHiddenOrder(navigationOrder, order),
        previousOrder: navigationOrder
      });
      setNavigationOrder(r.navigationOrder);
      if (r.toolsOrder) setToolsOrder(r.toolsOrder);
      setStatus("Navigation order saved");
    }
  }), annualSnapshot(), /* @__PURE__ */React.createElement("section", {
    className: "tools-settings",
    "aria-label": "Tools and settings"
  }, /* @__PURE__ */React.createElement(ToolsNav, {
    api,
    items: visibleTools,
    order: toolsOrder || navigationOrder.filter(k => toolItems.some(i => i[0] === k)),
    ready: navigationReady,
    active: tab,
    onSelect: selectTool
  })), /* @__PURE__ */React.createElement("div", {
    className: "side-bottom"
  }, /* @__PURE__ */React.createElement(ExitApp, {
    api,
    blocked: !!(busy || loanBusy || editionDirty || inspectionDirty || overviewDirty || edit || noteEdit || quickRecord || housingDirty || bankDirty || householdDirty || incomeDirty || loanDirty || transferDirty || setupOpen || businessDefaultsDraft || linkForm || newYear || manageCats || labelManager)
  }), /* @__PURE__ */React.createElement("strong", null, "Your files, your location."), /* @__PURE__ */React.createElement("p", null, "Workbooks and backups stay in the folders you choose\u2014on this computer or a private network share."))), /* @__PURE__ */React.createElement("main", {
    className: tab === "month" ? "business-workspace-page" : tab === "summary" ? "summary-workspace-page" : ""
  }, /* @__PURE__ */React.createElement("header", null, /* @__PURE__ */React.createElement("span", null, profile.preferences.householdName, " / ", year), /* @__PURE__ */React.createElement("span", {
    className: "save-status"
  }, busy ? "Working\u2026" : status, (tab === "loan" ? loanState : fileInfo) && /* @__PURE__ */React.createElement("details", {
    className: "active-workbook"
  }, /* @__PURE__ */React.createElement("summary", null, "Active workbook: ", (tab === "loan" ? loanState : fileInfo).name), /* @__PURE__ */React.createElement("span", null, (tab === "loan" ? loanState : fileInfo).path))), /* @__PURE__ */React.createElement("div", {
    className: "header-exit"
  }, /* @__PURE__ */React.createElement(ExitApp, {
    api,
    blocked: !!(busy || loanBusy || editionDirty || inspectionDirty || overviewDirty || edit || noteEdit || quickRecord || housingDirty || bankDirty || householdDirty || incomeDirty || loanDirty || transferDirty || setupOpen || businessDefaultsDraft || linkForm || newYear || manageCats || labelManager)
  }))), /* @__PURE__ */React.createElement("div", {
    className: "heading"
  }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("span", {
    className: "eyebrow"
  }, "YOUR MONEY, IN VIEW"), /* @__PURE__ */React.createElement("h1", null, {
    preferences: "Modules & appearance",
    move: "Move & Housing Planner",
    move_setup: "Move Planner Settings",
    activity: "Business Activity & Mileage",
    tax: "Tax Preparation",
    overview: "Home / Overview",
    recovery: "Backup & Recovery",
    brief: "Inspection Brief",
    loan: loanState?.loan?.borrower ? loanState.loan.borrower + " \xB7 Repayments" : "Family Loan",
    month: "Monthly workspace",
    recurring: "Recurring expenses",
    home: "Household finances",
    summary: "Year-end summary",
    bank: "Bank import",
    compare: "Year comparison",
    notes: "The notes behind the numbers",
    links: "Linked workbooks",
    locations: "Active files & backups",
    debts: "Loan trackers"
  }[tab] || (tab.startsWith("debt_") ? (debtState?.loans || []).find(l => "debt_" + l.id === tab)?.name || "New loan tracker" : "")), /* @__PURE__ */React.createElement("p", null, tab === "recovery" ? "Protect your files, manage backup history, or review a recovery copy." : tab === "home" ? "Full household costs, kept separate from direct business spending." : tab === "compare" ? "Compare recorded income and spending across matching periods." : "Amounts and the details that explain them, together.")), ["month", "summary"].includes(tab) ? /* @__PURE__ */React.createElement("div", {
    className: "business-heading-lock"
  }, /* @__PURE__ */React.createElement(LinkLockBar, null)) : /* @__PURE__ */React.createElement("div", {
    className: "local-label"
  }, /* @__PURE__ */React.createElement(Home, {
    size: 16
  }), "Local workbook \xB7 saved on your device/share")), error && /* @__PURE__ */React.createElement("div", {
    className: "error",
    role: "alert"
  }, error, /* @__PURE__ */React.createElement("button", {
    "aria-label": "Dismiss error",
    onClick: () => setError("")
  }, /* @__PURE__ */React.createElement(X, {
    size: 17
  }))), tab === "month" ? /* @__PURE__ */React.createElement("section", {
    className: "business-orientation compact-business-orientation",
    "aria-label": "Business period and financial summary"
  }, /* @__PURE__ */React.createElement("div", {
    className: "business-period-card"
  }, /* @__PURE__ */React.createElement(PeriodDisclosure, {
    id: "workspace",
    label: months[month] + " " + year
  }, periodTabs(false))), /* @__PURE__ */React.createElement("div", {
    className: "business-summary-card"
  }, book ? totalsPanel(active) : /* @__PURE__ */React.createElement("div", {
    className: "business-summary-empty"
  }, /* @__PURE__ */React.createElement("h2", null, months[month], " ", year, " \xB7 Monthly totals"), /* @__PURE__ */React.createElement("p", null, "Link a workbook to view this month\u2019s totals.")))) : tab !== "summary" && tab !== "loan" && tab !== "find" && tab !== "brief" && tab !== "overview" && !["preferences", "edition", "move", "move_setup"].includes(tab) && /* @__PURE__ */React.createElement(LinkLockBar, null), tab === "overview" || tab === "month" || tab === "summary" && book ? null : !["preferences", "edition", "move", "move_setup"].includes(tab) && !tab.startsWith("debt") && tab !== "compare" && tab !== "recovery" && tab !== "links" && tab !== "loan" && tab !== "locations" && tab !== "find" && tab !== "brief" && (tab === "month" ? /* @__PURE__ */React.createElement(PeriodDisclosure, {
    id: "workspace",
    label: months[month] + " " + year
  }, periodTabs(false)) : periodTabs(false)), tab === "month" && book && /* @__PURE__ */React.createElement("details", {
    id: "business-financial-review",
    className: "business-financial-review",
    open: businessReviewOpen,
    onToggle: e => setBusinessReviewOpen(e.currentTarget.open)
  }, /* @__PURE__ */React.createElement("summary", null, "Business financial reconciliation \xB7 ", months[month], " ", year), /* @__PURE__ */React.createElement(PersonalReview, {
    domain: "business",
    key: "business-review:" + year + ":" + month,
    book,
    month,
    reporting,
    busy: busy || inspectionDirty || overviewDirty,
    onSave: saveReporting,
    onOpen: row => {
      if (!leaveHousing()) return;
      setSearch("");
      if (row.type === "transfer") {
        setTab("home");
        setPersonalSection(2);
        setTransferRequest(row.id);
      } else if (modules.inspections && row.id.startsWith("event:")) {
        const event = ledger(book).events.find(e => e.id === row.id.slice(6));
        if (event) {
          setBusinessArea("inspections");
          setInspectionRequest(event.jobId);
        }
      } else {
        const entry2 = book.records.find(r => r.id === row.id);
        if (entry2) {
          setBusinessArea("expenses");
          openEdit(entry2);
        }
      }
    }
  })), tab === "month" && book && modules.inspections && /* @__PURE__ */React.createElement(MonthProgress, {
    workspaceActions: /* @__PURE__ */React.createElement("div", {
      className: "business-area-tabs",
      role: "group",
      "aria-label": "Business workspace area"
    }, /* @__PURE__ */React.createElement("div", {
      className: "business-area-prompt"
    }, /* @__PURE__ */React.createElement("strong", null, months[month], " ", year), /* @__PURE__ */React.createElement("span", null, "What Would You Like To Work On?")), [["expenses", "Expenses"], ["inspections", "Inspections & Income"], ...(modules.rom ? [["rom", "R\u014DM \xB7 Inspection Travel"]] : [])].map(([id, label]) => /* @__PURE__ */React.createElement("button", {
      key: id,
      "aria-pressed": businessArea === id,
      className: businessArea === id ? "primary" : "",
      disabled: busy,
      onClick: () => {
        if (id !== businessArea && leaveHousing()) {
          setSearch("");
          setBusinessArea(id);
        }
      }
    }, label))),
    informationAsOf,
    key: year + ":" + month,
    book,
    month,
    reporting,
    onSaveReporting: saveReporting,
    busy: busy || inspectionDirty || overviewDirty,
    onAction: action => {
      if (leaveHousing()) {
        setBusinessArea("inspections");
        setProgressAction({
          ...action,
          requestId: Date.now()
        });
        setSearch("");
      }
    }
  }), tab === "month" && book && !modules.inspections && /* @__PURE__ */React.createElement("div", {
    className: "business-area-tabs",
    role: "group",
    "aria-label": "Business workspace area"
  }, /* @__PURE__ */React.createElement("div", {
    className: "business-area-prompt"
  }, /* @__PURE__ */React.createElement("strong", null, months[month], " ", year), /* @__PURE__ */React.createElement("span", null, "What Would You Like To Work On?")), [["expenses", "Expenses"], modules.inspections ? ["inspections", "Inspections & Income"] : ["income", "Income & refunds"]].map(([id, label]) => /* @__PURE__ */React.createElement("button", {
    key: id,
    "aria-pressed": businessArea === id,
    className: businessArea === id ? "primary" : "",
    disabled: busy,
    onClick: () => {
      if (id !== businessArea && leaveHousing()) {
        setSearch("");
        setBusinessArea(id);
      }
    }
  }, label))), book && !["preferences", "move", "move_setup"].includes(tab) && tab !== "month" && !tab.startsWith("debt") && tab !== "overview" && tab !== "recovery" && tab !== "compare" && tab !== "links" && tab !== "activity" && tab !== "tax" && tab !== "find" && tab !== "brief" && tab !== "rearview" && tab !== "edition" && tab !== "summary" && tab !== "bank" && tab !== "loan" && tab !== "locations" && (tab === "home" ? residenceMonthly() : totalsPanel(active)), tab === "brief" ? /* @__PURE__ */React.createElement(InspectionBrief, {
    api,
    readBook
  }) : tab === "find" ? /* @__PURE__ */React.createElement(FindThings, {
    modules,
    links,
    api,
    readBook,
    onOpen: openFound,
    state: findState,
    onState: setFindState,
    busy
  }) : tab === "rearview" && book ? /* @__PURE__ */React.createElement(Rearview, {
    modules,
    key: book.year,
    book,
    api,
    onDirty: setOverviewDirty
  }) : tab === "edition" ? /* @__PURE__ */React.createElement(EditionSettings, {
    value: editions || initialEditions,
    onDirty: setEditionDirty,
    onSave: async settings => {
      const r = await api("editions", {
        settings,
        previous: editions
      });
      setEditions(r.editions);
      setStatus("Edition & Tribute saved");
    }
  }) : tab === "preferences" ? /* @__PURE__ */React.createElement(Preferences, {
    state: profile,
    api,
    onDirty: setOverviewDirty,
    onSaved: r => {
      setProfile(r);
      setBusinessArea("choose");
      setComparisonView({});
      setSummaryView(null);
    }
  }) : ["move", "move_setup"].includes(tab) ? /* @__PURE__ */React.createElement(MovePlanner, {
    api,
    links,
    onDirty: setOverviewDirty,
    onEnabled: setMoveEnabled
  }) : tab.startsWith("debt") ? /* @__PURE__ */React.createElement(DebtTrackers, {
    allowBusiness: modules.business,
    workspaceYear: year,
    workspaceMonth: month,
    key: tab,
    state: debtState,
    books: debtBooks,
    packets: debtPackets,
    errors: debtErrors,
    activeId: tab.startsWith("debt_") ? tab.slice(5) : null,
    onSave: saveDebts,
    onReload: async () => {
      await loadDebts();
      if (links[year]) await load(year, true);
    },
    onOpen: setTab,
    api,
    onDirty: setOverviewDirty
  }) : tab === "overview" ? /* @__PURE__ */React.createElement(Overview, {
    yearNavigation: /* @__PURE__ */React.createElement("div", {
      className: "year-tabs",
      "aria-label": "Overview year"
    }, Object.keys(links).sort().map(y => /* @__PURE__ */React.createElement("button", {
      key: y,
      className: Number(y) === year ? "active" : "",
      onClick: () => chooseYear(Number(y))
    }, y))),
    modules,
    onReviewTask: ({
      domain,
      month: target,
      kind
    }) => {
      if (!leaveHousing()) return;
      setMonth(target);
      setSearch("");
      setInspectionRequest(null);
      setProgressAction(null);
      setTab(domain === "personal" ? "home" : "month");
      setBusinessReviewOpen(kind === "financial");
      if (domain === "personal") setPersonalSection(0);else setBusinessArea(kind === "inspection" ? "inspections" : "expenses");
      setTimeout(() => document.getElementById(domain === "personal" ? "personal-review-focus" : kind === "inspection" ? "inspection-month-review" : "business-financial-review")?.scrollIntoView?.({
        block: "start",
        behavior: "smooth"
      }), 80);
    },
    onReviewMonth: m => {
      if (!leaveHousing()) return;
      setMonth(m);
      setTab("home");
      setSearch("");
      setPersonalSection(0);
    },
    debtLoans: debtState?.loans || [],
    debtBooks,
    book,
    year,
    reporting,
    loanState,
    api,
    onDirty: setOverviewDirty,
    onOpen: k => {
      if (leaveHousing()) {
        if (k === "month") setBusinessArea("choose");
        if (k === "summary") setSummaryView(null);
        setTab(k);
      }
    },
    onReload: async () => {
      await config();
      if (links[year]) await load(year, true);
      await loadLoan();
      await loadDebts();
    }
  }) : tab === "recovery" ? /* @__PURE__ */React.createElement(Recovery, {
    api,
    onDirty: setOverviewDirty
  }) : tab === "locations" ? /* @__PURE__ */React.createElement(FileLocations, {
    api
  }) : tab === "loan" ? loanPanel(false) : tab === "bank" && book ? /* @__PURE__ */React.createElement(BankImport, {
    book,
    session: bankSession,
    setSession: setBankSession,
    onSave: save
  }) : ["activity", "tax"].includes(tab) && book ? /* @__PURE__ */React.createElement(BusinessReports, {
    onOpenMileage: () => {
      setActivityRequest({
        section: "mileage"
      });
      setActivitySection("mileage");
      setTab("activity");
    },
    onEditEntry: openReportEntry,
    onReviewMonth: m => {
      if (!leaveHousing()) return;
      setMonth(months.indexOf(m));
      setBusinessArea("expenses");
      setBusinessReviewOpen(true);
      setTab("month");
      setSearch("");
      setTimeout(() => document.getElementById("business-financial-review")?.scrollIntoView?.({
        block: "start",
        behavior: "smooth"
      }), 80);
    },
    key: tab + year,
    mode: tab,
    initialState: tab === "activity" ? activityStates.current[year] || (reportReturn?.year === year ? reportReturn.state : void 0) : void 0,
    sectionRequest: tab === "activity" ? activityRequest : null,
    onSectionHandled: () => setActivityRequest(null),
    onState: tab === "activity" ? state => {
      activityStates.current[year] = state;
      setActivitySection(state.tab);
    } : void 0,
    onOpenInspection: openActivityInspection,
    book,
    reporting,
    onSaveReporting: saveReporting,
    loans: debtState?.loans || [],
    debtBooks,
    debtErrors,
    onOpen: setTab
  }) : tab === "summary" && book ? /* @__PURE__ */React.createElement(YearSummary, {
    periodNavigation: periodTabs(false),
    links,
    api,
    readBook,
    allowBusiness: modules.business,
    onOpenReport: modules.business ? setTab : void 0,
    initialView: summaryView,
    onCompareYears: compareYears,
    book,
    reporting,
    onSaveReporting: saveReporting,
    onEditEntry: openReportEntry
  }) : tab === "links" ? /* @__PURE__ */React.createElement("section", {
    className: "panel"
  }, /* @__PURE__ */React.createElement("div", {
    className: "panel-heading"
  }, /* @__PURE__ */React.createElement("h2", null, "Workbook connections"), Object.keys(links).length > 0 && /* @__PURE__ */React.createElement("button", {
    onClick: () => setSetupOpen(true)
  }, "Prepare / Refresh Next Year"), /* @__PURE__ */React.createElement("button", {
    className: "primary",
    onClick: () => {
      if (leaveHousing()) setLinkForm({
        year,
        path: "",
        preview: null
      });
    }
  }, /* @__PURE__ */React.createElement(Link, {
    size: 17
  }), "Link Workbook")), /* @__PURE__ */React.createElement("p", {
    className: "panel-copy"
  }, "One file per year. Linking remembers its location; it does not upload or copy the file."), Object.entries(links).sort().map(([y, item]) => /* @__PURE__ */React.createElement("div", {
    className: "linked-row",
    key: y
  }, /* @__PURE__ */React.createElement("strong", null, y, item.test && /* @__PURE__ */React.createElement("span", {
    className: "badge planned"
  }, "Test copy")), /* @__PURE__ */React.createElement("code", null, item.path), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("button", {
    onClick: () => setLinkForm({
      year: y,
      path: "",
      preview: null
    })
  }, "Replace Link"), /* @__PURE__ */React.createElement("button", {
    onClick: () => unlink(y)
  }, "Unlink"))))) : tab === "compare" ? /* @__PURE__ */React.createElement(YearComparison, {
    allowBusiness: modules.business,
    initialView: comparisonView,
    books: compare.filter(x => x.book).map(x => x.book),
    errors: compare.filter(x => x.error),
    loading: compareLoading,
    settings: reporting,
    onEditEntry: openReportEntry,
    onReload: () => compareYears(),
    onBack: async view => {
      setSummaryView(view);
      if (view.year && view.year !== year) await chooseYear(view.year);
      setTab("summary");
    }
  }) : !book ? /* @__PURE__ */React.createElement("section", {
    className: "empty panel"
  }, /* @__PURE__ */React.createElement(CalendarDays, {
    size: 32
  }), /* @__PURE__ */React.createElement("h2", null, year, " needs a workbook"), /* @__PURE__ */React.createElement("p", null, "Link an existing file or create a new workbook with January\u2013December sheets."), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("button", {
    className: "primary",
    onClick: () => {
      if (leaveHousing()) setLinkForm({
        year,
        path: "",
        preview: null
      });
    }
  }, "Link Workbook"), /* @__PURE__ */React.createElement("button", {
    onClick: () => setNewYear({
      year,
      copy: false
    })
  }, "Create Workbook"))) : /* @__PURE__ */React.createElement(React.Fragment, null, fileInfo?.test && /* @__PURE__ */React.createElement("div", {
    className: "notice"
  }, "You are using the included 2026 test copy. Your original workbook is untouched. ", /* @__PURE__ */React.createElement("button", {
    onClick: () => {
      if (leaveHousing()) setLinkForm({
        year,
        path: "",
        preview: null
      });
    }
  }, "Link Your Working Workbook")), !book.converted && /* @__PURE__ */React.createElement("div", {
    className: "notice neutral"
  }, "On the first save, the app adds workbook tracking sheets and updates monthly summaries. Original cell comments stay in place, and a complete backup is created first. Current/future recurring entries start as planned; review any that have already occurred."), tab === "month" && modules.inspections && businessArea === "choose" && /* @__PURE__ */React.createElement(MonthlyInspectionRegister, {
    key: year + ":" + month,
    book,
    month,
    busy: busy || inspectionDirty || overviewDirty,
    onOpen: action => {
      if (leaveHousing()) {
        setBusinessArea("inspections");
        setProgressAction({
          ...action,
          requestId: Date.now()
        });
        setSearch("");
      }
    }
  }), (tab !== "month" || !["choose", "rom"].includes(businessArea)) && /* @__PURE__ */React.createElement("div", {
    className: "toolbar"
  }, /* @__PURE__ */React.createElement("label", {
    className: "search"
  }, /* @__PURE__ */React.createElement(Search, {
    size: 17
  }), /* @__PURE__ */React.createElement("input", {
    "aria-label": "Search entries and notes",
    placeholder: "Search entries and notes\u2026",
    value: search,
    onChange: e => setSearch(e.target.value)
  })), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("button", {
    onClick: () => setExpandAll(!expandAll)
  }, /* @__PURE__ */React.createElement(MessageSquare, {
    size: 16
  }), expandAll ? "Collapse Notes" : "Expand Notes"), /* @__PURE__ */React.createElement("button", {
    onClick: () => load(year)
  }, /* @__PURE__ */React.createElement(RefreshCw, {
    size: 16
  }), "Reload Workbook"), modules.business && tab !== "home" && /* @__PURE__ */React.createElement("button", {
    onClick: () => setManageCats(true)
  }, "Business Categories"))), tab === "month" && businessArea === "income" && /* @__PURE__ */React.createElement("section", {
    className: "panel"
  }, /* @__PURE__ */React.createElement("div", {
    className: "panel-heading"
  }, /* @__PURE__ */React.createElement("h2", null, months[month], " ", year, " \xB7 Business receipts"), /* @__PURE__ */React.createElement("button", {
    className: "primary",
    onClick: () => add("inspection")
  }, "Add business receipt / refund")), /* @__PURE__ */React.createElement("p", null, "Enter money received as positive; refunds as negative. Bank deposits are not additional income when already recorded here."), /* @__PURE__ */React.createElement("table", null, /* @__PURE__ */React.createElement("thead", null, /* @__PURE__ */React.createElement("tr", null, /* @__PURE__ */React.createElement("th", null, "Description"), /* @__PURE__ */React.createElement("th", null, "Date / month"), /* @__PURE__ */React.createElement("th", null, "Amount"), /* @__PURE__ */React.createElement("th", null, "Details"))), /* @__PURE__ */React.createElement("tbody", null, incomeRecords(book).filter(r => r.kind === "inspection" && r.month === months[month]).map(r => /* @__PURE__ */React.createElement("tr", {
    key: r.id
  }, /* @__PURE__ */React.createElement("td", null, r.description), /* @__PURE__ */React.createElement("td", null, r.transactionDate || r.month), /* @__PURE__ */React.createElement("td", null, currency(r.amount || 0)), /* @__PURE__ */React.createElement("td", null, r.sourceJobId ? /* @__PURE__ */React.createElement("span", null, "Enable Inspections & Travel to edit this job payment.") : /* @__PURE__ */React.createElement("button", {
    onClick: () => openEdit(r)
  }, "Edit receipt"))))))), tab === "notes" ? /* @__PURE__ */React.createElement("section", {
    className: "notes-grid"
  }, book.notes.filter(n => (active.some(e => e.id === n.recordId) || !n.recordId && n.sheet === months[month]) && n.text.toLowerCase().includes(search.toLowerCase())).map(n => /* @__PURE__ */React.createElement("article", {
    className: "note-card",
    key: n.id
  }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("strong", null, n.sheet, " \xB7 ", n.cell), /* @__PURE__ */React.createElement("button", {
    onClick: () => setNoteEdit({
      ...n
    })
  }, "Edit Note")), /* @__PURE__ */React.createElement("p", null, clean(n.text))))) : /* @__PURE__ */React.createElement("div", {
    className: "monthly-grid single"
  }, (tab !== "month" || businessArea === "expenses") && /* @__PURE__ */React.createElement("div", {
    className: "expense-column"
  }, /* @__PURE__ */React.createElement("div", {
    className: "section-title"
  }, /* @__PURE__ */React.createElement("h2", null, months[month], " ", year), tab !== "home" && /* @__PURE__ */React.createElement("button", {
    className: "primary",
    onClick: () => add("expense", tab === "home" ? residenceName : tab === "recurring" ? recurringName : "Office Expenses", tab === "home" ? "residence" : "business")
  }, /* @__PURE__ */React.createElement(Plus, {
    size: 17
  }), "Add ", tab === "home" ? "Household Expense" : "Expense")), tab === "home" ? /* @__PURE__ */React.createElement(React.Fragment, null, personalWorkspace()) : tab === "recurring" ? recurringCard() : /* @__PURE__ */React.createElement(React.Fragment, null, businessWorkspace())), tab === "month" && modules.inspections && ["inspections", "rom"].includes(businessArea) && /* @__PURE__ */React.createElement("section", {
    className: "inspection-column"
  }, tab === "month" && /* @__PURE__ */React.createElement(InspectionIncome, {
    allowRom: !!modules.rom,
    initialTravel: businessArea === "rom",
    onTravelClose: () => setBusinessArea("inspections"),
    loadTravelBooks,
    onMoved: targetMonth => {
      setInspectionDirty(false);
      setInspectionRequest(null);
      setProgressAction(null);
      setMonth(targetMonth);
    },
    onBackReport: reportReturn?.year === year ? () => {
      setInspectionDirty(false);
      setInspectionRequest(null);
      setProgressAction(null);
      setTab("activity");
    } : void 0,
    reporting,
    onSaveReporting: saveReporting,
    onRemoveOriginal: setDeleteEntry,
    showAttention: false,
    requestAction: progressAction,
    onActionHandled: () => setProgressAction(null),
    key: year + ":" + month + ":" + businessArea,
    book,
    month,
    onSave: save,
    busy: busy || overviewDirty,
    onDirty: setInspectionDirty,
    requestJob: inspectionRequest,
    onRequestHandled: () => setInspectionRequest(null)
  }), businessArea !== "rom" && /* @__PURE__ */React.createElement("details", {
    className: "inspection-reference-section",
    key: "reference:" + year + ":" + month
  }, /* @__PURE__ */React.createElement("summary", null, "Reference & original records"), /* @__PURE__ */React.createElement("div", {
    className: "inspection-reference-body"
  }, ledger(book).retired.length > 0 && /* @__PURE__ */React.createElement("details", {
    className: "reference-retired"
  }, /* @__PURE__ */React.createElement("summary", null, "Preserved entries excluded from income (", ledger(book).retired.length, ")"), ledger(book).retired.map(r => /* @__PURE__ */React.createElement("p", {
    key: r.recordId
  }, jobLabel(book, r.recordId), " \xB7 ", currency((book.records.find(e => e.id === r.recordId) || ledger(book).sources?.find(e => e.id === r.recordId))?.amount || 0), " \xB7 ", r.reason))), /* @__PURE__ */React.createElement("details", {
    className: "category-panel inspection-panel"
  }, /* @__PURE__ */React.createElement("summary", {
    style: {
      padding: 14
    }
  }, "Original workbook entries and ordering"), /* @__PURE__ */React.createElement(InspectionOrder, {
    key: year + ":" + month,
    items: inspections,
    busy: busy || inspectionDirty,
    search,
    onDirty: setOverviewDirty,
    onSave: saveInspectionOrder,
    label: e => clean(notesFor(e.id).find(n => n.cell.startsWith("K"))?.text || "").split("\n")[0] || e.description || "Untitled inspection",
    renderEntry: () => inspections.filter(match).length ? inspections.filter(match).map(e => entry(e, true)) : /* @__PURE__ */React.createElement("div", {
      className: "small-empty"
    }, "No inspections recorded for this month.")
  }), /* @__PURE__ */React.createElement("div", {
    className: "subtotal"
  }, /* @__PURE__ */React.createElement("span", null, "Original row amounts (audit)", /* @__PURE__ */React.createElement("strong", null, currency(sum(inspections)))), /* @__PURE__ */React.createElement("span", null, "Original miles", /* @__PURE__ */React.createElement("strong", null, sum(inspections, "miles").toLocaleString())))))))), /* @__PURE__ */React.createElement("footer", null, /* @__PURE__ */React.createElement("span", null, "Linked: ", fileInfo?.path), /* @__PURE__ */React.createElement("button", {
    onClick: () => setHelp(true)
  }, "Saving & Backups"))))), modalOpen && /* @__PURE__ */React.createElement("dialog", {
    onCancel: e => {
      if (busy) e.preventDefault();else {
        setEdit(null);
        setNoteEdit(null);
        setHelp(false);
        setLinkForm(null);
        setNewYear(null);
        setManageCats(false);
        setDeleteEntry(null);
        setQuickRecord(null);
        setLabelManager(null);
        setBusinessDefaultsDraft(null);
      }
    }
  }, /* @__PURE__ */React.createElement("div", {
    className: "modal-head"
  }, /* @__PURE__ */React.createElement("h2", null, businessDefaultsDraft ? "Business Defaults" : labelManager ? "Manage household label" : quickRecord ? "Record this month" : edit ? book.records.some(e => e.id === edit.id) ? "Edit entry" : "Add entry" : noteEdit ? "Edit note" : linkForm ? "Link a workbook" : newYear ? "Add a calendar year" : manageCats ? "Categories & subcategories" : deleteEntry ? "Remove this entry?" : "Local workbooks & saving"), /* @__PURE__ */React.createElement("button", {
    "aria-label": "Close dialog",
    disabled: busy,
    onClick: () => {
      setEdit(null);
      setNoteEdit(null);
      setHelp(false);
      setLinkForm(null);
      setNewYear(null);
      setManageCats(false);
      setDeleteEntry(null);
      setQuickRecord(null);
      setLabelManager(null);
      setBusinessDefaultsDraft(null);
      setError("");
    }
  }, /* @__PURE__ */React.createElement(X, null))), error && /* @__PURE__ */React.createElement("div", {
    className: "error",
    role: "alert"
  }, error), /* @__PURE__ */React.createElement("div", {
    inert: busy
  }, businessDefaultsDraft && /* @__PURE__ */React.createElement("form", {
    onSubmit: async e => {
      e.preventDefault();
      setBusy(true);
      setError("");
      try {
        const {
          savedDestinations,
          ...fields
        } = businessDefaultsDraft;
        const businessDefaults = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim()]));
        await saveReporting({
          ...reporting,
          businessDefaults,
          savedDestinations: validateDestinations(savedDestinations)
        });
        setBusinessDefaultsDraft(null);
        setStatus("Business defaults saved");
      } catch (e2) {
        setError(e2.message);
      } finally {
        setBusy(false);
      }
    }
  }, /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Prefill new entries across all linked years. Each entry remains editable; existing records and verification selections are unchanged. Leave a default blank to enter it each time."), [["reportingSoftware", "Inspection Software", 100], ["processor", "Payment Processor", 100], ["bankAccount", "Business Bank / Account Label", 200]].map(([key, label, max]) => /* @__PURE__ */React.createElement("label", {
    key
  }, label, /* @__PURE__ */React.createElement("input", {
    maxLength: max,
    value: businessDefaultsDraft[key] || "",
    onChange: e => setBusinessDefaultsDraft({
      ...businessDefaultsDraft,
      [key]: e.target.value
    })
  }))), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Use an account nickname, such as Business Checking. Account numbers are not needed."), /* @__PURE__ */React.createElement(Destinations, {
    items: businessDefaultsDraft.savedDestinations || [],
    onChange: savedDestinations => setBusinessDefaultsDraft({
      ...businessDefaultsDraft,
      savedDestinations
    })
  }), /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, "Save Business Defaults")), labelManager && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, labelManager.label), " \xB7 all months in ", year), /* @__PURE__ */React.createElement("p", null, "This label appears because of the entries listed below. Edit or remove an individual entry, or rename the label across this year."), managedEntries().map(e => /* @__PURE__ */React.createElement("div", {
    className: "label-entry",
    key: e.id
  }, /* @__PURE__ */React.createElement("span", null, /* @__PURE__ */React.createElement("strong", null, e.month), " \xB7 ", e.description, " \xB7 ", e.state, " \xB7 ", e.amount === null ? "No amount entered" : currency(e.amount)), /* @__PURE__ */React.createElement("button", {
    onClick: () => {
      setLabelManager(null);
      setBusinessDefaultsDraft(null);
      openEdit(e);
    }
  }, "Edit Entry"), /* @__PURE__ */React.createElement("button", {
    onClick: () => {
      setLabelManager(null);
      setBusinessDefaultsDraft(null);
      setDeleteEntry(e);
    }
  }, "Remove Entry"))), !managedEntries().length && /* @__PURE__ */React.createElement("p", null, "No entries. This is a standard input label."), managedEntries().length > 0 && /* @__PURE__ */React.createElement("form", {
    onSubmit: renameHousingLabel
  }, /* @__PURE__ */React.createElement("label", null, "Label name", /* @__PURE__ */React.createElement("input", {
    required: true,
    value: labelManager.name,
    onChange: e => setLabelManager({
      ...labelManager,
      name: e.target.value
    })
  })), /* @__PURE__ */React.createElement("div", {
    className: "modal-actions"
  }, /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, "Rename Label For This Year"), !housingLabels.includes(labelManager.label) && /* @__PURE__ */React.createElement("button", {
    type: "button",
    className: "danger",
    onClick: removeHousingLabel
  }, "Remove Label And All Its Entries"))), housingLabels.includes(labelManager.label) && /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Standard housing labels remain available even when empty.")), quickRecord && /* @__PURE__ */React.createElement("form", {
    onSubmit: recordQuick
  }, /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, quickRecord.description), " \xB7 ", quickRecord.month, " ", year), /* @__PURE__ */React.createElement("label", null, "Actual amount ($)", /* @__PURE__ */React.createElement("input", {
    autoFocus: true,
    required: true,
    type: "number",
    step: "0.01",
    value: quickRecord.amount,
    onChange: e => setQuickRecord({
      ...quickRecord,
      amount: e.target.value
    })
  })), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "This changes only this planned entry to Recorded. Other months and existing notes stay unchanged."), /* @__PURE__ */React.createElement("div", {
    className: "modal-actions"
  }, /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => setQuickRecord(null)
  }, "Cancel"), /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, "Record And Save"))), edit && /* @__PURE__ */React.createElement("form", {
    onSubmit: saveEdit
  }, /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, /* @__PURE__ */React.createElement("label", null, "Month", /* @__PURE__ */React.createElement("select", {
    disabled: book.records.some(r => r.id === edit.id),
    value: edit.month,
    onChange: e => setEdit({
      ...edit,
      month: e.target.value
    })
  }, months.map(m => /* @__PURE__ */React.createElement("option", {
    key: m
  }, m)))), edit.kind !== "inspection" && /* @__PURE__ */React.createElement("label", null, "Record type", /* @__PURE__ */React.createElement("select", {
    value: edit.state,
    onChange: e => setEdit({
      ...edit,
      state: e.target.value
    })
  }, /* @__PURE__ */React.createElement("option", {
    value: "recorded"
  }, "Recorded \xB7 already happened"), /* @__PURE__ */React.createElement("option", {
    value: "planned"
  }, "Planned \xB7 future / estimate")))), book.records.some(r => r.id === edit.id) && /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, /* @__PURE__ */React.createElement("strong", null, "Editing ", edit.month, " ", year, " only."), " Changing months does not happen here. ", /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => {
      setScopeChange("single");
      setDraftNote("");
      setEdit({
        ...edit,
        id: crypto.randomUUID(),
        isNew: true,
        amountCell: null,
        descriptionCell: null,
        milesCell: null,
        locationCell: null,
        transactionDate: "",
        state: "planned"
      });
    }
  }, "Copy To Another Month")), edit.kind === "income" && /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, "Personal income is kept separate from business sales and household expenses. Enter receipts as positive amounts; use a negative amount only to reverse income."), edit.scope === "residence" && /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, /* @__PURE__ */React.createElement("label", null, "Household category", /* @__PURE__ */React.createElement("select", {
    value: edit.householdCategoryId || "",
    onChange: e => {
      const c = book.householdCategories.find(c2 => c2.id === e.target.value);
      setEdit({
        ...edit,
        householdCategoryId: c.id,
        householdSubId: "",
        subCategory: c.name
      });
    }
  }, book.householdCategories.map(c => /* @__PURE__ */React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.name)))), /* @__PURE__ */React.createElement("label", null, "Subcategory", /* @__PURE__ */React.createElement("select", {
    value: edit.householdSubId || "",
    onChange: e => setEdit({
      ...edit,
      householdSubId: e.target.value
    })
  }, /* @__PURE__ */React.createElement("option", {
    value: ""
  }, "Unassigned"), book.householdCategories.find(c => c.id === edit.householdCategoryId)?.subs.map(c => /* @__PURE__ */React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.name))))), edit.kind === "income" && /* @__PURE__ */React.createElement("label", null, "Income source", /* @__PURE__ */React.createElement("select", {
    value: edit.householdCategoryId || "",
    onChange: e => setEdit({
      ...edit,
      householdCategoryId: e.target.value
    })
  }, book.incomeSources.map(c => /* @__PURE__ */React.createElement("option", {
    key: c.id,
    value: c.id
  }, c.name)))), edit.kind === "expense" && edit.scope !== "residence" && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, /* @__PURE__ */React.createElement("label", null, "Category", /* @__PURE__ */React.createElement("select", {
    disabled: inlineCategory?.id === edit.id,
    value: edit.category,
    onChange: e => setEdit({
      ...edit,
      category: e.target.value,
      subCategory: "",
      scope: e.target.value === residenceName ? "residence" : edit.scope
    })
  }, book.categories.map(c => /* @__PURE__ */React.createElement("option", {
    key: c.name
  }, c.name)))), edit.scope === "business" && (inlineCategory?.id === edit.id ? /* @__PURE__ */React.createElement("div", {
    className: "inline-category"
  }, /* @__PURE__ */React.createElement("label", null, "New variable category name", /* @__PURE__ */React.createElement("input", {
    required: true,
    maxLength: 150,
    value: inlineCategory.name,
    onChange: e => setInlineCategory({
      ...inlineCategory,
      name: e.target.value
    })
  })), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Saved with this entry under Variable expenses. Available throughout this workbook\u2019s year; no entries are copied to other months."), /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => setInlineCategory(null)
  }, "Cancel New Category")) : /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => setInlineCategory({
      id: edit.id,
      name: ""
    })
  }, "+ Add New Category")), /* @__PURE__ */React.createElement("label", null, "Subcategory", /* @__PURE__ */React.createElement("input", {
    list: "sub-options",
    value: edit.subCategory || "",
    placeholder: "Choose or type a new one",
    onChange: e => setEdit({
      ...edit,
      subCategory: e.target.value
    })
  }), /* @__PURE__ */React.createElement("datalist", {
    id: "sub-options"
  }, book.categories.find(c => c.name === edit.category)?.subs.map(s => /* @__PURE__ */React.createElement("option", {
    key: s
  }, s))))), /* @__PURE__ */React.createElement("label", null, "Expense group", /* @__PURE__ */React.createElement("select", {
    value: edit.scope,
    onChange: e => setEdit({
      ...edit,
      scope: e.target.value
    })
  }, /* @__PURE__ */React.createElement("option", {
    value: "business"
  }, "Direct business expense"), /* @__PURE__ */React.createElement("option", {
    value: "residence"
  }, "Residence / household cost")))), edit.kind === "inspection" && !modules.inspections && /* @__PURE__ */React.createElement("label", null, "Date received / refunded", /* @__PURE__ */React.createElement("input", {
    type: "date",
    value: edit.transactionDate || "",
    onChange: e => setEdit({
      ...edit,
      transactionDate: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, edit.kind === "inspection" ? modules.inspections ? "Inspection / travel description" : "Business receipt description" : edit.kind === "income" ? "Income source / description" : "What was this for?", /* @__PURE__ */React.createElement("input", {
    required: true,
    autoFocus: true,
    value: edit.description,
    onChange: e => setEdit({
      ...edit,
      description: e.target.value
    })
  })), /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, edit.kind === "inspection" && !modules.inspections && /* @__PURE__ */React.createElement("label", null, "Date received / refunded", /* @__PURE__ */React.createElement("input", {
    type: "date",
    value: edit.transactionDate || "",
    onChange: e => setEdit({
      ...edit,
      transactionDate: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, edit.kind === "inspection" ? "Sale or refund amount ($)" : edit.kind === "income" ? "Income received ($)" : "Full expense amount ($)", /* @__PURE__ */React.createElement("input", {
    type: "number",
    step: "0.01",
    value: edit.amount ?? "",
    onChange: e => setEdit({
      ...edit,
      amount: e.target.value === "" ? null : Number(e.target.value)
    })
  })), edit.kind === "inspection" && modules.inspections ? /* @__PURE__ */React.createElement("label", null, "Miles driven", /* @__PURE__ */React.createElement("input", {
    type: "number",
    min: "0",
    step: "0.1",
    value: edit.miles ?? "",
    onChange: e => setEdit({
      ...edit,
      miles: e.target.value === "" ? null : Number(e.target.value)
    })
  })) : edit.scope === "residence" && modules.business ? /* @__PURE__ */React.createElement("label", null, "Business use (%) \xB7 optional", /* @__PURE__ */React.createElement("input", {
    type: "number",
    min: "0",
    max: "100",
    step: "0.01",
    placeholder: "Leave blank if unknown",
    value: edit.percent ?? "",
    onChange: e => setEdit({
      ...edit,
      percent: e.target.value === "" ? null : Number(e.target.value)
    })
  })) : null), (edit.scope === "residence" || edit.kind === "income") && /* @__PURE__ */React.createElement("label", null, "Date (optional)", /* @__PURE__ */React.createElement("input", {
    type: "date",
    value: edit.transactionDate || "",
    onChange: e => setEdit({
      ...edit,
      transactionDate: e.target.value
    })
  })), edit.kind === "inspection" && modules.inspections && /* @__PURE__ */React.createElement("label", null, "Location", /* @__PURE__ */React.createElement("input", {
    value: edit.location,
    onChange: e => setEdit({
      ...edit,
      location: e.target.value
    })
  })), isRecurring(edit) && edit.scope === "business" && inlineCategory?.id !== edit.id && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, /* @__PURE__ */React.createElement("label", null, "Amount pattern", /* @__PURE__ */React.createElement("select", {
    value: edit.recurringType,
    onChange: e => setEdit({
      ...edit,
      recurringType: e.target.value
    })
  }, /* @__PURE__ */React.createElement("option", {
    value: "fixed"
  }, "Fixed / known amount"), /* @__PURE__ */React.createElement("option", {
    value: "variable"
  }, "Variable by month"))), /* @__PURE__ */React.createElement("label", null, "Apply this change", /* @__PURE__ */React.createElement("select", {
    value: scopeChange,
    onChange: e => setScopeChange(e.target.value)
  }, /* @__PURE__ */React.createElement("option", {
    value: "single"
  }, "This month only"), /* @__PURE__ */React.createElement("option", {
    value: "forward"
  }, "This month and later planned months")))), scopeChange === "forward" && /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Later matching planned entries receive this amount and description. Missing later entries are added as planned. Already recorded months stay unchanged.")), /* @__PURE__ */React.createElement("label", null, "Add a note", /* @__PURE__ */React.createElement("textarea", {
    rows: "3",
    value: draftNote,
    onChange: e => setDraftNote(e.target.value),
    placeholder: "Optional explanation, customer/RV details, or refund context"
  })), notesFor(edit.id).length > 0 && /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Existing notes stay attached. Edit them using the entry\u2019s Notes button."), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Blank means not entered; zero means $0.00. Use a negative amount for a refund or credit."), /* @__PURE__ */React.createElement("div", {
    className: "modal-actions"
  }, /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => setEdit(null)
  }, "Cancel"), /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, /* @__PURE__ */React.createElement(Save, {
    size: 17
  }), "Save Entry To Workbook"))), noteEdit && /* @__PURE__ */React.createElement("form", {
    onSubmit: saveNote
  }, /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Linked to ", noteEdit.sheet, " \xB7 ", noteEdit.cell), /* @__PURE__ */React.createElement("label", null, "Note", /* @__PURE__ */React.createElement("textarea", {
    autoFocus: true,
    rows: "10",
    maxLength: "30000",
    value: noteEdit.text,
    onChange: e => setNoteEdit({
      ...noteEdit,
      text: e.target.value
    })
  })), /* @__PURE__ */React.createElement("div", {
    className: "modal-actions"
  }, /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => setNoteEdit(null)
  }, "Cancel"), /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, "Save Note To Workbook"))), deleteEntry && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, deleteEntry.kind === "inspection" ? jobLabel(book, deleteEntry.id) : deleteEntry.description), " \xB7 ", deleteEntry.month, " \xB7 ", deleteEntry.amount === null ? "No amount" : currency(deleteEntry.amount)), deleteEntry.kind === "inspection" && /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, deleteEntry.miles ?? 0, " miles"), " \xB7 ", notesFor(deleteEntry.id).length, " attached note(s). Copy any notes you want to retain to the correct inspection before removing this entry."), /* @__PURE__ */React.createElement("p", null, "The entry and its attached notes will be removed from the linked workbook. A complete backup is created before saving."), /* @__PURE__ */React.createElement("div", {
    className: "modal-actions"
  }, /* @__PURE__ */React.createElement("button", {
    onClick: () => setDeleteEntry(null)
  }, "Cancel"), /* @__PURE__ */React.createElement("button", {
    className: "danger",
    onClick: removeEntry
  }, "Remove And Save"))), linkForm && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement(LinkLockBar, null), /* @__PURE__ */React.createElement("label", null, "Calendar year", /* @__PURE__ */React.createElement("input", {
    type: "number",
    min: "1900",
    max: "2200",
    value: linkForm.year,
    onChange: e => setLinkForm({
      ...linkForm,
      year: e.target.value,
      preview: null
    })
  })), /* @__PURE__ */React.createElement("label", null, "Workbook path", /* @__PURE__ */React.createElement("input", {
    value: linkForm.path,
    placeholder: "C:\\YourFolder\\2026 Expenses.xlsx",
    onChange: e => setLinkForm({
      ...linkForm,
      path: e.target.value,
      preview: null
    })
  })), /* @__PURE__ */React.createElement("div", {
    className: "modal-actions"
  }, /* @__PURE__ */React.createElement("button", {
    onClick: browse
  }, /* @__PURE__ */React.createElement(FolderOpen, {
    size: 17
  }), "Browse Computer"), /* @__PURE__ */React.createElement("button", {
    disabled: !linkForm.path,
    onClick: previewLink
  }, "Check Workbook")), linkForm.preview && /* @__PURE__ */React.createElement("div", {
    className: "notice"
  }, /* @__PURE__ */React.createElement("strong", null, "Ready to link:"), " ", linkForm.preview.records.length, " entries and ", linkForm.preview.notes.length, " notes. ", links[linkForm.year] ? "This replaces the current link for that year; both files remain on disk." : "The file stays in its existing folder."), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Linking changes no workbook contents. Future Save entry actions write directly to this file. Close the workbook in Excel before saving here."), /* @__PURE__ */React.createElement("div", {
    className: "modal-actions"
  }, /* @__PURE__ */React.createElement("button", {
    className: "primary",
    disabled: !linkForm.preview,
    onClick: finishLink
  }, "Link Workbook"))), newYear && /* @__PURE__ */React.createElement("form", {
    onSubmit: createYear
  }, /* @__PURE__ */React.createElement(LinkLockBar, null), /* @__PURE__ */React.createElement("label", null, "Calendar year", /* @__PURE__ */React.createElement("input", {
    type: "number",
    required: true,
    min: "1900",
    max: "2200",
    value: newYear.year,
    onChange: e => setNewYear({
      ...newYear,
      year: e.target.value
    })
  })), book && /* @__PURE__ */React.createElement("label", {
    className: "check"
  }, /* @__PURE__ */React.createElement("input", {
    type: "checkbox",
    checked: newYear.copy,
    onChange: e => setNewYear({
      ...newYear,
      copy: e.target.checked
    })
  }), "Carry categories and the latest business recurring and personal income templates from ", year), /* @__PURE__ */React.createElement("p", null, "New workbooks contain January\u2013December. Copied amounts are planned, never recorded. Variable templates start with a blank amount. Household categories carry over with no household purchase amounts. No inspections or purchase history are copied."), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "The file is created in this app\u2019s Workbooks folder and linked automatically."), /* @__PURE__ */React.createElement("div", {
    className: "modal-actions"
  }, /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, "Create Yearly Workbook"))), manageCats && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("p", null, "Business categories. Manage household categories and income sources inside their own cards."), /* @__PURE__ */React.createElement("form", {
    className: "add-category",
    onSubmit: e => {
      e.preventDefault();
      if (book.categories.some(c => c.name === catName.trim())) {
        setError("This category already exists.");
        return;
      }
      save({
        ...book,
        categories: [...book.categories, {
          name: catName.trim(),
          subs: []
        }]
      }, () => setCatName(""));
    }
  }, /* @__PURE__ */React.createElement("input", {
    required: true,
    placeholder: "New category name",
    value: catName,
    onChange: e => setCatName(e.target.value)
  }), /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, "Add Category")), book.categories.map(c => /* @__PURE__ */React.createElement("div", {
    className: "cat-manager",
    key: c.name
  }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("strong", null, c.name), /* @__PURE__ */React.createElement("button", {
    disabled: book.categories.indexOf(c) === 0,
    onClick: () => {
      const cats = [...book.categories],
        i = cats.indexOf(c);
      [cats[i - 1], cats[i]] = [cats[i], cats[i - 1]];
      save({
        ...book,
        categories: cats
      });
    }
  }, "\u2191"), /* @__PURE__ */React.createElement("button", {
    disabled: book.categories.indexOf(c) === book.categories.length - 1,
    onClick: () => {
      const cats = [...book.categories],
        i = cats.indexOf(c);
      [cats[i + 1], cats[i]] = [cats[i], cats[i + 1]];
      save({
        ...book,
        categories: cats
      });
    }
  }, "\u2193"), /* @__PURE__ */React.createElement("button", {
    onClick: () => renameCategory(c.name)
  }, "Rename"), /* @__PURE__ */React.createElement("button", {
    onClick: () => deleteCategory(c.name)
  }, "Remove")), /* @__PURE__ */React.createElement("div", {
    className: "sub-chips"
  }, c.subs.map(sub => /* @__PURE__ */React.createElement("button", {
    key: sub,
    onClick: async () => {
      const value = prompt("Rename subcategory (leave blank to remove it)", sub);
      if (value === null) return;
      const next = structuredClone(book),
        target = next.categories.find(x => x.name === c.name);
      if (!value.trim()) {
        if (next.records.some(e => e.category === c.name && e.subCategory === sub)) {
          setError("This subcategory has entries. Reassign them before removing it.");
          return;
        }
        target.subs = target.subs.filter(s => s !== sub);
      } else {
        if (value !== sub && target.subs.includes(value)) {
          setError("That subcategory already exists.");
          return;
        }
        target.subs = target.subs.map(s => s === sub ? value : s);
        next.records.filter(e => e.category === c.name && e.subCategory === sub).forEach(e => e.subCategory = value);
      }
      await save(next);
    }
  }, sub, /* @__PURE__ */React.createElement(Pencil, {
    size: 12
  })))), /* @__PURE__ */React.createElement("button", {
    onClick: () => addSub(c)
  }, "+ Add Subcategory"), /* @__PURE__ */React.createElement("small", null, "Click a subcategory to rename or remove it. Removal is available when no entries use it.")))), help && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, "Using a network share:"), " The browser app runs on this computer; linked workbooks and their backups may live on your share. Use one person/app session at a time. File access depends on the share\u2019s permissions. Keep a separate backup of the closed application folder and linked files."), /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, "Moving computers or consolidating files:"), " Save your entries, use Exit Ctrl Ur Finances, then run Create-Portable-Copy.bat in the app folder. It creates a self-contained copy with linked workbooks, settings, backups and an optional reference folder. See PORTABLE-GUIDE.txt for details. The version displayed at the top identifies the installed build; it does not check for updates online."), /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, "Save entry writes to the linked Excel file."), " No cloud account, Python packages, or internet connection is needed."), /* @__PURE__ */React.createElement("ol", null, /* @__PURE__ */React.createElement("li", null, "Use Exit Ctrl Ur Finances before updates. Closing a browser tab alone leaves the app running."), /* @__PURE__ */React.createElement("li", null, "Use Linked workbooks to select one .xlsx file per year. Files stay where you put them."), /* @__PURE__ */React.createElement("li", null, "Finish editing and click Save entry. Look for \u201CSaved to workbook.\u201D If saving fails, the form stays open with your edits."), /* @__PURE__ */React.createElement("li", null, "A dated copy is created in Expense-Book-Backups beside the workbook before every save. To restore, close the app and copy the desired backup over the working file, or link the backup as a separate working copy."), /* @__PURE__ */React.createElement("li", null, "If you edit the file in Excel, save and close Excel, then click Reload workbook here. Conflicting saves are blocked.")), /* @__PURE__ */React.createElement("p", null, "The app preserves original sheets and comments, adds tracking sheets (DD Index, DD Notes, DD Settings), and refreshes monthly totals. Entry Overview provides a readable list with planned/recorded labels and residence allocations. Change amounts/descriptions in the monthly sheets; keep the DD tracking sheets intact."), /* @__PURE__ */React.createElement("p", null, "Planned costs remain separate from recorded expenses. Household finances are shown at their full amount; optional business-use percentages are your inputs, not calculated tax deductions."))), busy && /* @__PURE__ */React.createElement("div", {
    className: "saving-bar",
    role: "status"
  }, "Saving / working\u2026 Please keep this window open.")), setupOpen && /* @__PURE__ */React.createElement(YearSetup, {
    allowBusiness: modules.business,
    links,
    initialYear: links[year] ? year : Number(Object.keys(links).sort().at(-1)),
    api,
    onClose: () => setSetupOpen(false),
    onApplied: async (r, existing) => {
      await config();
      sharedContext = await refreshShared(api, readBook);
      setYear(r.year);
      setMonth(0);
      setBook(readBook(r.base64, r.year));
      setBase(r.base64);
      setRevision(r.revision);
      setFileInfo(r);
      setTab("home");
      setSearch("");
      setStatus(existing ? "Year setup saved \xB7 previous workbook backed up" : "Year workbook created and linked");
    }
  }));
}
createRoot(document.getElementById("root")).render(/* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement(LinkGuardDialog, null), /* @__PURE__ */React.createElement(StarterGate, {
  api
}, state => /* @__PURE__ */React.createElement(App, {
  initialProfile: state
}))));
