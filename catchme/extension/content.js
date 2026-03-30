/**
 * CatchMe content script — extracts page content using Readability + DOM fallback.
 * Combines Readability.js (article extraction) with simplified DOM walk
 * (inspired by page-agent) for non-article pages.
 */

const MAX_TEXT_LENGTH = 15000;

const SKIP_TAGS = new Set([
  "SCRIPT", "STYLE", "NOSCRIPT", "SVG", "IFRAME", "CANVAS",
  "VIDEO", "AUDIO", "IMG", "BR", "HR",
]);

const SKIP_ROLES = new Set([
  "scrollbar", "separator", "presentation", "none",
]);

function isVisible(el) {
  if (el.getAttribute("aria-hidden") === "true") return false;
  if (el.hasAttribute("hidden")) return false;
  const style = getComputedStyle(el);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

/**
 * Simplified DOM walk — extract visible text with semantic structure.
 * No interactive indices (unlike page-agent), optimized for content understanding.
 */
function walkDOM(node, depth) {
  if (depth > 20) return "";
  if (node.nodeType === Node.TEXT_NODE) {
    const t = node.textContent.trim();
    return t.length > 0 ? t : "";
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const tag = node.tagName;
  if (SKIP_TAGS.has(tag)) return "";
  if (SKIP_ROLES.has(node.getAttribute("role"))) return "";
  if (!isVisible(node)) return "";

  const parts = [];
  for (const child of node.childNodes) {
    const text = walkDOM(child, depth + 1);
    if (text) parts.push(text);
  }
  const joined = parts.join(" ");
  if (!joined) return "";

  const heading = /^H[1-6]$/.test(tag);
  if (heading) return `\n## ${joined}\n`;
  if (tag === "P" || tag === "DIV" || tag === "SECTION" || tag === "ARTICLE")
    return `\n${joined}\n`;
  if (tag === "LI") return `- ${joined}`;
  if (tag === "A") {
    const href = node.getAttribute("href") || "";
    return href && !href.startsWith("#") ? `[${joined}](${href})` : joined;
  }
  return joined;
}

function extractWithDOM() {
  const body = document.body;
  if (!body) return "";
  const text = walkDOM(body, 0);
  return text
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TEXT_LENGTH);
}

function extractPageContent() {
  const meta = {
    url: location.href,
    title: document.title,
    description:
      document.querySelector('meta[name="description"]')?.content || "",
  };

  // Try Readability first
  try {
    if (typeof Readability !== "undefined") {
      const clone = document.cloneNode(true);
      const article = new Readability(clone).parse();
      if (article && article.textContent && article.textContent.length > 100) {
        return {
          ...meta,
          method: "readability",
          siteName: article.siteName || "",
          byline: article.byline || "",
          excerpt: article.excerpt || "",
          content: article.textContent.slice(0, MAX_TEXT_LENGTH),
        };
      }
    }
  } catch (_) {}

  // Fallback to DOM walk
  return {
    ...meta,
    method: "dom",
    content: extractWithDOM(),
  };
}

// Listen for extraction requests from background script
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "extract") {
    sendResponse(extractPageContent());
  }
  return true;
});
