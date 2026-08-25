chrome.runtime.onMessage?.addListener((message) => {
  if (message?.type !== "BRIDGECART_FILL_CART") return;

  const task = message.payload;
  const quantityInput = document.querySelector('input[type="number"], input[name*="quantity"], input[class*="quantity"]');
  if (quantityInput) {
    quantityInput.value = String(task.quantity);
    quantityInput.dispatchEvent(new Event("input", { bubbles: true }));
    quantityInput.dispatchEvent(new Event("change", { bubbles: true }));
  }

  window.postMessage({ type: "BRIDGECART_CART_FILL_ATTEMPTED", payload: task }, "*");
});
