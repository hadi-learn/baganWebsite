export interface CategoryStyles {
  background: string;
  color: string;
  border: string;
}

export function getCategoryStyles(category: string): CategoryStyles {
  const cat = category?.toLowerCase() || "";
  
  if (cat.includes("u110")) {
    return { background: "#e0e7ff", color: "#312e81", border: "#a5b4fc" };
  }
  if (cat.includes("u80")) {
    return { background: "#d1fae5", color: "#064e3b", border: "#6ee7b7" };
  }
  if (cat.includes("a-b") || cat.includes("ab")) {
    return { background: "#fef3c7", color: "#78350f", border: "#fcd34d" };
  }
  if (cat.includes("c-d") || cat.includes("cd")) {
    return { background: "#ffe4e6", color: "#881337", border: "#fda4af" };
  }
  if (cat.includes("e-f") || cat.includes("ef")) {
    return { background: "#ede9fe", color: "#4c1d95", border: "#c4b5fd" };
  }

  // Default theme (fallback)
  return { background: "rgba(212, 175, 55, 0.1)", color: "var(--accent)", border: "rgba(212, 175, 55, 0.2)" };
}
