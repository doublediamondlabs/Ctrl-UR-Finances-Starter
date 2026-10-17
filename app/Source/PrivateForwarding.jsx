import { monthLabel, dateLabel } from "./loanDates.js";
import { ReceiptLedger, SentLedger } from "./ForwardingLedger.jsx";
import PersonalWorkspace from "./PersonalWorkspace.jsx";
import React, { useState, useEffect } from "react";
import { allocated, unassignedHistory, receiptDate, saveForwarding } from "./forwarding.js";
import { money, validDate } from "./loan.js";
const cash = n => Number(n).toLocaleString("en-US", {
  style: "currency",
  currency: "USD"
});
const today = () => {
  const d = /* @__PURE__ */new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
function PrivateForwarding({
  loan,
  asOf,
  onSave,
  busy,
  onDirty,
  onOpening
}) {
  const [draft, setDraft] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false),
    [reviewDate, setReviewDate] = useState(""),
    [year, setYear] = useState(asOf.slice(0, 4)),
    [availableOnly, setAvailableOnly] = useState(false),
    [pane, setPane] = useState(0);
  useEffect(() => {
    onDirty?.(!!draft);
    return () => onDirty?.(false);
  }, [!!draft]);
  const rows = loan.receipts.filter(r => receiptDate(r) <= asOf).slice().sort((a, b) => receiptDate(a).localeCompare(receiptDate(b))),
    history = loan.remittances.slice().sort((a, b) => b.date.localeCompare(a.date)),
    sent = (loan.openingForwarded !== null && asOf >= loan.openingForwardedDate ? Number(loan.openingForwarded) : 0) + money(history.filter(r => r.date <= asOf)),
    received = money(rows),
    blocked = unassignedHistory(loan),
    working = busy || saving;
  const years = [... /* @__PURE__ */new Set([asOf.slice(0, 4), ...loan.receipts.map(r => r.month.slice(0, 4)), ...history.map(h => h.date.slice(0, 4))])].sort();
  const visibleRows = rows.filter(r => (year === "all" || r.month.startsWith(year)) && (!availableOnly || blocked || allocated(loan, r.id) < r.amount)),
    visibleHistory = history.filter(h => year === "all" || h.date.startsWith(year));
  async function save(next) {
    setError("");
    setSaving(true);
    try {
      if (await onSave(next)) {
        setDraft(null);
        return true;
      }
      setError("Not saved. Keep the form open and review the workbook error.");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
    return false;
  }
  function edit(row = null) {
    setPane(1);
    setError("");
    setDraft({
      id: row?.id || null,
      date: row?.date || today(),
      amount: row?.amount ?? "",
      reference: row?.reference || "",
      note: row?.note || "",
      selected: Object.fromEntries((row?.allocations || []).map(a => [a.receiptId, String(a.amount)]))
    });
  }
  function change(p) {
    setError("");
    setDraft(d => ({
      ...d,
      ...p
    }));
  }
  const selectionTotal = draft ? Object.values(draft.selected).reduce((n, x) => n + Math.round(Number(x || 0) * 100), 0) / 100 : 0;
  return /* @__PURE__ */React.createElement("section", {
    className: "private-forwarding"
  }, /* @__PURE__ */React.createElement("h3", null, "Private forwarding", loan.forwardingRecipient ? ` \xB7 ${loan.forwardingRecipient}` : ""), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "All years \xB7 As of ", dateLabel(asOf), " \xB7 Excluded from the borrower\u2019s snapshot"), /* @__PURE__ */React.createElement("div", {
    className: "loan-compact-totals"
  }, /* @__PURE__ */React.createElement("span", null, "Received from the borrower", /* @__PURE__ */React.createElement("strong", null, cash(received))), /* @__PURE__ */React.createElement("span", null, "Sent to the recipient", /* @__PURE__ */React.createElement("strong", null, cash(sent))), /* @__PURE__ */React.createElement("span", null, "Still held", /* @__PURE__ */React.createElement("strong", null, cash(Math.round((received - sent) * 100) / 100)))), /* @__PURE__ */React.createElement("p", {
    className: "forwarding-review-status"
  }, loan.paymentsVerifiedThrough ? `You verified received and forwarded payments through ${dateLabel(loan.paymentsVerifiedThrough)}` : loan.forwardingReviewedThrough ? `Forwarding previously checked through ${dateLabel(loan.forwardingReviewedThrough)} \xB7 Verify both receipts and forwarding against statements` : "Not yet verified against statements \xB7 Still held depends on complete receipt and forwarding entries"), loan.openingForwarded > 0 && /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, "An earlier summary of ", cash(loan.openingForwarded), " is still included in Sent to the recipient. It is not assigned to receipts. To replace it with individual history, review the summary first; do not count the same money twice. ", /* @__PURE__ */React.createElement("button", {
    disabled: working || !!draft,
    onClick: onOpening
  }, "Review Earlier Forwarded Total")), blocked && /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, "Earlier forwarding is not fully connected to receipts. Edit each unassigned history record to connect it before making a new batch. Receipt availability is not confirmed while unassigned history remains."), error && /* @__PURE__ */React.createElement("p", {
    role: "alert",
    className: "error"
  }, error), !draft && /* @__PURE__ */React.createElement("button", {
    className: "primary",
    disabled: working || blocked,
    onClick: () => edit()
  }, "+ Record money sent to the recipient"), draft && /* @__PURE__ */React.createElement("form", {
    className: "panel forwarding-form",
    onSubmit: async e => {
      e.preventDefault();
      try {
        await save(saveForwarding(loan, draft));
      } catch (err) {
        setError(err.message);
      }
    }
  }, /* @__PURE__ */React.createElement("h4", null, draft.id ? "Edit forwarding record" : "Select receipts for this payment to the recipient"), /* @__PURE__ */React.createElement("fieldset", {
    disabled: working
  }, /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, /* @__PURE__ */React.createElement("label", null, "Actual date sent", /* @__PURE__ */React.createElement("input", {
    required: true,
    type: "date",
    max: today(),
    value: draft.date,
    onChange: e => change({
      date: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "Actual amount sent ($)", /* @__PURE__ */React.createElement("input", {
    required: true,
    type: "number",
    min: "0.01",
    step: "0.01",
    value: draft.amount,
    onChange: e => change({
      amount: e.target.value
    })
  }))), /* @__PURE__ */React.createElement("p", null, "Select any number of receipts. For a partial forwarding, enter only the portion sent. Imported receipts with no day need your date verification."), /* @__PURE__ */React.createElement("div", {
    className: "forwarding-receipt-picker"
  }, loan.receipts.slice().sort((a, b) => receiptDate(a).localeCompare(receiptDate(b))).filter(r => allocated(loan, r.id, draft.id) < r.amount || draft.selected[r.id] !== void 0).map(r => {
    const available = Math.round((r.amount - allocated(loan, r.id, draft.id)) * 100) / 100,
      chosen = draft.selected[r.id] !== void 0,
      tooEarly = receiptDate(r) > draft.date;
    return /* @__PURE__ */React.createElement("article", {
      className: "household-entry",
      key: r.id
    }, /* @__PURE__ */React.createElement("label", {
      className: "check"
    }, /* @__PURE__ */React.createElement("input", {
      type: "checkbox",
      checked: chosen,
      disabled: tooEarly && !chosen,
      onChange: e => {
        const selected = {
          ...draft.selected
        };
        if (e.target.checked) selected[r.id] = String(available);else delete selected[r.id];
        change({
          selected
        });
      }
    }), r.date ? dateLabel(r.date) : monthLabel(r.month) + " \xB7 day unverified", " \xB7 Received ", cash(r.amount), " \xB7 Unassigned ", cash(available)), tooEarly && /* @__PURE__ */React.createElement("small", null, "After the date sent \u2014 choose the correct date or receipt."), r.note && /* @__PURE__ */React.createElement("details", null, /* @__PURE__ */React.createElement("summary", null, "Receipt\u2019s private note"), /* @__PURE__ */React.createElement("p", null, r.note)), chosen && /* @__PURE__ */React.createElement("label", null, "Portion of this receipt sent ($)", /* @__PURE__ */React.createElement("input", {
      "aria-label": "Portion " + r.id,
      required: true,
      type: "number",
      min: "0.01",
      max: available,
      step: "0.01",
      value: draft.selected[r.id],
      onChange: e => change({
        selected: {
          ...draft.selected,
          [r.id]: e.target.value
        }
      })
    })));
  })), /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, "Selected total: ", cash(selectionTotal)), " \xB7 Difference from amount sent: ", cash(Math.round((Number(draft.amount || 0) - selectionTotal) * 100) / 100)), /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => change({
      amount: selectionTotal
    })
  }, "Use Selected Total As Amount Sent"), /* @__PURE__ */React.createElement("label", null, "Bank / transfer reference (optional)", /* @__PURE__ */React.createElement("input", {
    value: draft.reference,
    maxLength: 300,
    onChange: e => change({
      reference: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "Private forwarding note", /* @__PURE__ */React.createElement("textarea", {
    value: draft.note,
    maxLength: 3e3,
    onChange: e => change({
      note: e.target.value
    })
  })), /* @__PURE__ */React.createElement("p", null, "This records an actual transfer you already made. It does not send money or reduce the borrower\u2019s loan balance a second time."), /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, "Save Forwarding Record"), " ", /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => {
      if (confirm("Discard this unsaved forwarding form?")) {
        setDraft(null);
        setError("");
      }
    }
  }, "Cancel"))), !draft && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("div", {
    className: "forwarding-year-filter"
  }, /* @__PURE__ */React.createElement("label", null, "View year", /* @__PURE__ */React.createElement("select", {
    value: year,
    onChange: e => setYear(e.target.value)
  }, /* @__PURE__ */React.createElement("option", {
    value: "all"
  }, "All years"), years.map(y => /* @__PURE__ */React.createElement("option", {
    key: y,
    value: y
  }, y)))), /* @__PURE__ */React.createElement("small", null, "Filters lists only; top totals cover all years through ", dateLabel(asOf), ".")), /* @__PURE__ */React.createElement(PersonalWorkspace, {
    idPrefix: "private-forwarding",
    initialSelected: pane,
    onSelectedChange: setPane,
    ariaLabel: "Private forwarding",
    labels: ["Receipts", "Forwarding history", "Verify against statements"]
  }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("div", {
    className: "forwarding-pane-heading"
  }, /* @__PURE__ */React.createElement("h4", null, "Receipts \xB7 ", year === "all" ? "All years" : year), /* @__PURE__ */React.createElement("label", {
    className: "forwarding-check"
  }, /* @__PURE__ */React.createElement("input", {
    type: "checkbox",
    checked: availableOnly,
    onChange: e => setAvailableOnly(e.target.checked)
  }), "Still to forward only")), /* @__PURE__ */React.createElement(ReceiptLedger, {
    rows: visibleRows,
    history,
    loan,
    blocked,
    asOf
  }), !visibleRows.length && /* @__PURE__ */React.createElement("p", null, "No matching receipts through this as-of date.")), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("h4", null, "Forwarding history \xB7 ", year === "all" ? "All years" : year), /* @__PURE__ */React.createElement(SentLedger, {
    history: visibleHistory,
    loan,
    asOf,
    working,
    onEdit: edit,
    onRemove: h => {
      if (confirm("Remove this forwarding record? Its receipt allocations become available again. the borrower\u2019s payments and loan balance stay unchanged.")) save({
        ...loan,
        forwardingReviewedThrough: "",
        paymentsVerifiedThrough: "",
        remittances: loan.remittances.filter(r => r.id !== h.id)
      });
    }
  }), !visibleHistory.length && /* @__PURE__ */React.createElement("p", null, "No forwarding records for this year. Use Record money sent to the recipient to add a batch.")), /* @__PURE__ */React.createElement("div", {
    className: "forwarding-review"
  }, /* @__PURE__ */React.createElement("h4", null, "Verify against statements"), /* @__PURE__ */React.createElement("div", {
    className: "verification-action-card"
  }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("strong", null, "Confirm your statement check"), /* @__PURE__ */React.createElement("p", null, "Checked all receipts and forwarding through this date?")), /* @__PURE__ */React.createElement("div", {
    className: "verification-action-controls"
  }, /* @__PURE__ */React.createElement("label", null, "Payments verified through", /* @__PURE__ */React.createElement("input", {
    type: "date",
    max: today(),
    value: reviewDate,
    onChange: e => setReviewDate(e.target.value)
  })), /* @__PURE__ */React.createElement("button", {
    className: "primary",
    disabled: working || blocked || !validDate(reviewDate) || reviewDate > today(),
    onClick: () => save({
      ...loan,
      forwardingReviewedThrough: reviewDate,
      paymentsVerifiedThrough: reviewDate
    })
  }, "Mark Payments Verified")), loan.paymentsVerifiedThrough && /* @__PURE__ */React.createElement("small", null, "Last confirmed through ", dateLabel(loan.paymentsVerifiedThrough))), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Use bank statements to check all payments received from the borrower and forwarded to the recipient. Correct missing or incorrect entries first. This records your verification across all years through the selected date; the app does not automatically compare bank statements."), /* @__PURE__ */React.createElement("details", null, /* @__PURE__ */React.createElement("summary", null, "How totals and notes work"), /* @__PURE__ */React.createElement("p", null, "Top totals include receipts and transfers through the as-of date, across all years. Forwarding history lists all transfers in the selected year, even after the as-of date. Receipt notes stay with each receipt; forwarding notes describe the batch. Neither appears in the borrower\u2019s snapshot."))))));
}
export { PrivateForwarding as default };
