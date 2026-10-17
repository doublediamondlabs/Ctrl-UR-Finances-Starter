import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { LockKeyhole, LockKeyholeOpen, ArrowRight, ShieldCheck } from "lucide-react";
let unlocked = false,
  timer = null,
  prompt = null,
  pending = null;
const listeners = /* @__PURE__ */new Set();
const subscribe = fn => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
function lockLinks() {
  unlocked = false;
  clearTimeout(timer);
  listeners.forEach(fn => fn());
}
function unlockLinks() {
  unlocked = true;
  clearTimeout(timer);
  timer = setTimeout(lockLinks, 12e4);
  listeners.forEach(fn => fn());
}
const guardedLinkActions = /* @__PURE__ */new Set(["link", "unlink", "create", "loan/link", "loan/create"]);
export const useLinksUnlocked = () => useSyncExternalStore(subscribe, () => unlocked);
function LinkLockBar() {
  const open = useLinksUnlocked();
  return /* @__PURE__ */React.createElement("div", {
    className: "link-lock-bar " + (open ? "unlocked" : "locked")
  }, /* @__PURE__ */React.createElement("div", {
    className: "link-lock-title"
  }, open ? /* @__PURE__ */React.createElement(LockKeyholeOpen, {
    size: 19
  }) : /* @__PURE__ */React.createElement(LockKeyhole, {
    size: 19
  }), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("strong", null, open ? "Link settings unlocked" : "Workbook links locked"), /* @__PURE__ */React.createElement("small", null, open ? "One confirmed change \xB7 relocks automatically" : "Viewing and saving entries remain available"))), /* @__PURE__ */React.createElement("button", {
    type: "button",
    onClick: open ? lockLinks : unlockLinks
  }, open ? "Lock Now" : "Unlock Link Settings"), /* @__PURE__ */React.createElement("details", null, /* @__PURE__ */React.createElement("summary", null, "What does this protect?"), /* @__PURE__ */React.createElement("p", null, "Prevents accidental connection changes. Unlock, check the current and proposed files, then confirm. Relocks after a change, cancellation, navigation, restart, or two minutes. This is not a password or a barrier to someone who can edit your files.")));
}
async function authorizeLinkChange(action, body, read) {
  if (!unlocked) throw Error("Workbook links are locked. Choose Unlock link settings, then retry the change.");
  if (pending) throw Error("Finish the current link review first.");
  const config = await read("years"),
    locations = await read("locations");
  if (!unlocked) throw Error("Link settings relocked. Unlock and retry.");
  const key = String(body.year),
    old = action.startsWith("loan/") ? config.loan : config.years?.[key],
    label = action.startsWith("loan/") ? "Family repayments" : `Calendar year ${key}`,
    loc = locations.files.find(f => f.label === (action.startsWith("loan/") ? "Family loan" : key)),
    sep = locations.app.includes("\\") ? "\\" : "/";
  const proposed = action === "unlink" ? "No linked workbook (file stays on disk)" : action === "loan/create" ? `${locations.data || locations.app}${sep}Family-Repayment.xlsx` : action === "create" ? `${locations.data || locations.app}${sep}Workbooks${sep}${key}-Expense-Book.xlsx` : body.path;
  try {
    if (!prompt) throw Error("Link review is not ready. Reload and try again.");
    await new Promise((resolve, reject) => {
      pending = {
        resolve,
        reject
      };
      prompt({
        label,
        action,
        current: loc?.path || old?.path || "No workbook linked",
        proposed
      });
    });
    if (!unlocked) throw Error("Link settings expired. Unlock and review the change again.");
    return {
      action,
      previous: old?.path || null
    };
  } finally {
    pending = null;
    lockLinks();
  }
}
function LinkGuardDialog() {
  const [review, setReview] = useState(null),
    [checked, setChecked] = useState(false),
    ref = useRef(null);
  useEffect(() => {
    prompt = setReview;
    return () => {
      prompt = null;
      pending?.reject(Error("Link review closed."));
      pending = null;
      lockLinks();
    };
  }, []);
  useEffect(() => {
    setChecked(false);
    if (review) ref.current.showModal();
  }, [review]);
  function finish(ok) {
    if (ok) pending?.resolve();else pending?.reject(Error("Link change cancelled. Existing connection retained."));
    setReview(null);
    if (!ok) lockLinks();
  }
  return review ? /* @__PURE__ */React.createElement("dialog", {
    className: "link-review-dialog",
    ref,
    onCancel: e => {
      e.preventDefault();
      finish(false);
    }
  }, /* @__PURE__ */React.createElement("div", {
    className: "modal-head"
  }, /* @__PURE__ */React.createElement("h2", null, /* @__PURE__ */React.createElement(ShieldCheck, {
    size: 22
  }), " Confirm workbook connection"), /* @__PURE__ */React.createElement("button", {
    "aria-label": "Cancel link change",
    onClick: () => finish(false)
  }, "\xD7")), /* @__PURE__ */React.createElement("p", null, /* @__PURE__ */React.createElement("strong", null, review.label), " \xB7 ", review.action === "unlink" ? "Remove connection" : ["create", "loan/create"].includes(review.action) ? "Create and link workbook" : "Set workbook connection"), /* @__PURE__ */React.createElement("div", {
    className: "link-change-comparison"
  }, /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("small", null, "Current file"), /* @__PURE__ */React.createElement("code", null, review.current)), /* @__PURE__ */React.createElement(ArrowRight, null), /* @__PURE__ */React.createElement("div", null, /* @__PURE__ */React.createElement("small", null, review.action === "unlink" ? "After removal" : "Proposed file"), /* @__PURE__ */React.createElement("code", null, review.proposed))), /* @__PURE__ */React.createElement("p", null, review.action === "unlink" ? "The file and its contents remain on disk. This app will stop using it." : "Future entries will be saved to the proposed file. Existing workbook contents are not merged."), /* @__PURE__ */React.createElement("label", {
    className: "link-confirm-check"
  }, /* @__PURE__ */React.createElement("input", {
    type: "checkbox",
    checked,
    onChange: e => setChecked(e.target.checked)
  }), "I checked the affected year or tracker and the file location."), /* @__PURE__ */React.createElement("div", {
    className: "modal-actions"
  }, /* @__PURE__ */React.createElement("button", {
    onClick: () => finish(false)
  }, "Keep Current Connection"), /* @__PURE__ */React.createElement("button", {
    className: "primary",
    disabled: !checked,
    onClick: () => finish(true)
  }, "Confirm Connection Change"))) : null;
}
export { LinkGuardDialog, LinkLockBar, authorizeLinkChange, guardedLinkActions, lockLinks };
