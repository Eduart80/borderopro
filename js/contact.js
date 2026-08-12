// BorderoPro — contact form: validation, bot defenses, EmailJS send with mailto: fallback.
//
// EmailJS setup required (one-time, in your dashboard at emailjs.com):
//   1. Add an Email Service (e.g. connect borderopro@gmail.com) -> copy its Service ID.
//   2. Create an Email Template. Set "To Email" to borderopro@gmail.com directly
//      (not a variable) and "Reply To" to {{reply_to}}. Use the template variables
//      referenced below (from_name, reply_to, company, job_title, employees, phone,
//      support_type, message) in the template body. Copy the Template ID.
//   3. Account -> General -> copy your Public Key.
//   4. Account -> Security -> restrict allowed origins to borderopro.com and
//      www.borderopro.com so the public key can't be used from elsewhere.
//   5. Fill in the three constants below.
const EMAILJS_PUBLIC_KEY = "J7z2wXEIM-enZxFX8";
const EMAILJS_SERVICE_ID = "service_jhhjuvx";
const EMAILJS_TEMPLATE_ID = "template_xgjl5f8";

const CONTACT_EMAIL = "borderopro@gmail.com";
const MIN_SECONDS_ON_PAGE = 3; // reject submits faster than this — real people can't fill a form that fast
const RESUBMIT_COOLDOWN_MS = 60 * 1000; // 60s between submissions from the same browser
const RATE_LIMIT_KEY = "bp_contact_last_submit";

const FIELD_LIMITS = {
  name: { min: 2, max: 100, required: true },
  company: { max: 100 },
  jobTitle: { max: 100 },
  employees: { max: 20 },
  phone: { max: 30 },
  email: { max: 150, required: true },
  message: { min: 10, max: 2000, required: true },
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-().\s]{6,30}$/;

function sanitize(value) {
  return (value || "")
    .replace(/[\x00-\x1F\x7F]/g, "") // strip control characters
    .replace(/[<>]/g, "") // strip angle brackets (defensive against HTML injection in the email body)
    .trim();
}

function fieldLabel(key) {
  const labels = {
    name: "Name",
    company: "Company",
    jobTitle: "Job Title",
    employees: "Number of Employees",
    phone: "Phone",
    email: "Email",
    message: "Message",
  };
  return labels[key] || key;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.querySelector("#contact-form");
  if (!form) return;

  const status = document.querySelector("#form-status");
  const submitBtn = form.querySelector('button[type="submit"]');
  const formLoadedAt = Date.now();

  const isConfigured =
    typeof emailjs !== "undefined" &&
    !EMAILJS_PUBLIC_KEY.startsWith("YOUR_") &&
    !EMAILJS_SERVICE_ID.startsWith("YOUR_") &&
    !EMAILJS_TEMPLATE_ID.startsWith("YOUR_");

  if (isConfigured) {
    emailjs.init({ publicKey: EMAILJS_PUBLIC_KEY });
  }

  function setStatus(message, kind) {
    status.textContent = message;
    status.classList.remove("form-status--error", "form-status--ok");
    if (kind) status.classList.add(`form-status--${kind}`);
  }

  function mailtoFallback(fields) {
    const bodyLines = [
      `Name: ${fields.name}`,
      `Company: ${fields.company || "-"}`,
      `Job Title: ${fields.jobTitle || "-"}`,
      `Number of Employees: ${fields.employees || "-"}`,
      `Email: ${fields.email}`,
      `Phone: ${fields.phone || "-"}`,
      `Support Type: ${fields.supportType}`,
      "",
      "Message:",
      fields.message,
    ];
    const subject = encodeURIComponent(`Payroll Check Request — ${fields.name}`);
    const body = encodeURIComponent(bodyLines.join("\n"));
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  }

  function secondsSinceCooldown() {
    const last = Number(window.localStorage.getItem(RATE_LIMIT_KEY) || 0);
    return Date.now() - last;
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    setStatus("", null);

    const data = new FormData(form);

    // Honeypot: real visitors never fill this hidden field, bots often do.
    // Time-trap: no real person fills and submits a form this fast.
    const honeypotFilled = (data.get("website") || "").trim() !== "";
    const tooFast = Date.now() - formLoadedAt < MIN_SECONDS_ON_PAGE * 1000;
    if (honeypotFilled || tooFast) {
      // Don't tip off the bot — pretend it worked, send nothing.
      setStatus("Thanks — your request has been sent.", "ok");
      form.reset();
      return;
    }

    // Rate limit: block rapid repeat submissions from the same browser.
    const elapsed = secondsSinceCooldown();
    if (elapsed < RESUBMIT_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RESUBMIT_COOLDOWN_MS - elapsed) / 1000);
      setStatus(`Please wait ${waitSeconds}s before sending another request.`, "error");
      return;
    }

    // Collect + sanitize every field.
    const fields = {};
    for (const key of Object.keys(FIELD_LIMITS)) {
      fields[key] = sanitize(data.get(key));
    }
    fields.supportType = data.getAll("supportType").join(", ") || "Not specified";

    // Required + length validation.
    for (const [key, rules] of Object.entries(FIELD_LIMITS)) {
      const value = fields[key];
      if (rules.required && !value) {
        setStatus(`Please fill in your ${fieldLabel(key).toLowerCase()}.`, "error");
        return;
      }
      if (value && rules.min && value.length < rules.min) {
        setStatus(`${fieldLabel(key)} must be at least ${rules.min} characters.`, "error");
        return;
      }
      if (value && rules.max && value.length > rules.max) {
        setStatus(`${fieldLabel(key)} must be under ${rules.max} characters.`, "error");
        return;
      }
    }
    if (!EMAIL_PATTERN.test(fields.email)) {
      setStatus("Please enter a valid email address.", "error");
      return;
    }
    if (fields.phone && !PHONE_PATTERN.test(fields.phone)) {
      setStatus("Please enter a valid phone number.", "error");
      return;
    }

    window.localStorage.setItem(RATE_LIMIT_KEY, String(Date.now()));

    if (!isConfigured) {
      mailtoFallback(fields);
      setStatus(
        "Opening your email app to send this request. If nothing opens, email us directly at " + CONTACT_EMAIL + ".",
        "ok"
      );
      return;
    }

    const templateParams = {
      from_name: fields.name,
      reply_to: fields.email,
      company: fields.company || "-",
      job_title: fields.jobTitle || "-",
      employees: fields.employees || "-",
      phone: fields.phone || "-",
      support_type: fields.supportType,
      message: fields.message,
      time: new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
    };

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams).then(
      () => {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Request";
        setStatus("Thanks — your request has been sent. We'll be in touch shortly.", "ok");
        form.reset();
      },
      (error) => {
        submitBtn.disabled = false;
        submitBtn.textContent = "Submit Request";
        console.error("EmailJS send failed:", error);
        mailtoFallback(fields);
        setStatus(
          "We couldn't send that automatically, so we've opened your email app instead. If nothing opens, email us directly at " + CONTACT_EMAIL + ".",
          "error"
        );
      }
    );
  });
});
