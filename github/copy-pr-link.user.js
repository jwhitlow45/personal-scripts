// ==UserScript==
// @name         GitHub PR Markdown Formatter
// @namespace    Violentmonkey Scripts
// @version      2.0
// @description  Click a pull request's title to copy a Markdown link to it, for pasting into Slack.
// @author       jwhitlow45
// @match        https://github.com/*
// @grant        GM_setClipboard
// @grant        GM_addStyle
// @run-at       document-end
// @downloadURL  https://github.com/jwhitlow45/personal-scripts/raw/refs/heads/main/github/copy-pr-link.user.js
// @updateURL    https://github.com/jwhitlow45/personal-scripts/raw/refs/heads/main/github/copy-pr-link.user.js
// ==/UserScript==

// GitHub replaces the title element whenever it redraws the header: on switching tabs (Conversation
// is a React page, Files changed is not), on renaming the PR, and on in-app navigation. Listeners on the
// document survive all of that, so nothing is attached to the title itself.
const PR_PATH = /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/|$)/;
// Only the main title. The sticky header's title is a scroll-to-top link (inside an h1 on Files
// changed), and commit titles in the timeline also carry .markdown-title.
const PR_TITLE_SELECTOR = 'h1 .markdown-title:not(a)';
const COPIED_ATTRIBUTE = 'data-pr-link-copied';
const COPIED_DURATION_MS = 2000;

// "Copied!" is drawn over the title with CSS so GitHub's text is never rewritten. Rewriting it fought
// React's own updates, and a second click within two seconds saved "Copied!" as the title for good.
GM_addStyle(`
  [${COPIED_ATTRIBUTE}] {
    position: relative;
    visibility: hidden;
  }
  [${COPIED_ATTRIBUTE}]::after {
    content: 'Copied!';
    position: absolute;
    top: 0;
    left: 0;
    visibility: visible;
    white-space: nowrap;
  }
`);

let copiedTimer;

function showCopied(titleElement) {
  clearTimeout(copiedTimer);
  titleElement.setAttribute(COPIED_ATTRIBUTE, '');
  copiedTimer = setTimeout(() => titleElement.removeAttribute(COPIED_ATTRIBUTE), COPIED_DURATION_MS);
}

function copyPrLink(titleElement, pr) {
  const [, owner, repo, number] = pr;
  // textContent, not innerText: innerText is empty while "Copied!" hides the title.
  const title = titleElement.textContent.replace(/\s+/g, ' ').trim();
  // Links the PR itself, never the current tab, comment anchor, or query string.
  const url = `${location.origin}/${owner}/${repo}/pull/${number}`;
  GM_setClipboard(`[${title}](${url})`);
  showCopied(titleElement);
}

document.addEventListener('click', (event) => {
  const pr = location.pathname.match(PR_PATH);
  const titleElement = event.target.closest?.(PR_TITLE_SELECTOR);
  if (pr && titleElement) copyPrLink(titleElement, pr);
}, true);

document.addEventListener('mouseover', (event) => {
  const titleElement = event.target.closest?.(PR_TITLE_SELECTOR);
  if (titleElement && PR_PATH.test(location.pathname)) titleElement.style.cursor = 'pointer';
});
