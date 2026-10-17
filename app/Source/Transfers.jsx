import React, { useState, useEffect, useRef } from "react";
import { saveTransfer } from "./transfers.js";
const cash = n => Number(n).toLocaleString("en-US", {
  style: "currency",
  currency: "USD"
});
function Transfers({
  book,
  month,
  onSave,
  busy,
  onDirty,
  initiallyExpanded = false,
  allowBusiness = true,
  requestId,
  onRequestHandled
}) {
  const [expanded, setExpanded] = useState(initiallyExpanded),
    [draft, setDraft] = useState(null),
    [error, setError] = useState(""),
    ref = useRef();
  const period = book.year + "-" + String(month + 1).padStart(2, "0"),
    rows = (book.transfers || []).filter(t => t.date.startsWith(period) && (allowBusiness || t.scope === "personal"));
  useEffect(() => {
    onDirty?.(!!draft);
    if (draft) ref.current?.showModal();
    return () => onDirty?.(false);
  }, [!!draft]);
  useEffect(() => {
    if (requestId) {
      const row = book.transfers?.find(t => t.id === requestId);
      if (row) {
        setExpanded(true);
        edit(row);
      }
      onRequestHandled?.();
    }
  }, [requestId]);
  function close() {
    if (busy) return;
    if (draft?.dirty && !confirm("Discard unsaved transfer changes?")) return;
    setDraft(null);
    setError("");
  }
  function edit(t = null) {
    setError("");
    setDraft(t ? {
      ...t,
      amount: String(t.amount),
      convertId: "",
      dirty: false
    } : {
      id: "",
      date: "",
      amount: "",
      from: "",
      to: "",
      scope: "personal",
      note: "",
      convertId: "",
      dirty: false
    });
  }
  function change(v) {
    setDraft(d => ({
      ...d,
      ...v,
      dirty: true
    }));
    setError("");
  }
  async function commit(next) {
    try {
      if (await onSave(next)) setDraft(null);else setError("Transfer was not saved. Your changes remain open.");
    } catch (e) {
      setError(e.message);
    }
  }
  const candidates = book.records.filter(r => r.kind === "expense" && (allowBusiness || r.scope === "residence") && r.state === "recorded" && r.amount < 0 && !book.bankHistory?.some(h => h.recordId === r.id));
  return /* @__PURE__ */React.createElement("section", {
    className: "expense-group transfers-card",
    "aria-label": "Transfers between accounts"
  }, /* @__PURE__ */React.createElement("div", {
    className: "household-heading"
  }, /* @__PURE__ */React.createElement("button", {
    className: "housing-disclosure",
    "aria-expanded": expanded,
    onClick: () => setExpanded(!expanded)
  }, /* @__PURE__ */React.createElement("span", null, expanded ? "\u25BE" : "\u25B8"), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("h3", null, "Transfers Between Accounts"), /* @__PURE__ */React.createElement("small", null, period, " \xB7 ", rows.length, " Transfers \xB7 Excluded From Income, Expenses And Surplus"))), /* @__PURE__ */React.createElement("button", {
    onClick: () => edit()
  }, "+ Transfer")), expanded && /* @__PURE__ */React.createElement("div", {
    className: "panel-copy"
  }, /* @__PURE__ */React.createElement("p", null, "Record the amount once as a positive number, with its direction shown by From and To. Account balances are not calculated."), rows.map(t => /* @__PURE__ */React.createElement("article", {
    className: "household-entry",
    key: t.id
  }, /* @__PURE__ */React.createElement("strong", null, t.from, " \u2192 ", t.to, " \xB7 ", cash(t.amount)), /* @__PURE__ */React.createElement("p", null, t.date, " \xB7 ", t.scope), t.note && /* @__PURE__ */React.createElement("details", null, /* @__PURE__ */React.createElement("summary", null, "Notes"), /* @__PURE__ */React.createElement("p", {
    style: {
      whiteSpace: "pre-wrap"
    }
  }, t.note)), /* @__PURE__ */React.createElement("button", {
    onClick: () => edit(t)
  }, "Edit Transfer"), /* @__PURE__ */React.createElement("button", {
    disabled: busy,
    onClick: () => {
      if (confirm("Remove this transfer?" + (t.sourceId ? " This will not restore the former negative expense." : ""))) commit({
        ...book,
        transfers: book.transfers.filter(r => r.id !== t.id)
      });
    }
  }, "Remove Transfer"))), !rows.length && /* @__PURE__ */React.createElement("p", null, "No transfers recorded for this month.")), draft && /* @__PURE__ */React.createElement("dialog", {
    ref,
    className: "household-dialog",
    onCancel: e => {
      e.preventDefault();
      close();
    }
  }, /* @__PURE__ */React.createElement("div", {
    className: "modal-head"
  }, /* @__PURE__ */React.createElement("h2", null, draft.id ? "Edit transfer" : "Transfer between accounts"), /* @__PURE__ */React.createElement("button", {
    disabled: busy,
    onClick: close,
    "aria-label": "Close transfer dialog"
  }, "\xD7")), /* @__PURE__ */React.createElement("fieldset", {
    disabled: busy
  }, /* @__PURE__ */React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      try {
        const {
          convertId,
          dirty,
          ...t
        } = draft;
        commit(saveTransfer(book, {
          ...t,
          amount: Number(t.amount)
        }, convertId));
      } catch (err) {
        setError(err.message);
      }
    }
  }, error && /* @__PURE__ */React.createElement("p", {
    role: "alert",
    className: "error"
  }, error), !draft.id && /* @__PURE__ */React.createElement("label", null, "Existing temporary negative expense (optional)", /* @__PURE__ */React.createElement("select", {
    value: draft.convertId,
    onChange: e => {
      const r = candidates.find(x => x.id === e.target.value);
      change({
        convertId: e.target.value,
        ...(r ? {
          amount: String(Math.abs(r.amount)),
          date: r.transactionDate || "",
          scope: r.scope === "business" ? "business" : "personal"
        } : {})
      });
    }
  }, /* @__PURE__ */React.createElement("option", {
    value: ""
  }, "Create a new transfer"), candidates.map(r => /* @__PURE__ */React.createElement("option", {
    key: r.id,
    value: r.id
  }, r.month, " \xB7 ", r.description, " \xB7 ", cash(r.amount))))), draft.convertId && /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, "Only choose an entry that really was a transfer, not a refund. Saving replaces that negative expense with this transfer in one workbook save and preserves its notes. Its former effect on expense and surplus totals is removed. No other entries are converted."), /* @__PURE__ */React.createElement("label", null, "Date", /* @__PURE__ */React.createElement("input", {
    required: true,
    type: "date",
    min: book.year + "-01-01",
    max: book.year + "-12-31",
    value: draft.date,
    onChange: e => change({
      date: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "Amount moved ($)", /* @__PURE__ */React.createElement("input", {
    required: true,
    type: "number",
    min: "0.01",
    step: "0.01",
    value: draft.amount,
    onChange: e => change({
      amount: e.target.value
    })
  })), /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, /* @__PURE__ */React.createElement("label", null, "From account", /* @__PURE__ */React.createElement("input", {
    required: true,
    maxLength: "150",
    list: "transfer-accounts",
    value: draft.from,
    onChange: e => change({
      from: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "To account", /* @__PURE__ */React.createElement("input", {
    required: true,
    maxLength: "150",
    list: "transfer-accounts",
    value: draft.to,
    onChange: e => change({
      to: e.target.value
    })
  }))), /* @__PURE__ */React.createElement("datalist", {
    id: "transfer-accounts"
  }, [... /* @__PURE__ */new Set(["Savings", "Checking", ...(book.transfers || []).flatMap(t => [t.from, t.to])])].map(a => /* @__PURE__ */React.createElement("option", {
    key: a
  }, a))), /* @__PURE__ */React.createElement("label", null, "Area", /* @__PURE__ */React.createElement("select", {
    value: draft.scope,
    onChange: e => change({
      scope: e.target.value
    })
  }, /* @__PURE__ */React.createElement("option", {
    value: "personal"
  }, "Personal"), allowBusiness && /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("option", {
    value: "business"
  }, "Business"), /* @__PURE__ */React.createElement("option", {
    value: "both"
  }, "Between business and personal")))), /* @__PURE__ */React.createElement("label", null, "Notes", /* @__PURE__ */React.createElement("textarea", {
    value: draft.note,
    maxLength: "30000",
    onChange: e => change({
      note: e.target.value
    })
  })), /* @__PURE__ */React.createElement("p", null, "Saved to this year's workbook under the month of the selected date. Excluded from income, spending and surplus totals."), /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, draft.convertId ? "Convert Expense And Save Transfer" : "Save Transfer")))));
}
export { Transfers as default };
