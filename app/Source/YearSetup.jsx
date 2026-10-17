import { LinkLockBar } from "./LinkGuard.jsx";
import React, { useState, useRef, useEffect } from "react";
import { readBook, writeBook, blankBook } from "./workbook.js";
import { prepareYear } from "./yearSetup.js";
const cash = n => n == null ? "Blank" : Number(n).toLocaleString("en-US", {
  style: "currency",
  currency: "USD"
});
function YearSetup({
  links,
  initialYear,
  api,
  onClose,
  onApplied,
  allowBusiness = true
}) {
  const [sourceYear, setSourceYear] = useState(initialYear),
    [targetYear, setTargetYear] = useState(Number(initialYear) + 1),
    [options, setOptions] = useState({
      replacePlanned: false,
      keepAmounts: false,
      stageBusiness: allowBusiness,
      stageIncome: true
    }),
    [preview, setPreview] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const ref = useRef();
  useEffect(() => {
    ref.current.showModal();
  }, []);
  function change(set, value) {
    set(value);
    setPreview(null);
    setError("");
  }
  async function inspect() {
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const y = Number(targetYear);
      if (!Number.isInteger(y) || y <= Number(sourceYear) || y > 2200) throw Error("Choose a destination year after the source year, up to 2200.");
      const source = await api("workbook?year=" + sourceYear),
        existing = !!links[y],
        target = existing ? await api("workbook?year=" + y) : {
          base64: blankBook(y),
          year: y,
          path: "New workbook in the app\u2019s Workbooks folder"
        };
      const result2 = prepareYear(readBook(source.base64, Number(sourceYear)), readBook(target.base64, y), options);
      setPreview({
        source,
        target,
        existing,
        result: result2,
        y,
        sourceYear: Number(sourceYear)
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function apply() {
    if (!preview) return;
    setBusy(true);
    setError("");
    try {
      const {
          source,
          target,
          existing,
          result: result2,
          y,
          sourceYear: sy
        } = preview,
        base64 = writeBook(target.base64, result2.book),
        body = {
          year: y,
          base64,
          sourceYear: sy,
          sourceRevision: source.revision,
          sourcePath: source.path,
          ...(existing ? {
            revision: target.revision,
            workbookPath: target.path
          } : {})
        };
      const saved = await api(existing ? "save" : "create", body);
      await onApplied({
        ...target,
        ...saved,
        base64,
        year: y
      }, existing);
      onClose();
    } catch (e) {
      setError(e.message);
      setPreview(null);
    } finally {
      setBusy(false);
    }
  }
  const result = preview?.result;
  return /* @__PURE__ */React.createElement("dialog", {
    ref,
    className: "household-dialog year-setup-dialog",
    onCancel: e => {
      e.preventDefault();
      if (!busy) onClose();
    }
  }, /* @__PURE__ */React.createElement("div", {
    className: "modal-head"
  }, /* @__PURE__ */React.createElement("h2", null, "Prepare or refresh next year"), /* @__PURE__ */React.createElement("button", {
    "aria-label": "Close year setup",
    disabled: busy,
    onClick: onClose
  }, "\xD7")), /* @__PURE__ */React.createElement(LinkLockBar, null), /* @__PURE__ */React.createElement("fieldset", {
    disabled: busy
  }, error && /* @__PURE__ */React.createElement("p", {
    className: "error",
    role: "alert"
  }, error), /* @__PURE__ */React.createElement("div", {
    className: "form-grid"
  }, /* @__PURE__ */React.createElement("label", null, "Source year", /* @__PURE__ */React.createElement("select", {
    value: sourceYear,
    onChange: e => change(setSourceYear, Number(e.target.value))
  }, Object.keys(links).sort().map(y => /* @__PURE__ */React.createElement("option", {
    key: y
  }, y)))), /* @__PURE__ */React.createElement("label", null, "Destination year", /* @__PURE__ */React.createElement("input", {
    type: "number",
    min: "1900",
    max: "2200",
    value: targetYear,
    onChange: e => change(setTargetYear, e.target.value)
  }))), /* @__PURE__ */React.createElement("p", null, "Carry category names, subcategories, order and month availability forward. Destination-only categories remain. Recorded entries, notes, transfers and bank history in the destination are retained. Source transactions and notes are not copied."), [["stageBusiness", "Stage business recurring expenses"], ["stageIncome", "Stage personal income sources marked recurring"], ["keepAmounts", "Include fixed amounts as planned estimates"], ["replacePlanned", "Replace existing planned placeholders without notes or bank links"]].filter(([key]) => key !== "stageBusiness" || allowBusiness).map(([key, label]) => /* @__PURE__ */React.createElement("label", {
    className: "check",
    key
  }, /* @__PURE__ */React.createElement("input", {
    type: "checkbox",
    checked: options[key],
    onChange: e => change(setOptions, {
      ...options,
      [key]: e.target.checked
    })
  }), label)), /* @__PURE__ */React.createElement("p", {
    className: "hint"
  }, "Amounts default to blank. Variable amounts stay blank. Templates use the most recent recorded sample, falling back to the most recent planned sample. Review the list for retired or renamed expenses. Existing entries are kept unless you explicitly choose placeholder replacement."), /* @__PURE__ */React.createElement("button", {
    onClick: inspect
  }, "Preview Year Setup"), preview && /* @__PURE__ */React.createElement("section", {
    className: "year-setup-preview"
  }, /* @__PURE__ */React.createElement("h3", null, preview.sourceYear, " \u2192 ", preview.y, " \xB7 ", preview.existing ? "Refresh linked workbook" : "Create new workbook"), /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, "Source:"), " ", /* @__PURE__ */React.createElement("code", null, preview.source.path)), /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, "Destination:"), " ", /* @__PURE__ */React.createElement("code", null, preview.target.path)), /* @__PURE__ */React.createElement("p", null, result.changes.length, " setup changes \xB7 ", result.added.length, " planned entries to add \xB7 ", result.removed.length, " planned placeholders to remove \xB7 ", result.recordedKept, " recorded entries retained \xB7 ", result.protectedRows.length, " planned entries protected by notes or bank links."), /* @__PURE__ */React.createElement("p", null, result.skipped.length, " matching monthly templates skipped to avoid duplicates. Category ordering follows the source. Extra destination categories/subcategories remain; months containing existing entries remain available."), /* @__PURE__ */React.createElement("details", null, /* @__PURE__ */React.createElement("summary", null, "Review category changes (", result.changes.length, ")"), result.changes.map((c, i) => /* @__PURE__ */React.createElement("p", {
    key: i
  }, /* @__PURE__ */React.createElement("strong", null, c.action, ": ", c.area, " \u2014 ", c.name), /* @__PURE__ */React.createElement("br", null), c.detail))), /* @__PURE__ */React.createElement("details", null, /* @__PURE__ */React.createElement("summary", null, "Review planned entries to add (", result.added.length, ")"), result.added.map(r => /* @__PURE__ */React.createElement("p", {
    key: r.id
  }, r.month, " \xB7 ", r.kind === "income" ? "Income" : "Business expense", " \xB7 ", r.description, " \xB7 ", cash(r.amount)))), /* @__PURE__ */React.createElement("details", null, /* @__PURE__ */React.createElement("summary", null, "Review placeholders to remove (", result.removed.length, ")"), result.removed.map(r => /* @__PURE__ */React.createElement("p", {
    key: r.id
  }, r.month, " \xB7 ", r.description, " \xB7 ", cash(r.amount)))), /* @__PURE__ */React.createElement("p", {
    className: "notice"
  }, preview.existing ? "A dated backup is created before saving." : "A new annual workbook is created and linked.", " The source workbook and Family separate loan ledger stay unchanged. Reconciliation status is not copied."), /* @__PURE__ */React.createElement("button", {
    className: "primary",
    disabled: preview.existing && !result.changes.length && !result.added.length && !result.removed.length,
    onClick: apply
  }, "Apply Year Setup")), busy && /* @__PURE__ */React.createElement("p", {
    role: "status"
  }, "Working\u2026 keep this window open.")));
}
export { YearSetup as default };
