let load_more = document.getElementsByClassName('load-more')[0];
while (load_more != undefined) {
  load_more.click()
  await new Promise(r => setTimeout(r, 1000));
  window.scrollTo(0, document.body.scrollHeight);
  load_more = document.getElementsByClassName('load-more')[0];
}
let coupons = document.getElementsByClassName("grid-coupon-btn");
for (let coupon of coupons) coupon.click();