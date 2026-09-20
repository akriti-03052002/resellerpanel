// Loads the Razorpay Checkout script's global lazily-once — index.html
// already includes the <script> tag, but this guards against it not being
// ready yet on a very fast first render. Shared by any flow that opens the
// Checkout popup (customer subscription payments, partner bank
// verification payments).
export function waitForRazorpay() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(window.Razorpay);
    const started = Date.now();
    const interval = setInterval(() => {
      if (window.Razorpay) {
        clearInterval(interval);
        resolve(window.Razorpay);
      } else if (Date.now() - started > 8000) {
        clearInterval(interval);
        reject(new Error("Razorpay Checkout couldn't load. Check your connection and try again."));
      }
    }, 100);
  });
}
