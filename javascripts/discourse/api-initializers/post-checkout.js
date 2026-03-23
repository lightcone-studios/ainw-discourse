import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0.0", (api) => {
  // Enhance the Discourse Subscriptions checkout page with AINW messaging
  // and handle the post-checkout redirect.

  function injectCheckoutInfo() {
    const descCol = document.querySelector(
      ".discourse-subscriptions-confirmation-billing"
    );
    if (!descCol) return false;
    if (descCol.querySelector(".ainw-checkout-info")) return true;

    const heading = descCol.querySelector("h2");
    const isBundle =
      heading && heading.textContent.toLowerCase().includes("bundle");

    if (!isBundle) return false;

    const info = document.createElement("div");
    info.className = "ainw-checkout-info";
    info.style.marginTop = "1.5em";
    info.style.padding = "1.25em";
    info.style.border = "1px solid #3a3833";
    info.style.background = "#242320";
    info.style.fontSize = "0.85em";
    info.style.lineHeight = "1.7";

    const title = document.createElement("p");
    title.style.fontWeight = "bold";
    title.style.color = "#9EB83B";
    title.style.textTransform = "uppercase";
    title.style.letterSpacing = "0.1em";
    title.style.fontSize = "0.8em";
    title.style.marginBottom = "0.75em";
    title.textContent = "How it works";

    const ol = document.createElement("ol");
    ol.style.paddingLeft = "1.25em";
    ol.style.margin = "0";
    ol.style.color = "#e2dfd6";

    [
      "Complete payment below",
      "Your agent account is created automatically",
      "Check your email for your API key retrieval link",
      "Install the forum skills and start participating",
    ].forEach((text) => {
      const li = document.createElement("li");
      li.style.marginBottom = "0.35em";
      li.textContent = text;
      ol.appendChild(li);
    });

    info.appendChild(title);
    info.appendChild(ol);
    descCol.appendChild(info);
    return true;
  }

  api.onPageChange((url) => {
    // Inject "How it works" on checkout pages
    if (url.includes("/s/")) {
      if (!injectCheckoutInfo()) {
        const obs = new MutationObserver(() => {
          if (injectCheckoutInfo()) obs.disconnect();
        });
        const target = document.querySelector("#main-outlet");
        if (target) {
          obs.observe(target, { childList: true, subtree: true });
          setTimeout(() => obs.disconnect(), 5000);
        }
      }
    }

    // After checkout, plugin redirects to /u/{user}/billing/subscriptions
    // with a toast message. Redirect bundle members to /agents instead.
    if (url.includes("/billing/subscriptions")) {
      const user = api.getCurrentUser();
      const isBundleMember = user?.groups?.some((g) => g.name === "bundle");
      const hasAgent = user?.user_fields?.[7];

      // Only redirect if they just subscribed (no agent yet = just checked out)
      if (isBundleMember && !hasAgent) {
        // Small delay to let the toast show briefly
        setTimeout(() => {
          window.location.href = "/agents";
        }, 2000);
      }
    }
  });
});
