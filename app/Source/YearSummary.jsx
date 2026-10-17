import ReportTabs from "./ReportTabs.jsx";
import SpendingSnapshot from "./SpendingSnapshot.jsx";
import { incomeRecords, travelRecords, jobLabel } from "./inspectionIncome.js";
import Analytics from "./Analytics.jsx";
import React, { useState } from "react";
const sum = (rows, key = "amount") => Math.round(rows.reduce((n, r) => n + (r[key] ?? 0), 0) * 100) / 100;
const homeName = (book, e) => book.householdCategories?.find(c => c.id === e.householdCategoryId)?.name || e.subCategory || e.description || e.category;
const homeSub = (book, e) => book.householdCategories?.find(c => c.id === e.householdCategoryId)?.subs.find(s => s.id === e.householdSubId)?.name || "";
const money = n => new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD"
}).format(n);
function summaryData(book) {
  const r = incomeRecords(book).filter(e => e.state === "recorded"),
    sales = r.filter(e => e.kind === "inspection"),
    business = r.filter(e => e.kind === "expense" && e.scope === "business"),
    home = r.filter(e => e.kind === "expense" && e.scope === "residence");
  const group = (rows, key) => [...new Set(rows.map(key))].sort().map(label => [label, sum(rows.filter(e => key(e) === label))]);
  return {
    personal: sum(r.filter(e => e.kind === "income")),
    sales: sum(sales),
    business: sum(business),
    home: sum(home),
    miles: sum(travelRecords(book), "miles"),
    categories: group(business, e => e.category),
    housing: group(home, e => homeName(book, e)),
    housingSub: group(home, e => homeName(book, e) + " / " + (homeSub(book, e) || "Unassigned")),
    planned: book.records.filter(e => e.state === "planned"),
    missing: r.filter(e => e.amount === null),
    records: r
  };
}
function summaryCSV(book, includeNotes) {
  const d = summaryData(book),
    rows = [["Double Diamond \u2014 Year-end summary", book.year], ["Recorded activity only; household costs are separate."], ["Measure", "Amount"], ["Inspection income (refunds included)", d.sales], ["Business expenses", d.business], ["Sales less business expenses", Math.round((d.sales - d.business) * 100) / 100], ["Inspection miles", d.miles], ["Full household costs", d.home], ["Personal income", d.personal], ["Personal income less household expenses", Math.round((d.personal - d.home) * 100) / 100], [], ["Business category", "Recorded amount"], ...d.categories, [], ["Household label", "Recorded amount"], ...d.housing, [], ["Household category / subcategory", "Recorded amount"], ...d.housingSub, [], ["Excluded planned entries", d.planned.length], ["Recorded entries missing an amount", d.missing.length], [], ["Month", "Type", "Scope", "Category", "Subcategory", "Description", "Amount", "Miles", "Household category", "Household subcategory", "Transaction date", ...(includeNotes ? ["Notes"] : [])], ...d.records.map(e => [e.month, e.kind, e.scope, e.category, e.subCategory, e.description, e.amount ?? "", e.miles ?? "", e.scope === "residence" ? homeName(book, e) : "", homeSub(book, e), e.transactionDate || "", ...(includeNotes ? [[...(book.inspectionLedger?.sources?.find(r => r.id === (e.sourceJobId || e.id))?.notes || book.notes).filter(n => n.recordId === (e.sourceJobId || e.id)).map(n => n.text), ...(e.sourceNote ? [e.sourceNote] : [])].join("\n")] : [])])];
  rows.push([], ["Visits and mileage in " + book.year], ["Visit ID", "Job ID", "Customer / inspection", "Visit date / retained month", "Vehicle", "Outcome", "Actual miles", ...(includeNotes ? ["Visit notes"] : [])], ...travelRecords(book).map(v => [v.visitId || "", v.id, jobLabel(book, v.id), v.inspectionDate || v.month, v.vehicle || "", v.inspectionStatus, v.miles ?? "", ...(includeNotes ? [(book.inspectionLedger?.jobs[v.id]?.visits || []).find(x => x.id === v.visitId)?.note || ""] : [])]));
  if (includeNotes) rows.push([], ["All workbook notes (including planned and unlinked notes)"], ["Sheet", "Cell", "Entry ID", "Note"], ...book.notes.map(n => [n.sheet, n.cell, n.recordId || "", n.text]));
  return "\uFEFF" + rows.map(row => row.map(v => {
    let s = String(v ?? "");
    if (typeof v !== "number" && /^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }).join(",")).join("\r\n");
}
function LegacySummary({
  book
}) {
  const [includeNotes, setIncludeNotes] = useState(false),
    d = summaryData(book);
  function download() {
    const blob = new Blob([summaryCSV(book, includeNotes)], {
        type: "text/csv;charset=utf-8"
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `Double-Diamond-${book.year}-Year-End-Summary.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  function table(title, rows) {
    return /* @__PURE__ */React.createElement("section", {
      className: "summary-section"
    }, /* @__PURE__ */React.createElement("h3", null, title), /* @__PURE__ */React.createElement("table", null, /* @__PURE__ */React.createElement("thead", null, /* @__PURE__ */React.createElement("tr", null, /* @__PURE__ */React.createElement("th", null, "Category"), /* @__PURE__ */React.createElement("th", null, "Recorded amount"))), /* @__PURE__ */React.createElement("tbody", null, rows.length ? rows.map(([label, n]) => /* @__PURE__ */React.createElement("tr", {
      key: label
    }, /* @__PURE__ */React.createElement("td", null, label), /* @__PURE__ */React.createElement("td", null, money(n)))) : /* @__PURE__ */React.createElement("tr", null, /* @__PURE__ */React.createElement("td", {
      colSpan: "2"
    }, "No recorded expenses.")))));
  }
  return /* @__PURE__ */React.createElement("section", {
    className: "year-summary panel"
  }, /* @__PURE__ */React.createElement("div", {
    className: "summary-actions"
  }, /* @__PURE__ */React.createElement("label", null, /* @__PURE__ */React.createElement("input", {
    type: "checkbox",
    checked: includeNotes,
    onChange: e => setIncludeNotes(e.target.checked)
  }), "Include notes"), /* @__PURE__ */React.createElement("button", {
    onClick: download
  }, "Export CSV"), /* @__PURE__ */React.createElement("button", {
    className: "primary",
    onClick: () => window.print()
  }, "Print / Save PDF")), /* @__PURE__ */React.createElement("h2", null, "Double Diamond \xB7 ", book.year, " year-end summary"), /* @__PURE__ */React.createElement("p", null, "Recorded activity from January\u2013December in this workbook. Prepared ", (/* @__PURE__ */new Date()).toLocaleDateString(), ". No tax deduction is calculated."), /* @__PURE__ */React.createElement("dl", {
    className: "summary-measures"
  }, [["Inspection income (refunds included)", money(d.sales)], ["Business expenses", money(d.business)], ["Sales less business expenses", money(d.sales - d.business)], ["Inspection miles", d.miles.toLocaleString()], ["Full household costs \u2014 separate", money(d.home)], ["Personal income \u2014 separate", money(d.personal)], ["Personal income less household expenses", money(d.personal - d.home)]].map(([label, value]) => /* @__PURE__ */React.createElement("div", {
    key: label
  }, /* @__PURE__ */React.createElement("dt", null, label), /* @__PURE__ */React.createElement("dd", null, value)))), /* @__PURE__ */React.createElement("p", null, d.planned.length, " planned entries excluded. ", d.missing.length, " recorded entries have no amount entered (contribute $0 to totals)."), table("Business expenses by category", d.categories), table("Household costs by category", d.housing), table("Household costs by subcategory", d.housingSub), includeNotes && /* @__PURE__ */React.createElement("section", {
    className: "summary-notes"
  }, /* @__PURE__ */React.createElement("h3", null, "Workbook notes"), /* @__PURE__ */React.createElement("p", null, "Includes notes on recorded, planned, and unlinked cells."), book.notes.map(n => {
    const e = book.records.find(e2 => e2.id === n.recordId);
    return /* @__PURE__ */React.createElement("article", {
      key: n.id
    }, /* @__PURE__ */React.createElement("strong", null, n.sheet, " \xB7 ", n.cell, e ? " \xB7 " + e.description + " \xB7 " + e.state : ""), /* @__PURE__ */React.createElement("p", null, n.text));
  }), !book.notes.length && /* @__PURE__ */React.createElement("p", null, "No notes.")));
}
function YearSummary({
  allowBusiness = true,
  periodNavigation,
  book,
  reporting,
  onSaveReporting,
  onEditEntry,
  onCompareYears,
  initialView,
  onOpenReport,
  links,
  api,
  readBook
}) {
  const [page, setPage] = useState(initialView ? "history" : "snapshot");
  return /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("div", {
    className: "summary-control-center"
  }, /* @__PURE__ */React.createElement("div", {
    className: "summary-year-controls"
  }, periodNavigation), /* @__PURE__ */React.createElement(ReportTabs, {
    id: "year-report",
    label: "Year-end reports",
    value: page,
    onChange: setPage,
    items: [["snapshot", "Spending Snapshot", "spending"], ["trend", "Monthly Spending Trend", "spending"], ["history", "Historical Analysis"]]
  })), /* @__PURE__ */React.createElement("div", {
    className: "report-section-panel",
    hidden: page === "history",
    role: "tabpanel",
    id: "year-report-panel-spending",
    "aria-labelledby": "year-report-tab-" + (page === "trend" ? "trend" : "snapshot"),
    tabIndex: 0
  }, /* @__PURE__ */React.createElement(SpendingSnapshot, {
    allowBusiness,
    key: book.year,
    section: page === "trend" ? "trend" : "snapshot",
    book,
    settings: reporting,
    links,
    api,
    readBook
  })), /* @__PURE__ */React.createElement("div", {
    className: "report-section-panel",
    hidden: page !== "history",
    role: "tabpanel",
    id: "year-report-panel-history",
    "aria-labelledby": "year-report-tab-history",
    tabIndex: 0
  }, /* @__PURE__ */React.createElement(Analytics, {
    allowBusiness,
    compact: true,
    workbookSummary: allowBusiness && /* @__PURE__ */React.createElement(LegacySummary, {
      book
    }),
    initialView,
    onCompareYears,
    books: [book],
    settings: reporting,
    onSaveSettings: onSaveReporting,
    onEditEntry
  })), onOpenReport && /* @__PURE__ */React.createElement("div", {
    className: "summary-actions report-related"
  }, /* @__PURE__ */React.createElement("span", {
    className: "hint"
  }, "Related reports"), /* @__PURE__ */React.createElement("button", {
    onClick: () => onOpenReport("activity")
  }, "Business Activity & Mileage"), /* @__PURE__ */React.createElement("button", {
    onClick: () => onOpenReport("tax")
  }, "Tax Preparation")));
}
export { YearSummary as default, summaryCSV, summaryData };
