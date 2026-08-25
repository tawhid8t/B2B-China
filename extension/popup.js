const output = document.getElementById("output");
const fetchQueue = document.getElementById("fetchQueue");

fetchQueue.addEventListener("click", async () => {
  const { apiBaseUrl = "http://localhost:3000" } = await chrome.storage.sync.get("apiBaseUrl");
  const response = await fetch(`${apiBaseUrl}/api/extension/purchase-queue`);
  const data = await response.json();
  output.textContent = JSON.stringify(data, null, 2);
});
