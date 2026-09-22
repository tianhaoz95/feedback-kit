# Security Policy

FeedbackKit takes the security of our software, users, and integrating applications seriously. We appreciate the responsible disclosure of security vulnerabilities and are committed to addressing valid findings promptly.

---

## Supported Versions

We actively provide security updates and patches for the following components:

| Component | Supported Version | Notes |
|---|---|---|
| **FeedbackKit SDK** (iOS / macOS / watchOS) | Latest release (`main`) | Distributed via Swift Package Manager |
| **Web Dashboard** | Latest release (`main`) | Hosted static SPA |
| **Supabase Functions & Backend** | Latest migrations / functions | Database schema, RLS, and Deno Edge Functions |
| **`feedbackkit-cli`** | Latest npm release | Published to npm registry |
| **`feedback-kit-skills`** | Latest npm release | Published to npm registry |

If you discover a vulnerability in an older version, please verify whether the issue persists in the latest release before reporting.

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues, pull requests, or discussions.**

Instead, please report security concerns privately using one of the following methods:

### Option 1: GitHub Private Vulnerability Reporting (Recommended)

Submit an advisory draft privately via GitHub:
1. Navigate to the repository's [Security Advisories page](https://github.com/tianhaoz95/feedback-kit/security/advisories).
2. Click **"Report a vulnerability"** to open the advisory form.
3. Fill in the details and submit.

### Option 2: Email

Send an encrypted or private email directly to:

- **Email**: [info@hejitechllc.com](mailto:info@hejitechllc.com)
- **Subject**: `[SECURITY] Vulnerability Report: FeedbackKit`

### Information to Include in Your Report

To help us triage and resolve the issue quickly, please provide as much relevant information as possible:

1. **Affected Component(s)**: Specific SDK platform (iOS, macOS, watchOS), Web Dashboard, Supabase Edge Functions/PostgreSQL RLS, or CLI/MCP server.
2. **Version / Commit**: The version number, git commit hash, or package version where the issue was observed.
3. **Vulnerability Type**: e.g., Row Level Security (RLS) bypass, unauthorized data access, injection vulnerability, authentication/authorization bypass, denial of service, or sensitive data leakage.
4. **Steps to Reproduce**: Detailed step-by-step instructions or minimal proof-of-concept (PoC) code/scripts.
5. **Potential Impact**: Description of how an attacker could exploit the issue and what assets or data would be compromised.
6. **Suggested Remediation**: If you have identified a potential fix, patch, or mitigation, please feel free to share it.

---

## Response Process & Expectations

When you submit a vulnerability report:

1. **Acknowledgment**: We aim to acknowledge receipt of your report within **48 to 72 hours**.
2. **Assessment**: We will investigate and validate the findings, determining severity and impact.
3. **Remediation**: If confirmed, we will prioritize developing and testing a fix in a private branch or advisory fork.
4. **Disclosure & Release**: Once patched, we will release an update across relevant distribution channels (Swift package release, npm packages, or database migrations) and publish an advisory detailing the issue, severity, and resolution.
5. **Credit**: We are happy to publicly acknowledge and credit researchers who report valid vulnerabilities responsibly, unless you request to remain anonymous.

---

## Security Architecture & Best Practices for Integrators

If you are integrating FeedbackKit into your application or self-hosting the backend:

- **Project Keys vs. Service Keys**: The SDK requires a `project_key` to associate feedback submissions with a project. This key is intended to be included in client apps. Never expose your Supabase `SERVICE_ROLE_KEY` or database connection strings in client application bundles or public repositories.
- **Row Level Security (RLS)**: When self-hosting or modifying Supabase schema migrations, ensure all tables retain RLS enabled (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) with policies strictly scoping tenant data.
- **Attachment & Screenshot Storage**: Storage buckets follow strict RLS policies scoping objects to project identifiers. Do not modify storage bucket policies to grant public unauthenticated read/write permissions.
- **Environment Secrets**: Keep API keys, Stripe webhook secrets (`STRIPE_WEBHOOK_SECRET`), and signing keys secure using GitHub Secrets or Supabase Secrets (`supabase secrets set`).
