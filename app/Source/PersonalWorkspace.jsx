import React, { useState, useRef, useEffect } from "react";
const defaultLabels = ["Personal income", "Household expenses", "Transfers", "Family repayments"];
function PersonalWorkspace({
  children,
  locked = false,
  labels = defaultLabels,
  idPrefix = "personal",
  ariaLabel = "Personal monthly workspace",
  initialSelected = 0,
  selectedOverride,
  onSelectedChange
}) {
  const [selected, setSelected] = useState(initialSelected),
    nav = useRef(null);
  useEffect(() => {
    const el = nav.current,
      measure = () => el.parentElement.style.setProperty("--section-nav-height", el.getBoundingClientRect().height + "px");
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (selectedOverride !== void 0) setSelected(selectedOverride);
  }, [selectedOverride]);
  function choose(i) {
    if (locked) return;
    setSelected(i);
    onSelectedChange?.(i);
    const top = nav.current?.getBoundingClientRect().top;
    if (top < 0) nav.current?.scrollIntoView?.({
      block: "start",
      behavior: "smooth"
    });
  }
  return /* @__PURE__ */React.createElement("section", {
    className: "personal-workspace",
    "aria-label": ariaLabel
  }, /* @__PURE__ */React.createElement("div", {
    className: "personal-section-tabs",
    role: "tablist",
    "aria-label": ariaLabel + " sections",
    ref: nav
  }, labels.map((label, i) => /* @__PURE__ */React.createElement("button", {
    key: label,
    id: idPrefix + "-tab-" + i,
    role: "tab",
    type: "button",
    "aria-selected": selected === i,
    "aria-controls": idPrefix + "-pane-" + i,
    tabIndex: selected === i ? 0 : -1,
    disabled: locked,
    onClick: () => choose(i),
    onKeyDown: e => {
      let target;
      if (e.key === "ArrowRight") target = (i + 1) % labels.length;
      if (e.key === "ArrowLeft") target = (i + labels.length - 1) % labels.length;
      if (e.key === "Home") target = 0;
      if (e.key === "End") target = labels.length - 1;
      if (target !== void 0) {
        e.preventDefault();
        choose(target);
        nav.current?.querySelectorAll("button")[target]?.focus();
      }
    }
  }, label))), React.Children.toArray(children).map((child, i) => /* @__PURE__ */React.createElement("div", {
    key: i,
    id: idPrefix + "-pane-" + i,
    role: "tabpanel",
    "aria-labelledby": idPrefix + "-tab-" + i,
    hidden: selected !== i
  }, child)));
}
export { PersonalWorkspace as default };
