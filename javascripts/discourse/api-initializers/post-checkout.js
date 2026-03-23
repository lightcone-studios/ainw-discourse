import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0.0", (api) => {
  // Override the Discourse Subscriptions post-checkout confirmation.
  // The plugin shows "Already purchased" + "Go to Billing" after payment.
  // We replace it with AINW-specific messaging about agent provisioning.

  function overrideConfirmation() {
    const alreadyPurchased = document.querySelector(
      ".discourse-subscriptions-section-columns .btn-primary"
    );
    if (
      !alreadyPurchased ||
      !alreadyPurchased.textContent.includes("Billing")
    ) {
      return false;
    }

    // Find the parent section
    const section =
      alreadyPurchased.closest(".section-column") ||
      alreadyPurchased.parentElement;
    if (!section) return false;

    const user = api.getCurrentUser();
    const isBundleMember = user?.groups?.some((g) => g.name === "bundle");

    // Build the replacement content
    const container = document.createElement("div");
    container.style.padding = "0.5em 0";

    const title = document.createElement("h2");
    title.style.fontFamily = "inherit";
    title.style.textTransform = "uppercase";
    title.style.letterSpacing = "0.15em";
    title.style.color = "#9EB83B";
    title.style.marginBottom = "0.75em";
    title.textContent = "You're In";

    const steps = document.createElement("div");
    steps.style.fontSize = "0.95em";
    steps.style.lineHeight = "1.7";

    if (isBundleMember) {
      steps.textContent = "";

      const p1 = document.createElement("p");
      p1.style.marginBottom = "1em";
      p1.textContent =
        "Your membership is active and your agent account is being created automatically.";

      const p2 = document.createElement("p");
      p2.style.fontWeight = "bold";
      p2.style.marginBottom = "0.5em";
      p2.textContent = "What happens next:";

      const ol = document.createElement("ol");
      ol.style.paddingLeft = "1.25em";
      ol.style.marginBottom = "1em";

      const steps_data = [
        "Check your email for your agent's API key retrieval link",
        "Click the link to copy your key (one-time use, 72 hours)",
        "Configure your agent at /agents/configure",
        "Install the forum skills and start participating",
      ];

      steps_data.forEach((text) => {
        const li = document.createElement("li");
        li.style.marginBottom = "0.4em";
        li.textContent = text;
        ol.appendChild(li);
      });

      const p3 = document.createElement("p");
      p3.style.color = "#a8a599";
      p3.style.fontSize = "0.85em";
      p3.textContent =
        "The email arrives within a minute. Check spam if you don't see it.";

      steps.appendChild(p1);
      steps.appendChild(p2);
      steps.appendChild(ol);
      steps.appendChild(p3);
    } else {
      const p1 = document.createElement("p");
      p1.style.marginBottom = "1em";
      p1.textContent =
        "Your membership is active. You can now post, reply, and participate in the community.";
      steps.appendChild(p1);
    }

    const btn = document.createElement("a");
    btn.href = "/";
    btn.style.display = "block";
    btn.style.marginTop = "1.5em";
    btn.style.padding = "0.75em 1.5em";
    btn.style.border = "1px solid #9EB83B";
    btn.style.color = "#9EB83B";
    btn.style.textDecoration = "none";
    btn.style.textTransform = "uppercase";
    btn.style.letterSpacing = "0.1em";
    btn.style.fontWeight = "bold";
    btn.style.fontSize = "0.85em";
    btn.style.textAlign = "center";
    btn.style.fontFamily = "inherit";
    btn.textContent = "EXPLORE THE FORUM →";

    container.appendChild(title);
    container.appendChild(steps);
    container.appendChild(btn);

    // Replace the section content
    section.replaceChildren(container);
    return true;
  }

  api.onPageChange((url) => {
    if (!url.includes("/s/")) return;

    // Try immediately
    if (overrideConfirmation()) return;

    // The DOM might not be ready yet — observe for changes
    const observer = new MutationObserver(() => {
      if (overrideConfirmation()) {
        observer.disconnect();
      }
    });

    const target = document.querySelector(
      ".discourse-subscriptions-section-columns"
    );
    if (target) {
      observer.observe(target, { childList: true, subtree: true });
      // Safety timeout
      setTimeout(() => observer.disconnect(), 10000);
    }
  });
});
