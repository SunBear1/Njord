---
description: Rules for GitHub Actions configuration. Apply when modifying CI/CD workflows.
applyTo: ".github/workflows/**/*.yml"
---

# CI/CD

## GitHub Actions Workflows

- **Pin action versions to SHA** — never use `latest` or branch names
  ```yaml
  - uses: actions/checkout@b4ffde65f69c369e473305b5f5cbe3a9f29e0f5a  # v4.1.1
  ```
- Never commit `.dev.vars` or environment files
- All CI workflows must be listed in `.github/workflows/` and documented
- No manual approval steps unless security-critical
