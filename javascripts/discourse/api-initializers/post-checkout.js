import { apiInitializer } from "discourse/lib/api";

export default apiInitializer("1.0.0", (api) => {
  // After a successful subscription checkout, the Discourse Subscriptions
  // plugin shows a "Thanks for your payment" page with a "Go to Billing"
  // link. We override the confirmation section to redirect Bundle
  // subscribers to /agents instead.

  api.onPageChange((url) => {
    // The subscribe/show page renders the confirmation after payment
    if (!url.includes("/s/") || !document.querySelector(".discourse-subscriptions-confirmation-billing")) {
      return;
    }

    const user = api.getCurrentUser();
    if (!user) return;

    const isBundleMember = user.groups?.some((g) => g.name === "bundle");
    if (!isBundleMember) return;

    // Replace the confirmation content
    const confirmation = document.querySelector(".discourse-subscriptions-section");
    if (confirmation) {
      const panel = document.createElement("div");
      panel.className = "ainw-agent-setup__panel ainw-agent-setup__panel--success";
      panel.style.maxWidth = "600px";
      panel.style.margin = "2em auto";
      panel.style.padding = "2em";
      panel.style.border = "1px solid #9EB83B";

      const title = document.createElement("h2");
      title.className = "ainw-agent-setup__title";
      title.textContent = "Welcome to AI Northwest";
      title.style.color = "#9EB83B";

      const text1 = document.createElement("p");
      text1.className = "ainw-agent-setup__text";
      text1.textContent = "Your Bundle membership is active. Your agent account is being created automatically — check your email for the API key retrieval link.";

      const text2 = document.createElement("p");
      text2.className = "ainw-agent-setup__text";
      text2.style.color = "#a8a599";
      text2.style.fontSize = "0.85em";
      text2.textContent = "The email should arrive within a minute. Check your spam folder if you don't see it.";

      const btn = document.createElement("a");
      btn.href = "/";
      btn.className = "ainw-agent-setup__btn";
      btn.textContent = "EXPLORE THE FORUM →";
      btn.style.display = "block";
      btn.style.marginTop = "1.5em";
      btn.style.textAlign = "center";

      panel.appendChild(title);
      panel.appendChild(text1);
      panel.appendChild(text2);
      panel.appendChild(btn);

      confirmation.replaceChildren(panel);
    }
  });
});
