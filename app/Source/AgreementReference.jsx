import React, { useState, useEffect } from "react";
import { calculateLoan, validateLoan } from "./loan.js";
function referenceDraft(loan) {
  return {
    initialPayment: loan.initialPayment,
    monthlyPayment: loan.monthlyPayment,
    rateChange: loan.rateChange,
    dueDay: loan.dueDay,
    graceDays: loan.graceDays || 0,
    title: loan.agreementReference?.title || "",
    text: loan.agreementReference?.text || "",
    forwardingRecipient: loan.forwardingRecipient || ""
  };
}
function applyAgreement(loan, draft) {
  if (draft.text.length > 1e4) throw Error("Keep reference text within 10,000 characters.");
  if (!/^\d{4}-\d{2}$/.test(draft.rateChange) || !Number.isFinite(Date.parse(draft.rateChange + "-01"))) throw Error("Choose the payment-change month.");
  for (const k of ["initialPayment", "monthlyPayment"]) if (!Number.isFinite(Number(draft[k])) || Number(draft[k]) <= 0) throw Error("Payment amounts must be positive.");
  const next = {
    ...structuredClone(loan),
    initialPayment: Number(draft.initialPayment),
    monthlyPayment: Number(draft.monthlyPayment),
    rateChange: draft.rateChange,
    dueDay: Number(draft.dueDay),
    graceDays: Number(draft.graceDays),
    forwardingRecipient: draft.forwardingRecipient.trim(),
    agreementReference: {
      title: draft.title.trim() || "Agreement reference",
      text: draft.text
    },
    agreementTermsNote: "User-entered zero-interest repayment terms. Reference text is private and does not automatically create rules."
  };
  return validateLoan(next);
}
function AgreementReference({
  loan,
  asOf,
  onSave,
  busy,
  onDirty
}) {
  const [draft, setDraft] = useState(null),
    [preview, setPreview] = useState(null),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  useEffect(() => {
    onDirty?.(!!draft);
    return () => onDirty?.(false);
  }, [!!draft]);
  const cash = n => Number(n).toLocaleString("en-US", {
    style: "currency",
    currency: "USD"
  });
  function change(values) {
    setDraft(d => ({
      ...d,
      ...values
    }));
    setPreview(null);
    setError("");
  }
  return /* @__PURE__ */React.createElement("section", {
    className: "agreement-reference"
  }, /* @__PURE__ */React.createElement("h3", null, "Agreement & reference"), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Private reference \xB7 The full text is excluded from borrower snapshots"), /* @__PURE__ */React.createElement("div", {
    className: "loan-compact-totals"
  }, /* @__PURE__ */React.createElement("span", null, "Current payment", /* @__PURE__ */React.createElement("strong", null, cash(loan.monthlyPayment))), /* @__PURE__ */React.createElement("span", null, "Due day", /* @__PURE__ */React.createElement("strong", null, loan.dueDay)), /* @__PURE__ */React.createElement("span", null, "Grace period", /* @__PURE__ */React.createElement("strong", null, loan.graceDays || 0, " days"))), /* @__PURE__ */React.createElement("p", null, "No interest. Late status begins the day after the grace period ends."), !draft ? /* @__PURE__ */React.createElement(React.Fragment, null, /* @__PURE__ */React.createElement("button", {
    disabled: busy,
    onClick: () => setDraft(referenceDraft(loan))
  }, "Edit terms & reference"), loan.agreementReference?.text ? /* @__PURE__ */React.createElement("details", {
    className: "household-entry"
  }, /* @__PURE__ */React.createElement("summary", null, loan.agreementReference.title || "Agreement reference", " \xB7 Full text"), /* @__PURE__ */React.createElement("pre", {
    style: {
      whiteSpace: "pre-wrap",
      fontFamily: "inherit",
      lineHeight: 1.6,
      maxHeight: "55vh",
      overflow: "auto"
    }
  }, loan.agreementReference.text)) : /* @__PURE__ */React.createElement("p", null, "No reference document added. Paste text or import a plain-text file using Edit terms & reference.")) : /* @__PURE__ */React.createElement("form", {
    onSubmit: e => {
      e.preventDefault();
      try {
        setPreview(applyAgreement(loan, draft));
        setError("");
      } catch (e2) {
        setError(e2.message);
      }
    }
  }, /* @__PURE__ */React.createElement("fieldset", {
    disabled: busy || saving
  }, /* @__PURE__ */React.createElement("h4", null, "Repayment terms"), /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, /* @__PURE__ */React.createElement("label", null, "Initial monthly payment ($)", /* @__PURE__ */React.createElement("input", {
    required: true,
    type: "number",
    min: "0.01",
    step: "0.01",
    value: draft.initialPayment,
    onChange: e => change({
      initialPayment: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "Current monthly payment ($)", /* @__PURE__ */React.createElement("input", {
    required: true,
    type: "number",
    min: "0.01",
    step: "0.01",
    value: draft.monthlyPayment,
    onChange: e => change({
      monthlyPayment: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "Current payment applies from", /* @__PURE__ */React.createElement("input", {
    required: true,
    type: "month",
    min: loan.start,
    value: draft.rateChange,
    onChange: e => change({
      rateChange: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "Due day (1\u201328)", /* @__PURE__ */React.createElement("input", {
    required: true,
    type: "number",
    min: "1",
    max: "28",
    value: draft.dueDay,
    onChange: e => change({
      dueDay: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "Grace days (0\u201314)", /* @__PURE__ */React.createElement("input", {
    required: true,
    type: "number",
    min: "0",
    max: "14",
    value: draft.graceDays,
    onChange: e => change({
      graceDays: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "Forwarding recipient (optional)", /* @__PURE__ */React.createElement("input", {
    maxLength: 100,
    value: draft.forwardingRecipient,
    onChange: e => change({
      forwardingRecipient: e.target.value
    })
  }))), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Due-day and grace changes apply throughout the schedule. Receipt dates/amounts remain unchanged. Use the first payment month and matching payment amounts for one fixed amount throughout."), /* @__PURE__ */React.createElement("h4", null, "Private reference document"), /* @__PURE__ */React.createElement("label", null, "Title", /* @__PURE__ */React.createElement("input", {
    maxLength: 150,
    value: draft.title,
    onChange: e => change({
      title: e.target.value
    })
  })), /* @__PURE__ */React.createElement("label", null, "Import plain text (.txt)", /* @__PURE__ */React.createElement("input", {
    type: "file",
    accept: ".txt,text/plain",
    onChange: async e => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        if (f.size > 4e4) throw Error("Choose a text file up to 40 KB.");
        const text = await f.text();
        if (text.length > 1e4 || text.includes("\0")) throw Error("Use plain text up to 10,000 characters.");
        change({
          text,
          title: draft.title || f.name
        });
      } catch (e2) {
        setError(e2.message);
      }
    }
  })), /* @__PURE__ */React.createElement("label", null, "Full text", /* @__PURE__ */React.createElement("textarea", {
    rows: 12,
    maxLength: 1e4,
    value: draft.text,
    onChange: e => change({
      text: e.target.value
    })
  })), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Stored in your repayment workbook. Import replaces this draft; nothing is saved until you confirm. For a PDF, paste its text here. Reference wording does not automatically change financial terms."), /* @__PURE__ */React.createElement("button", {
    className: "primary"
  }, "Preview changes"), " ", /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: () => {
      if (confirm("Discard unsaved terms and reference edits?")) {
        setDraft(null);
        setPreview(null);
        setError("");
      }
    }
  }, "Cancel"), preview && /* @__PURE__ */React.createElement("div", {
    className: "notice"
  }, /* @__PURE__ */React.createElement("strong", null, "Review before saving"), /* @__PURE__ */React.createElement("p", null, "Catch-up as of ", asOf, ": ", cash(calculateLoan(loan, asOf).arrears), " \u2192 ", cash(calculateLoan(preview, asOf).arrears)), /* @__PURE__ */React.createElement("p", null, "Due day ", preview.dueDay, " \xB7 ", preview.graceDays, " grace days \xB7 Reference: ", preview.agreementReference.text.length, " characters. Actual receipts and forwarding are retained."), /* @__PURE__ */React.createElement("button", {
    type: "button",
    className: "primary",
    onClick: async () => {
      setSaving(true);
      setError("");
      try {
        if (await onSave(preview)) {
          setDraft(null);
          setPreview(null);
        } else setError("Not saved. Check the workbook error.");
      } catch (e) {
        setError(e.message);
      } finally {
        setSaving(false);
      }
    }
  }, "Save terms & reference")))), error && /* @__PURE__ */React.createElement("p", {
    role: "alert",
    className: "error"
  }, error));
}
export { applyAgreement, AgreementReference as default, referenceDraft };
