// BorderoPro — contact form validation + mailto submit (no backend required)
document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#contact-form");
  if (!form) return;

  const status = document.querySelector("#form-status");
  const CONTACT_EMAIL = "borderopro@gmail.com";

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    status.textContent = "";
    status.classList.remove("form-status--error", "form-status--ok");

    const data = new FormData(form);
    const name = (data.get("name") || "").trim();
    const email = (data.get("email") || "").trim();
    const message = (data.get("message") || "").trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!name || !email || !message) {
      status.textContent = "Please fill in your name, email and message.";
      status.classList.add("form-status--error");
      return;
    }
    if (!emailPattern.test(email)) {
      status.textContent = "Please enter a valid email address.";
      status.classList.add("form-status--error");
      return;
    }

    const supportTypes = data.getAll("supportType").join(", ") || "Not specified";

    const bodyLines = [
      `Name: ${name}`,
      `Company: ${data.get("company") || "-"}`,
      `Job Title: ${data.get("jobTitle") || "-"}`,
      `Number of Employees: ${data.get("employees") || "-"}`,
      `Email: ${email}`,
      `Phone: ${data.get("phone") || "-"}`,
      `Support Type: ${supportTypes}`,
      "",
      "Message:",
      message,
    ];

    const subject = encodeURIComponent(`Payroll Check Request — ${name}`);
    const body = encodeURIComponent(bodyLines.join("\n"));
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;

    status.textContent = "Opening your email app to send this request. If nothing opens, email us directly at " + CONTACT_EMAIL + ".";
    status.classList.add("form-status--ok");
  });
});
