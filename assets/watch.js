// Set up long-poll.

fetch('/watch').then(async (res) => {
  let bodyText;
  try {
    bodyText = await res.text();
  } catch (err) {
    bodyText = '<failed to read body>';
  }
  if (!res.ok) {
    console.error(`Long-poll failed: HTTP ${res.status}: ${bodyText}`);
    return;
  }
  window.location.reload();
});
