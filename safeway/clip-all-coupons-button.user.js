// ==UserScript==
// @name         Safeway Clip All Coupons Button
// @version      0.2
// @description  Add convenient button to automatically load and clip all coupons on Safeway's ForU page
// @author       jwhitlow45
// @match        https://www.safeway.com/foru/coupons-deals.html*
// @icon         data:image/png;base64,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
// @grant        none
// @downloadURL  https://github.com/jwhitlow45/personal-scripts/raw/refs/heads/main/safeway/clip-all-coupons-button.user.js
// @updateURL  https://github.com/jwhitlow45/personal-scripts/raw/refs/heads/main/safeway/clip-all-coupons-button.user.js
// ==/UserScript==

(function () {
  "use strict";

  const couponGridContainer = document.getElementsByClassName(
    "coupon-grid-container",
  )[0];

  let clipButton = document.createElement("button");
  clipButton.addEventListener("click", clipCoupons);
  clipButton.innerHTML = "<span>Clip All Coupons</span>";
  clipButton.classList.add("btn");
  clipButton.classList.add("btn-secondary");
  clipButton.style.width = "175px";

  couponGridContainer.insertBefore(clipButton, couponGridContainer.firstChild);
})();

const buttons_to_click = ["Clip Coupon", "Activate", "Add to List"];

async function clipCoupons() {
  console.log("Clipping coupons...");
  let load_more = document.getElementsByClassName("load-more")[0];
  while (load_more != undefined) {
    load_more.click();
    await new Promise((r) => setTimeout(r, 1000));
    window.scrollTo(0, document.body.scrollHeight);
    load_more = document.getElementsByClassName("load-more")[0];
  }
  const buttons = document.getElementsByTagName("button");
  for (const b of buttons) {
    if (buttons_to_click.includes(b.innerText)) b.click();
  }
  console.log("Finished clipping coupons!");
}
