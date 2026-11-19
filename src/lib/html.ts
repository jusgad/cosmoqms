// Every user-controlled value interpolated into HTML that leaves the app (the
// batch-record PDF, notification emails, the production report) goes through
// this. Escaping `& < > " '` covers both element and attribute contexts.
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
