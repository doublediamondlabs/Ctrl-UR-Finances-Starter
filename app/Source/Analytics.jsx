import ReportTabs from "./ReportTabs.jsx";
import { markReconciliation } from "./analytics.js";
import { FlowSummary, MonthComparison } from "./ReportVisuals.jsx";
import React, { useState, useEffect, useRef } from "react";
import { MONTHS, entries, totals, buckets, change, sources, defaultGroup, completion, signature, markerKey, reportCSV, sum } from "./analytics.js";
const cash = n => Number(n).toLocaleString("en-US", {
  style: "currency",
  currency: "USD"
});
const label = d => d === "business" ? "Business" : "Personal";
function Delta({
  a,
  b
}) {
  const d = change(a, b);
  return /* @__PURE__ */React.createElement("span", null, d.amount > 0 ? "+" : "", cash(d.amount), " ", /* @__PURE__ */React.createElement("small", null, "(", d.percent === null ? "no prior baseline" : (d.percent > 0 ? "+" : "") + d.percent.toFixed(1) + "%", ")"));
}
function Analytics({
  books,
  settings,
  onSaveSettings,
  onEditEntry,
  comparison = false,
  loading = false,
  errors = [],
  onReload,
  onCompareYears,
  initialView,
  allowBusiness = true,
  compact = false,
  workbookSummary
}) {
  const [section, setSection] = useState("categories");
  const detailRef = useRef(null),
    groupsRef = useRef(null);
  const [scope, setScope] = useState(allowBusiness ? initialView?.scope || "personal" : "personal"),
    [start, setStart] = useState(initialView?.start ?? 0),
    [end, setEnd] = useState(initialView?.end ?? Math.max(0, (/* @__PURE__ */new Date()).getMonth() - 1)),
    [baseYear, setBaseYear] = useState(""),
    [focusYear, setFocusYear] = useState(""),
    [sub, setSub] = useState(false),
    [detail, setDetail] = useState(null),
    [draft, setDraft] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ordered = [...books].sort((a, b) => a.year - b.year),
    focus = ordered.find(b => String(b.year) === focusYear) || ordered.at(-1),
    base = ordered.find(b => String(b.year) === baseYear) || ordered.at(-2),
    period = book => book ? entries(book, settings, scope, start, end) : [],
    rows = period(focus),
    prior = period(base),
    t = totals(rows),
    groups = buckets(rows, sub),
    oldGroups = buckets(prior, sub),
    groupKeys = [... /* @__PURE__ */new Set([...groups.map(g => g.key), ...oldGroups.map(g => g.key)])].sort((a, b) => Math.abs((groups.find(g => g.key === b)?.total || 0) - (oldGroups.find(g => g.key === b)?.total || 0)) - Math.abs((groups.find(g => g.key === a)?.total || 0) - (oldGroups.find(g => g.key === a)?.total || 0)));
  useEffect(() => {
    setDetail(null);
  }, [scope, start, end, focusYear, baseYear, sub, settings, focus, base]);
  useEffect(() => {
    if (detail) detailRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "start"
    });
  }, [detail]);
  useEffect(() => {
    if (draft) groupsRef.current?.scrollIntoView?.({
      behavior: "smooth",
      block: "start"
    });
  }, [draft === null]);
  async function save(next) {
    setBusy(true);
    setError("");
    try {
      await onSaveSettings(next);
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function open(title, items) {
    setDetail({
      title,
      items
    });
  }
  function amount(n, items, title) {
    return /* @__PURE__ */React.createElement("button", {
      className: "report-amount",
      onClick: () => open(title, items)
    }, cash(n));
  }
  function download() {
    const url = URL.createObjectURL(new Blob([reportCSV(comparison && base && base.year !== focus.year ? [...prior, ...rows] : rows)], {
        type: "text/csv;charset=utf-8"
      })),
      a = document.createElement("a");
    a.href = url;
    a.download = `Double-Diamond-${comparison ? "Year-Comparison" : focus.year + "-Analysis"}-${scope}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  async function mark(book, m) {
    let next = settings;
    const domains = scope === "combined" ? ["business", "personal"] : [scope],
      clear = completion(book, settings, scope, m) === "Reconciled";
    for (const domain of domains) next = markReconciliation(book, next, domain, m, clear);
    await save(next);
  }
  const allSources = sources(books).filter(s => allowBusiness || s.domain === "personal");
  const transfers = (focus?.transfers || []).filter(t2 => {
    const m = Number(t2.date.slice(5, 7)) - 1;
    return m >= start && m <= end && (scope === "combined" || t2.scope === scope || t2.scope === "both");
  });
  return /* @__PURE__ */React.createElement("section", {
    className: "panel analytics"
  }, compact && /* @__PURE__ */React.createElement(ReportTabs, {
    id: "historical-report",
    label: "Historical analysis views",
    value: section,
    onChange: next => {
      setSection(next);
      setDetail(null);
    },
    items: [["categories", "Categories & Cash Flow"], ["review", "Monthly Review"], ["comparison", "Multi-month Comparison"], ...(workbookSummary ? [["export", "Full-year Summary & Export"]] : [])]
  }), /* @__PURE__ */React.createElement("div", {
    hidden: compact && section === "export",
    className: "report-section-panel"
  }, /* @__PURE__ */React.createElement("div", {
    className: "report-orientation"
  }, /* @__PURE__ */React.createElement("section", {
    className: "report-orientation-controls"
  }, /* @__PURE__ */React.createElement("div", {
    className: "panel-heading"
  }, /* @__PURE__ */React.createElement("h2", null, comparison ? "Year comparison" : "Historical analysis"), onReload && /* @__PURE__ */React.createElement("button", {
    disabled: loading || busy,
    onClick: onReload
  }, "Reload Linked Years")), /* @__PURE__ */React.createElement("div", {
    className: "report-controls"
  }, /* @__PURE__ */React.createElement("label", null, "View", /* @__PURE__ */React.createElement("select", {
    value: scope,
    onChange: e => setScope(e.target.value)
  }, allowBusiness && /* @__PURE__ */React.createElement("option", {
    value: "business"
  }, "Business"), /* @__PURE__ */React.createElement("option", {
    value: "personal"
  }, "Personal"), allowBusiness && /* @__PURE__ */React.createElement("option", {
    value: "combined"
  }, "Combined"))), /* @__PURE__ */React.createElement("label", null, "From month", /* @__PURE__ */React.createElement("select", {
    value: start,
    onChange: e => {
      const n = +e.target.value;
      setStart(n);
      if (n > end) setEnd(n);
    }
  }, MONTHS.map((m, i) => /* @__PURE__ */React.createElement("option", {
    key: m,
    value: i
  }, m)))), /* @__PURE__ */React.createElement("label", null, "Through month", /* @__PURE__ */React.createElement("select", {
    value: end,
    onChange: e => {
      const n = +e.target.value;
      setEnd(n);
      if (n < start) setStart(n);
    }
  }, MONTHS.map((m, i) => /* @__PURE__ */React.createElement("option", {
    key: m,
    value: i
  }, m)))), comparison && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("label", null, "Earlier year", /* @__PURE__ */React.createElement("select", {
    value: base?.year || "",
    onChange: e => setBaseYear(e.target.value)
  }, /* @__PURE__ */React.createElement("option", {
    value: "",
    disabled: true
  }, "Link another year"), ordered.map(b => /* @__PURE__ */React.createElement("option", {
    key: b.year
  }, b.year)))), /* @__PURE__ */React.createElement("label", null, "Comparison year", /* @__PURE__ */React.createElement("select", {
    value: focus?.year || "",
    onChange: e => setFocusYear(e.target.value)
  }, ordered.map(b => /* @__PURE__ */React.createElement("option", {
    key: b.year
  }, b.year))))), /* @__PURE__ */React.createElement("label", null, /* @__PURE__ */React.createElement("input", {
    type: "checkbox",
    checked: sub,
    onChange: e => setSub(e.target.checked)
  }), "Show subcategories")), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Recorded entries only. Planned amounts and Family separately held receipts are excluded. Blank amounts are flagged below. Reporting groups do not rename or move your entries."), scope === "combined" && /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, "Business and personal remain labeled separately. Combined totals add the recorded activity; transfers entered as income or expenses are not automatically eliminated. Use the separate views when checking household spending capacity."), " ", /* @__PURE__ */React.createElement("div", {
    className: "summary-actions"
  }, /* @__PURE__ */React.createElement("button", {
    disabled: !focus,
    onClick: download
  }, "Export Analysis CSV"), /* @__PURE__ */React.createElement("button", {
    onClick: () => window.print()
  }, "Print / Save PDF"), /* @__PURE__ */React.createElement("button", {
    disabled: busy,
    onClick: () => setDraft(Object.fromEntries(allSources.map(s => [s.key, settings.aliases?.[s.key] || defaultGroup(s.category)])))
  }, "Reporting Groups"), onCompareYears && /* @__PURE__ */React.createElement("button", {
    onClick: () => onCompareYears({
      scope,
      start,
      end,
      year: focus?.year
    })
  }, "Compare Years"))), /* @__PURE__ */React.createElement("section", {
    className: "report-orientation-status",
    "aria-label": "Selected period summary"
  }, loading && /* @__PURE__ */React.createElement("p", {
    role: "status"
  }, "Loading linked workbooks\u2026"), errors.map(e => /* @__PURE__ */React.createElement("p", {
    role: "alert",
    className: "error",
    key: e.year
  }, e.year, ": ", e.error)), error && /* @__PURE__ */React.createElement("p", {
    className: "error",
    role: "alert"
  }, error), !focus ? /* @__PURE__ */React.createElement("p", null, "Link a yearly workbook to begin.") : /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, focus.year, " \xB7 ", MONTHS[start], "\u2013", MONTHS[end]), " \xB7 ", rows.length, " recorded entries \xB7 ", t.missing, " missing amounts ", t.missing > 0 && /* @__PURE__ */React.createElement("button", {
    onClick: () => open("All missing amounts in selected range", rows.filter(r => r.amount === null || r.amount === void 0 || !Number.isFinite(r.amount)))
  }, "Show Missing Entries")), /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, MONTHS.slice(start, end + 1).filter((_, i) => completion(focus, settings, scope, i + start) === "Reconciled").length, " of ", end - start + 1, " months reconciled in this view. Unreconciled months are included in totals and may still be incomplete."), /* @__PURE__ */React.createElement("div", {
    className: "metrics report-metrics"
  }, [["Income", t.income, rows.filter(r => r.flow === "income")], ["Expenses", t.expense, rows.filter(r => r.flow === "expense")], ["Surplus / deficit", t.net, rows]].map(([name, value, items]) => /* @__PURE__ */React.createElement("div", {
    key: name
  }, /* @__PURE__ */React.createElement("span", null, name), /* @__PURE__ */React.createElement("strong", {
    className: name === "Surplus / deficit" ? value < 0 ? "balance-negative" : "balance-positive" : ""
  }, amount(value, items, name + " \xB7 " + focus.year)))))))), focus && /* @__PURE__ */React.createElement(React.Fragment, null, comparison && (!base || base.year === focus.year) && /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, "Choose two different linked years for a year-over-year comparison. You can still review monthly trends below."), comparison && base && base.year !== focus.year && /* @__PURE__ */React.createElement("section", null, /* @__PURE__ */React.createElement("h3", null, "Matching periods \xB7 ", MONTHS[start], "\u2013", MONTHS[end]), /* @__PURE__ */React.createElement("p", null, "Both years use exactly the same months. Category changes below are ordered by largest dollar change. Unreconciled months remain included and are identified below."), /* @__PURE__ */React.createElement("div", {
    className: "table-wrap"
  }, /* @__PURE__ */React.createElement("table", null, /* @__PURE__ */React.createElement("thead", null, /* @__PURE__ */React.createElement("tr", null, /* @__PURE__ */React.createElement("th", null, "Year"), /* @__PURE__ */React.createElement("th", null, "Income"), /* @__PURE__ */React.createElement("th", null, "Expenses"), /* @__PURE__ */React.createElement("th", null, "Surplus / deficit"), /* @__PURE__ */React.createElement("th", null, "Reconciled months"))), /* @__PURE__ */React.createElement("tbody", null, [base, focus].map(book => {
    const r = period(book),
      v = totals(r);
    return /* @__PURE__ */React.createElement("tr", {
      key: book.year
    }, /* @__PURE__ */React.createElement("th", null, book.year), /* @__PURE__ */React.createElement("td", null, amount(v.income, r.filter(x => x.flow === "income"), "Income " + book.year)), /* @__PURE__ */React.createElement("td", null, amount(v.expense, r.filter(x => x.flow === "expense"), "Expenses " + book.year)), /* @__PURE__ */React.createElement("td", null, amount(v.net, r, "Net " + book.year)), /* @__PURE__ */React.createElement("td", null, MONTHS.slice(start, end + 1).filter((_, i) => completion(book, settings, scope, i + start) === "Reconciled").length, " / ", end - start + 1));
  }), /* @__PURE__ */React.createElement("tr", null, /* @__PURE__ */React.createElement("th", null, "Change"), ["income", "expense", "net"].map(k => /* @__PURE__ */React.createElement("td", {
    key: k
  }, /* @__PURE__ */React.createElement(Delta, {
    a: t[k],
    b: totals(prior)[k]
  }))), /* @__PURE__ */React.createElement("td", null, "Review incomplete months")))))), /* @__PURE__ */React.createElement("div", {
    className: "report-section-panel",
    hidden: compact && section !== "categories",
    role: compact ? "tabpanel" : void 0,
    id: "historical-report-panel-categories",
    "aria-labelledby": compact ? "historical-report-tab-categories" : void 0,
    tabIndex: compact ? 0 : void 0
  }, /* @__PURE__ */React.createElement(FlowSummary, {
    rows,
    transfers,
    scope,
    year: focus.year,
    start,
    end,
    sub,
    onOpen: open,
    comparisonTable: comparison && base && base.year !== focus.year ? /* @__PURE__ */React.createElement("div", {
      className: "table-wrap"
    }, /* @__PURE__ */React.createElement("table", null, /* @__PURE__ */React.createElement("thead", null, /* @__PURE__ */React.createElement("tr", null, /* @__PURE__ */React.createElement("th", null, "Area / flow"), /* @__PURE__ */React.createElement("th", null, "Reporting group"), comparison && base && /* @__PURE__ */React.createElement("th", null, base.year), /* @__PURE__ */React.createElement("th", null, focus.year), comparison && base && /* @__PURE__ */React.createElement("th", null, "Change"))), /* @__PURE__ */React.createElement("tbody", null, (comparison ? groupKeys : groups.map(g => g.key)).map(key => {
      const g = groups.find(g2 => g2.key === key),
        old = oldGroups.find(g2 => g2.key === key),
        meta = g || old;
      return /* @__PURE__ */React.createElement("tr", {
        key
      }, /* @__PURE__ */React.createElement("td", null, label(meta.domain), " \xB7 ", meta.flow), /* @__PURE__ */React.createElement("th", null, meta.label), comparison && base && /* @__PURE__ */React.createElement("td", null, amount(old?.total || 0, old?.rows || [], meta.label + " " + base.year)), /* @__PURE__ */React.createElement("td", null, amount(g?.total || 0, g?.rows || [], meta.label + " " + focus.year)), comparison && base && /* @__PURE__ */React.createElement("td", null, /* @__PURE__ */React.createElement(Delta, {
        a: g?.total || 0,
        b: old?.total || 0
      })));
    })))) : null
  })), /* @__PURE__ */React.createElement("section", {
    className: "report-section-panel",
    hidden: compact && section !== "review",
    role: compact ? "tabpanel" : void 0,
    id: "historical-report-panel-review",
    "aria-labelledby": compact ? "historical-report-tab-review" : void 0,
    tabIndex: compact ? 0 : void 0
  }, /* @__PURE__ */React.createElement("h3", null, compact ? "Monthly Review" : "Monthly trends", " \xB7 ", focus.year), /* @__PURE__ */React.createElement("div", {
    hidden: compact
  }, /* @__PURE__ */React.createElement("div", {
    className: "trend-legend"
  }, /* @__PURE__ */React.createElement("span", null, "\u25A0 Income"), /* @__PURE__ */React.createElement("span", null, "\u25A0 Expenses")), /* @__PURE__ */React.createElement("div", {
    className: "report-trend",
    role: "img",
    "aria-label": "Income and expenses by month for " + focus.year + ". Exact amounts and reconciliation status follow in the table."
  }, (() => {
    const data = MONTHS.map((name, m) => ({
        name,
        m,
        ...totals(entries(focus, settings, scope, m, m))
      })).filter(v => v.m >= start && v.m <= end),
      max = Math.max(1, ...data.flatMap(v => [Math.abs(v.income), Math.abs(v.expense)]));
    return data.map(v => /* @__PURE__ */React.createElement("div", {
      className: "trend-month",
      key: v.m
    }, /* @__PURE__ */React.createElement("span", null, v.name.slice(0, 3)), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("div", {
      className: "trend-income",
      style: {
        width: Math.max(0, Math.abs(v.income) / max * 100) + "%"
      },
      title: "Income " + cash(v.income)
    }), /* @__PURE__ */React.createElement("div", {
      className: "trend-expense",
      style: {
        width: Math.max(0, Math.abs(v.expense) / max * 100) + "%"
      },
      title: "Expenses " + cash(v.expense)
    }))));
  })()), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Bars show magnitude; signed amounts and refunds are shown in the table.")), /* @__PURE__ */React.createElement("div", {
    className: "table-wrap"
  }, /* @__PURE__ */React.createElement("table", null, /* @__PURE__ */React.createElement("thead", null, /* @__PURE__ */React.createElement("tr", null, /* @__PURE__ */React.createElement("th", null, "Month"), /* @__PURE__ */React.createElement("th", null, "Income"), /* @__PURE__ */React.createElement("th", null, "Expenses"), /* @__PURE__ */React.createElement("th", null, "Surplus / deficit"), /* @__PURE__ */React.createElement("th", null, "Data status"), /* @__PURE__ */React.createElement("th", null, "Review"))), /* @__PURE__ */React.createElement("tbody", null, MONTHS.map((m, i) => {
    if (i < start || i > end) return null;
    const r = entries(focus, settings, scope, i, i),
      v = totals(r),
      state = completion(focus, settings, scope, i);
    return /* @__PURE__ */React.createElement("tr", {
      key: m
    }, /* @__PURE__ */React.createElement("th", null, m), /* @__PURE__ */React.createElement("td", null, amount(v.income, r.filter(x => x.flow === "income"), m + " income")), /* @__PURE__ */React.createElement("td", null, amount(v.expense, r.filter(x => x.flow === "expense"), m + " expenses")), /* @__PURE__ */React.createElement("td", {
      className: v.net < 0 ? "balance-negative" : "balance-positive"
    }, amount(v.net, r, m + " net")), /* @__PURE__ */React.createElement("td", null, /* @__PURE__ */React.createElement("span", {
      className: state === "Reconciled" ? "balance-positive" : "report-incomplete"
    }, state), !r.length && /* @__PURE__ */React.createElement("small", null, " \xB7 No recorded entries"), v.missing > 0 && /* @__PURE__ */React.createElement("button", {
      className: "missing-amounts-link",
      onClick: () => open(m + " \xB7 missing amounts", r.filter(x => x.amount === null || x.amount === void 0 || !Number.isFinite(x.amount)))
    }, "Show ", v.missing, " Missing ", v.missing === 1 ? "Amount" : "Amounts")), /* @__PURE__ */React.createElement("td", null, /* @__PURE__ */React.createElement("button", {
      title: v.missing ? "Use Show missing amounts to find recorded entries with blank amounts." : "Confirm you checked this month against the statement",
      disabled: busy || v.missing > 0,
      onClick: () => mark(focus, i)
    }, state === "Reconciled" ? "Reopen Month" : "Mark Reconciled")));
  })))), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Mark a month only after checking it against your statements. Combined marks both Business and Personal. Changes to recorded entries or their notes flag the month for review again. Empty months can be marked if you confirm there was no activity.")), /* @__PURE__ */React.createElement("div", {
    className: "report-section-panel",
    hidden: compact && section !== "comparison",
    role: compact ? "tabpanel" : void 0,
    id: "historical-report-panel-comparison",
    "aria-labelledby": compact ? "historical-report-tab-comparison" : void 0,
    tabIndex: compact ? 0 : void 0
  }, /* @__PURE__ */React.createElement(MonthComparison, {
    book: focus,
    settings,
    scope,
    sub,
    onOpen: open
  })), detail && /* @__PURE__ */React.createElement("section", {
    ref: detailRef,
    className: "report-detail",
    "aria-label": "Report entries"
  }, /* @__PURE__ */React.createElement("div", {
    className: "panel-heading"
  }, /* @__PURE__ */React.createElement("h3", null, detail.title), /* @__PURE__ */React.createElement("button", {
    onClick: () => setDetail(null)
  }, "Close Entries")), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Blank amounts are not zero. Open an entry to enter the actual amount, or change it to Planned if it has not happened. Use zero only when the actual amount is $0.00. Unused entries can be removed in their monthly workspace."), !detail.items.length ? /* @__PURE__ */React.createElement("p", null, "No recorded entries for this total.") : detail.items.map(r => /* @__PURE__ */React.createElement("article", {
    key: r.year + ":" + r.id
  }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("strong", null, r.description || r.category), /* @__PURE__ */React.createElement("strong", null, r.amount === null ? "Missing amount" : cash(r.amount))), /* @__PURE__ */React.createElement("small", null, r.year, " \xB7 ", r.month, " \xB7 ", r.transactionDate || "Date not entered", " \xB7 ", label(r.domain), " \xB7 ", r.flow, " \xB7 ", r.category, r.subcategory ? " / " + r.subcategory : ""), /* @__PURE__ */React.createElement("small", null, "Workbook sheet: ", r.sheet, " \xB7 Amount cell: ", r.amountCell || "New entry"), onEditEntry && /* @__PURE__ */React.createElement("button", {
    onClick: () => onEditEntry(r.year, r.id)
  }, "Edit This Entry"), r.notes.map((n, i) => /* @__PURE__ */React.createElement("p", {
    key: i
  }, n))))), draft && /* @__PURE__ */React.createElement("section", {
    ref: groupsRef,
    className: "report-groups"
  }, /* @__PURE__ */React.createElement("h3", null, "Reporting groups"), /* @__PURE__ */React.createElement("p", null, "Matching group names combine categories within the same area and flow. Groceries and Food - Grocery default to Groceries. Keep Dining out and Convenience snacks in separate groups; merchant names alone do not identify what you bought. This changes reports only."), allSources.map(s => /* @__PURE__ */React.createElement("label", {
    key: s.key
  }, label(s.domain), " \xB7 ", s.flow, " \xB7 ", s.category, /* @__PURE__ */React.createElement("input", {
    maxLength: "100",
    value: draft[s.key] ?? defaultGroup(s.category),
    onChange: e => setDraft({
      ...draft,
      [s.key]: e.target.value
    })
  }))), /* @__PURE__ */React.createElement("div", {
    className: "summary-actions"
  }, /* @__PURE__ */React.createElement("button", {
    disabled: busy || Object.values(draft).some(v => !v.trim()),
    onClick: async () => {
      if (await save({
        ...settings,
        aliases: {
          ...settings.aliases,
          ...Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim()]))
        }
      })) setDraft(null);
    }
  }, "Save Reporting Groups"), /* @__PURE__ */React.createElement("button", {
    disabled: busy,
    onClick: () => setDraft(null)
  }, "Cancel Groups"))))), compact && workbookSummary && /* @__PURE__ */React.createElement("div", {
    className: "report-section-panel",
    hidden: section !== "export",
    role: "tabpanel",
    id: "historical-report-panel-export",
    "aria-labelledby": "historical-report-tab-export",
    tabIndex: 0
  }, workbookSummary));
}
export { Analytics as default };
