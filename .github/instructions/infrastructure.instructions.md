---
description: Rules for Terraform and GitHub Actions configuration. Apply when modifying infrastructure or CI/CD workflows.
applyTo: "infrastructure/**/*.tf,.github/workflows/**/*.yml"
---

# Infrastructure & CI/CD

## Terraform Rules

Before ANY change:
```bash
terraform validate    # Syntax check
terraform plan        # Review ALL changes
```

**NEVER `terraform apply` without explicit human approval.** No exceptions.

Rules:
- No unexpected destroys — review `terraform plan` output carefully
- No resource name changes (they cause destroy + recreate)
- Pin `source` versions to semantic versions (not `~>` or branches)
- Sensitive values (API keys, secrets) always use `sensitive = true`

## GitHub Actions Workflows

- **Pin action versions to SHA** — never use `latest` or branch names
  ```yaml
  - uses: actions/checkout@b4ffde65f69c369e473305b5f5cbe3a9f29e0f5a  # v4.1.1
  ```
- Never commit `.dev.vars` or environment files
- All CI workflows must be listed in `.github/workflows/` and documented
- No manual approval steps unless security-critical
