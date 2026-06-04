---
description: Rules for Terraform and GitHub Actions configuration. Apply when modifying CI/CD workflows or Terraform (Epic 99 only — no .tf files exist yet).
applyTo: ".github/workflows/**/*.yml,infrastructure/**/*.tf"
---

# Infrastructure & CI/CD

> **Note:** No `.tf` files exist in the repo today. Terraform is deferred to Epic 99 (production OCI deployment). The Terraform section below applies only when those files are introduced. CI/CD rules in this file apply now.

## Terraform Rules (Epic 99 onward)

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
