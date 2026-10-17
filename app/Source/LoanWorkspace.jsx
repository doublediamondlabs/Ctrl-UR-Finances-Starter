import LoanOrientation from "./LoanOrientation.jsx";
import { monthLabel, dateLabel } from "./loanDates.js";
import { LinkLockBar, lockLinks } from "./LinkGuard.jsx";
import AgreementReference from "./AgreementReference.jsx";
import PrivateForwarding from "./PrivateForwarding.jsx";
import React, { useState, useEffect, useRef } from "react";
import { calculateLoan, validateLoan, statementHTML, money, validDate } from "./loan.js";
const cash = n => Number(n).toLocaleString("en-US", {
  style: "currency",
  currency: "USD"
});
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const tone = r => r?.overdue ? "late" : r?.status === "On time" ? "on-time" : r?.status === "Paid late" ? "paid-late" : "";
const today = () => {
  const d = /* @__PURE__ */new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};
function Dialog({
  title,
  onClose,
  busy,
  children
}) {
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  return /* @__PURE__ */React.createElement("dialog", {
    ref,
    className: "household-dialog loan-dialog",
    onCancel: e => {
      e.preventDefault();
      if (!busy) onClose();
    }
  }, /* @__PURE__ */React.createElement("div", {
    className: "modal-head"
  }, /* @__PURE__ */React.createElement("h2", null, title), /* @__PURE__ */React.createElement("button", {
    disabled: busy,
    onClick: onClose,
    "aria-label": "Close loan dialog"
  }, "\xD7")), /* @__PURE__ */React.createElement("fieldset", {
    disabled: busy
  }, children));
}
function LoanWorkspace({
  state,
  onLink,
  onPreview,
  onSave,
  onReload,
  onBrowse,
  busy,
  compact = false,
  year,
  month,
  onDirty,
  initiallyExpanded = false
}) {
  const [forwardDirty, setForwardDirty] = useState(false);
  const [modal, setModal] = useState(null),
    [error, setError] = useState(""),
    [path, setPath] = useState(""),
    [asOf, setAsOf] = useState(today()),
    [expanded, setExpanded] = useState(initiallyExpanded),
    [selected, setSelected] = useState(today().slice(0, 7)),
    [section, setSection] = useState("payments"),
    [linkBusy, setLinkBusy] = useState(false);
  const loan = state?.loan,
    key = `${year}-${String(month + 1).padStart(2, "0")}`,
    c = loan ? calculateLoan(loan, asOf) : null;
  const activeMonth = compact ? key : selected,
    selectedRow = c?.rows.find(r => r.month === selected),
    years = [... /* @__PURE__ */new Set([...(c?.rows || []).map(r => r.month.slice(0, 4)), ...(loan?.receipts || []).map(r => r.month.slice(0, 4)), selected.slice(0, 4)])].sort();
  const monthEnd = new Date(Date.UTC(Number(selected.slice(0, 4)), Number(selected.slice(5, 7)), 0)).toISOString().slice(0, 10),
    snapshotDate = selected === asOf.slice(0, 7) ? asOf : monthEnd;
  useEffect(() => {
    onDirty?.(!!modal || forwardDirty);
    return () => onDirty?.(false);
  }, [!!modal, forwardDirty]);
  function close() {
    if (busy || linkBusy) return;
    if (modal?.dirty && !confirm("Discard these unsaved loan changes?")) return;
    setModal(null);
    lockLinks();
    setError("");
  }
  function update(values) {
    setModal(m => ({
      ...m,
      ...values,
      dirty: true
    }));
    setError("");
  }
  async function commit(next) {
    setError("");
    try {
      validateLoan(next);
      const ok = await onSave(next);
      if (ok) setModal(null);else setError("Not saved. Keep these edits open and check the workbook error.");
    } catch (e) {
      setError(e.message);
    }
  }
  function receipt(old = null) {
    setError("");
    setModal({
      type: "receipt",
      id: old?.id || null,
      date: old?.date || "",
      month: old?.month || activeMonth,
      amount: old?.amount ?? "",
      note: old?.note || "",
      dirty: false
    });
  }
  async function saveReceipt(e) {
    e.preventDefault();
    try {
      if (!modal.id && !modal.date) throw Error("Enter the date received for a new payment.");
      if (modal.date && (!validDate(modal.date) || modal.date.slice(0, 7) !== modal.month)) throw Error("Date must fall within the receipt month.");
      const old = loan.receipts.find(r2 => r2.id === modal.id),
        next = structuredClone(loan);
      const r = {
        ...old,
        id: modal.id || crypto.randomUUID(),
        date: modal.date,
        month: modal.month,
        amount: Number(modal.amount),
        note: modal.note,
        timing: modal.date ? "dated" : old?.timing || "unknown"
      };
      if (old) next.receipts = next.receipts.map(x => x.id === old.id ? r : x);else next.receipts.push(r);
      next.forwardingReviewedThrough = "";
      next.paymentsVerifiedThrough = "";
      await commit(next);
    } catch (err) {
      setError(err.message);
    }
  }
  async function removeReceipt(r) {
    if (!confirm("Remove this " + cash(r.amount) + " loan receipt? This increases the outstanding loan balance.")) return;
    await commit({
      ...loan,
      forwardingReviewedThrough: "",
      paymentsVerifiedThrough: "",
      receipts: loan.receipts.filter(x => x.id !== r.id)
    });
  }
  function download() {
    const html = statementHTML(loan, snapshotDate),
      url = URL.createObjectURL(new Blob([html], {
        type: "text/html;charset=utf-8"
      })),
      a = document.createElement("a");
    a.href = url;
    a.download = `Family-Repayment-Snapshot-${snapshotDate}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  const list = loan?.receipts.filter(r => r.month === activeMonth).slice().sort((a, b) => (a.date || a.month).localeCompare(b.date || b.month)) || [];
  return /* @__PURE__ */React.createElement("section", {
    className: "panel loan-workspace " + (compact ? "loan-compact" : ""),
    "aria-label": compact ? "Family loan receipts" : "Family loan ledger"
  }, compact && /* @__PURE__ */React.createElement("div", {
    className: "panel-heading"
  }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("h2", null, compact ? "Family \xB7 Loan receipts" : "the borrower\u2019s Loan"), /* @__PURE__ */React.createElement("small", null, compact ? monthLabel(key) + " \xB7 Money held separately from household income" : "Complete repayment history \xB7 No interest")), loan && /* @__PURE__ */React.createElement("button", {
    className: "primary",
    disabled: forwardDirty,
    onClick: () => receipt()
  }, "+ Record Payment")), error && !modal && /* @__PURE__ */React.createElement("p", {
    className: "error",
    role: "alert"
  }, error), !loan ? /* @__PURE__ */React.createElement("div", {
    className: "panel-copy"
  }, !compact && /* @__PURE__ */React.createElement(LinkLockBar, null), /* @__PURE__ */React.createElement("p", null, "Link the borrower\u2019s repayment workbook once. Payments entered here or in Residence use the same loan ledger, so they are never counted twice."), /* @__PURE__ */React.createElement("label", null, "Loan workbook path", /* @__PURE__ */React.createElement("input", {
    value: path,
    placeholder: "C:\\Finance\\Family-Repayment.xlsx",
    onChange: e => setPath(e.target.value)
  })), /* @__PURE__ */React.createElement("div", {
    className: "modal-actions"
  }, /* @__PURE__ */React.createElement("button", {
    disabled: busy,
    onClick: async () => {
      try {
        const p = await onBrowse();
        if (p) setPath(p);
      } catch (e) {
        setError(e.message);
      }
    }
  }, "Browse Loan Workbook"), /* @__PURE__ */React.createElement("button", {
    disabled: busy || !path,
    onClick: async () => {
      try {
        await onLink(path);
      } catch (e) {
        setError(e.message);
      }
    }
  }, "Link Loan Workbook"))) : /* @__PURE__ */React.createElement(React.Fragment, null, compact ? /* @__PURE__ */React.createElement("div", {
    className: "loan-compact-totals"
  }, /* @__PURE__ */React.createElement("span", null, "Received this month ", /* @__PURE__ */React.createElement("strong", {
    className: "balance-positive"
  }, "+", cash(money(list)))), /* @__PURE__ */React.createElement("button", {
    onClick: () => setExpanded(!expanded)
  }, expanded ? "Hide Receipts" : "Show Receipts")) : /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("div", {
    className: "loan-orientation-grid"
  }, /* @__PURE__ */React.createElement(LoanOrientation, {
    loan,
    c,
    asOf,
    onDate: setAsOf
  }), /* @__PURE__ */React.createElement("section", {
    className: "loan-connection-card",
    "aria-label": "Workbook connection and actions"
  }, /* @__PURE__ */React.createElement(LinkLockBar, null), /* @__PURE__ */React.createElement("div", {
    className: "loan-active-file"
  }, /* @__PURE__ */React.createElement("strong", null, "Active loan workbook"), /* @__PURE__ */React.createElement("code", null, state.path), /* @__PURE__ */React.createElement("button", {
    disabled: busy || linkBusy || forwardDirty,
    onClick: () => {
      setError("");
      setModal({
        type: "link",
        path: state.path,
        preview: null,
        dirty: false
      });
    }
  }, "Replace Link")), /* @__PURE__ */React.createElement("div", {
    className: "loan-connection-actions"
  }, /* @__PURE__ */React.createElement("button", {
    disabled: busy || forwardDirty,
    onClick: onReload
  }, "Reload Loan"), /* @__PURE__ */React.createElement("button", {
    onClick: () => setModal({
      type: "statement",
      dirty: false
    })
  }, "Preview Monthly Snapshot")))), /* @__PURE__ */React.createElement("div", {
    className: "loan-work-actions"
  }, /* @__PURE__ */React.createElement("button", {
    className: "primary",
    disabled: busy || forwardDirty,
    onClick: () => receipt()
  }, "+ Record Payment")), /* @__PURE__ */React.createElement("div", {
    className: "loan-section-tabs",
    "aria-label": "Loan sections"
  }, /* @__PURE__ */React.createElement("button", {
    "aria-pressed": section === "payments",
    disabled: forwardDirty,
    onClick: () => setSection("payments")
  }, "Payment History"), /* @__PURE__ */React.createElement("button", {
    "aria-pressed": section === "private",
    disabled: forwardDirty,
    onClick: () => setSection("private")
  }, "Private Forwarding"), /* @__PURE__ */React.createElement("button", {
    "aria-pressed": section === "agreement",
    disabled: forwardDirty,
    onClick: () => setSection("agreement")
  }, "Agreement & Reference")), section === "payments" && /* @__PURE__ */React.createElement("div", {
    className: "loan-periods"
  }, /* @__PURE__ */React.createElement("div", {
    className: "loan-year-tabs",
    "aria-label": "Loan years"
  }, years.map(y => /* @__PURE__ */React.createElement("button", {
    key: y,
    "aria-pressed": selected.startsWith(y),
    onClick: () => setSelected(y + selected.slice(4))
  }, y))), /* @__PURE__ */React.createElement("p", {
    className: "loan-year-summary"
  }, /* @__PURE__ */React.createElement("strong", null, selected.slice(0, 4), " received: ", cash(money(loan.receipts.filter(r => r.month.startsWith(selected.slice(0, 4)) && (!r.date || r.date <= asOf) && r.month <= asOf.slice(0, 7))))), " \xB7 As of ", dateLabel(asOf)), /* @__PURE__ */React.createElement("div", {
    className: "loan-month-tabs",
    "aria-label": "Loan months"
  }, monthNames.map((name, i) => {
    const k = selected.slice(0, 4) + "-" + String(i + 1).padStart(2, "0"),
      row = c.rows.find(r => r.month === k);
    return /* @__PURE__ */React.createElement("button", {
      key: k,
      "aria-pressed": selected === k,
      onClick: () => setSelected(k)
    }, /* @__PURE__ */React.createElement("strong", null, name), /* @__PURE__ */React.createElement("small", {
      className: "loan-status " + tone(row)
    }, row?.status || "Outside schedule"));
  })), /* @__PURE__ */React.createElement("div", {
    className: "loan-month-summary"
  }, /* @__PURE__ */React.createElement("h3", null, monthNames[Number(selected.slice(5, 7)) - 1], " ", selected.slice(0, 4)), /* @__PURE__ */React.createElement("div", {
    className: "loan-compact-totals"
  }, /* @__PURE__ */React.createElement("span", null, "Scheduled ", /* @__PURE__ */React.createElement("strong", null, cash(selectedRow?.amount || 0))), /* @__PURE__ */React.createElement("span", null, "Received as of ", dateLabel(asOf), /* @__PURE__ */React.createElement("strong", {
    className: "balance-positive"
  }, cash(selectedRow?.paid ?? money(loan.receipts.filter(r => r.month === selected && (!r.date || r.date <= asOf) && r.month <= asOf.slice(0, 7)))))), /* @__PURE__ */React.createElement("span", null, "Historical monthly gap", /* @__PURE__ */React.createElement("strong", {
    className: selectedRow?.overdue ? "balance-negative" : ""
  }, cash(selectedRow?.missing || 0))), /* @__PURE__ */React.createElement("span", {
    className: "loan-status " + tone(selectedRow)
  }, selectedRow?.status || "Outside schedule"))))), (!compact && section === "payments" || compact && expanded) && /* @__PURE__ */React.createElement("div", {
    className: "loan-receipts"
  }, /* @__PURE__ */React.createElement("h3", null, "Payments received \xB7 ", monthLabel(activeMonth)), list.length ? list.map(r => /* @__PURE__ */React.createElement("article", {
    className: "household-entry",
    key: r.id
  }, /* @__PURE__ */React.createElement("div", {
    className: "entry-line"
  }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("strong", null, r.date ? dateLabel(r.date) : monthLabel(r.month) + " \xB7 day not recorded"), /* @__PURE__ */React.createElement("small", null, r.date && r.date > asOf ? "After overview date \xB7 not yet included in top totals" : "Recorded in the month received")), /* @__PURE__ */React.createElement("strong", {
    className: "balance-positive"
  }, "+", cash(r.amount))), /* @__PURE__ */React.createElement("div", {
    className: "entry-actions"
  }, /* @__PURE__ */React.createElement("button", {
    onClick: () => receipt(r)
  }, "Edit Receipt"), /* @__PURE__ */React.createElement("button", {
    onClick: () => removeReceipt(r)
  }, "Remove Receipt")), r.note && /* @__PURE__ */React.createElement("details", null, /* @__PURE__ */React.createElement("summary", null, "Private note"), /* @__PURE__ */React.createElement("p", null, r.note)))) : /* @__PURE__ */React.createElement("p", null, "No receipts in this month.")), !compact && section === "agreement" && /* @__PURE__ */React.createElement(AgreementReference, {
    loan,
    asOf,
    busy,
    onSave,
    onDirty: setForwardDirty
  }), !compact && section === "private" && /* @__PURE__ */React.createElement(PrivateForwarding, {
    loan,
    asOf,
    busy,
    onDirty: setForwardDirty,
    onSave: async next => {
      validateLoan(next);
      return onSave(next);
    },
    onOpening: () => setModal({
      type: "opening",
      amount: loan.openingForwarded ?? "",
      date: loan.openingForwardedDate || today(),
      dirty: false
    })
  }), /* @__PURE__ */React.createElement("p", {
    className: "hint loan-file"
  }, "Saved in: ", state.name, ". Loan receipts and forwarding do not change household income/expense totals. ", !compact && "Use this app to keep the loan ledger current.")), modal && /* @__PURE__ */React.createElement(Dialog, {
    title: modal.type === "link" ? "Replace loan workbook link" : modal.type === "receipt" ? "Loan payment received" : modal.type === "opening" ? "Opening forwarded total" : modal.type === "remit" ? "Record private remittance" : "Borrower monthly snapshot",
    busy: busy || linkBusy,
    onClose: close
  }, error && /* @__PURE__ */React.createElement("p", {
    className: "error",
    role: "alert"
  }, error), modal.type === "link" && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement(LinkLockBar, null), /* @__PURE__ */React.createElement("p", null, "Currently linked:"), /* @__PURE__ */React.createElement("code", {
    className: "loan-link-path"
  }, state.path), /* @__PURE__ */React.createElement("p", null, "Select the current family repayment workbook in your shared folder. Replacing the link switches which file the app reads and saves. It does not merge, copy, delete or change either workbook."), /* @__PURE__ */React.createElement("label", null, "Replacement workbook path", /* @__PURE__ */React.createElement("input", {
    value: modal.path,
    onChange: e => update({
      path: e.target.value,
      preview: null
    })
  })), /* @__PURE__ */React.createElement("div", {
    className: "modal-actions"
  }, /* @__PURE__ */React.createElement("button", {
    onClick: async () => {
      setLinkBusy(true);
      setError("");
      try {
        const p = await onBrowse();
        if (p) update({
          path: p,
          preview: null
        });
      } catch (e) {
        setError(e.message);
      } finally {
        setLinkBusy(false);
      }
    }
  }, "Browse Replacement Workbook"), /* @__PURE__ */React.createElement("button", {
    disabled: !modal.path.trim(),
    onClick: async () => {
      setLinkBusy(true);
      setError("");
      try {
        const p = await onPreview(modal.path);
        setModal(m => ({
          ...m,
          preview: p
        }));
      } catch (e) {
        setError(e.message);
      } finally {
        setLinkBusy(false);
      }
    }
  }, "Preview Workbook")), modal.preview && /* @__PURE__ */React.createElement("div", {
    className: "notice"
  }, /* @__PURE__ */React.createElement("strong", null, "Selected workbook"), /* @__PURE__ */React.createElement("code", {
    className: "loan-link-path"
  }, modal.preview.path), /* @__PURE__ */React.createElement("p", null, "Original loan: ", cash(modal.preview.loan.principal), " \xB7 Receipts: ", modal.preview.loan.receipts.length, " \xB7 Total received (all dates): ", cash(money(modal.preview.loan.receipts)), " \xB7 Remaining principal: ", cash(modal.preview.loan.principal - money(modal.preview.loan.receipts))), /* @__PURE__ */React.createElement("p", null, "Check that this is the current copy you intend to use."), /* @__PURE__ */React.createElement("button", {
    className: "primary",
    onClick: async () => {
      setLinkBusy(true);
      setError("");
      try {
        await onLink(modal.preview.path, modal.preview.revision);
        setModal(null);
      } catch (e) {
        setError(e.message);
      } finally {
        setLinkBusy(false);
      }
    }
  }, "Use This Workbook")), /* @__PURE__ */React.createElement("button", {
    onClick: close
  }, "Cancel Replacement")), modal.type === "receipt" && /* @__PURE__ */React.createElement("form", {
    onSubmit: saveReceipt
  }, /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, /* @__PURE__ */React.createElement("label", null, "Receipt month", /* @__PURE__ */React.createElement("div", {
    className: "receipt-month-picker"
  }, /* @__PURE__ */React.createElement("select", {
    "aria-label": "Receipt month name",
    value: modal.month.slice(5, 7),
    onChange: e => update({
      month: modal.month.slice(0, 4) + "-" + e.target.value
    })
  }, monthNames.map((name, i) => /* @__PURE__ */React.createElement("option", {
    key: name,
    value: String(i + 1).padStart(2, "0")
  }, name.slice(0, 3)))), /* @__PURE__ */React.createElement("input", {
    "aria-label": "Receipt year",
    type: "number",
    required: true,
    min: "1900",
    max: "2200",
    value: modal.month.slice(0, 4),
    onChange: e => update({
      month: e.target.value + "-" + modal.month.slice(5, 7)
    })
  }))), /* @__PURE__ */React.createElement("label", null, "Received on ", modal.id ? "(leave blank if unknown)" : "", /* @__PURE__ */React.createElement("input", {
    type: "date",
    required: !modal.id,
    value: modal.date,
    onChange: e => update({
      date: e.target.value,
      ...(e.target.value ? {
        month: e.target.value.slice(0, 7)
      } : {})
    })
  }))), /* @__PURE__ */React.createElement("label", null, "Amount received ($)", /* @__PURE__ */React.createElement("input", {
    type: "number",
    min: "0.01",
    step: "0.01",
    required: true,
    value: modal.amount,
    onChange: e => update({
      amount: e.target.value
    })
  })), /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, "This receipt reduces the overall loan balance. It stays in the month received and does not fill earlier skipped months."), /* @__PURE__ */React.createElement("label", null, "Private receipt note \xB7 stays with this payment", /* @__PURE__ */React.createElement("textarea", {
    value: modal.note,
    maxLength: "3000",
    onChange: e => update({
      note: e.target.value
    })
  })), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "This is one loan receipt, visible from both Residence and the borrower\u2019s Loan. It is held money, not spendable personal income."), /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, "Save Loan Payment")), modal.type === "opening" && /* @__PURE__ */React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      commit({
        ...loan,
        openingForwarded: Number(modal.amount),
        openingForwardedDate: modal.date,
        forwardingReviewedThrough: "",
        paymentsVerifiedThrough: ""
      });
    }
  }, /* @__PURE__ */React.createElement("label", null, "Total already forwarded ($)", /* @__PURE__ */React.createElement("input", {
    required: true,
    type: "number",
    min: "0",
    step: "0.01",
    value: modal.amount,
    onChange: e => update({
      amount: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "As of date", /* @__PURE__ */React.createElement("input", {
    required: true,
    type: "date",
    value: modal.date,
    onChange: e => update({
      date: e.target.value
    })
  })), /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, "Enter the confirmed total sent before separately recording new remittances here. Do not include those newer remittances twice. Blank markers in the original sheet have not been treated as proof of transfer."), /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, "Save Opening Total")), modal.type === "remit" && /* @__PURE__ */React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      commit({
        ...loan,
        remittances: [...loan.remittances, {
          id: crypto.randomUUID(),
          date: modal.date,
          amount: Number(modal.amount),
          note: modal.note
        }]
      });
    }
  }, /* @__PURE__ */React.createElement("label", null, "Date sent", /* @__PURE__ */React.createElement("input", {
    type: "date",
    required: true,
    value: modal.date,
    onChange: e => update({
      date: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "Amount forwarded ($)", /* @__PURE__ */React.createElement("input", {
    type: "number",
    required: true,
    min: "0.01",
    step: "0.01",
    value: modal.amount,
    onChange: e => update({
      amount: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "Private note", /* @__PURE__ */React.createElement("textarea", {
    value: modal.note,
    onChange: e => update({
      note: e.target.value
    })
  })), /* @__PURE__ */React.createElement("p", null, "Recording this transfer does not reduce the borrower\u2019s loan balance again. The receipt already did that."), /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, "Save Remittance")), modal.type === "statement" && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("p", null, "As of ", dateLabel(snapshotDate), ". This snapshot contains only repayment information. Private notes and forwarding arrangements are excluded."), /* @__PURE__ */React.createElement("iframe", {
    title: "Borrower snapshot preview",
    className: "loan-statement-preview",
    sandbox: "",
    srcDoc: statementHTML(loan, snapshotDate)
  }), /* @__PURE__ */React.createElement("button", {
    className: "primary",
    onClick: download
  }, "Download Borrower Snapshot"), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Open the downloaded HTML file in your browser. Use Print \u2192 Save as PDF to send a PDF. Nothing is sent automatically."))));
}
export { LoanWorkspace as default };
