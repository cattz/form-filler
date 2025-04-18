chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "fill") {
    const identity = message.identity;
    const mappings = message.mappings;

    document.querySelectorAll('input, textarea, select').forEach(el => el.value = '');

    mappings.forEach(mapping => {
      const value = identity[mapping.CampoIdentidad];
      if (value) {
        const input = document.querySelector(`[name='${mapping.CampoFormulario}']`);
        if (input) {
          input.value = value;
        }
      }
    });
  }
});