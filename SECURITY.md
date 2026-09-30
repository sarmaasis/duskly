# Security

Please report vulnerabilities privately. Do not open a public issue for a suspected security problem.

## Supported Versions

Security fixes are handled on `main` until the project starts publishing versioned release branches.

## Reporting

Email `security@duskly.site` with:

- A short description of the issue.
- Steps to reproduce or a proof of concept.
- The affected deployment mode, if known (`selfhost` or Duskly Cloud).
- Any logs or screenshots that do not expose secrets.

We aim to acknowledge reports within 72 hours. We will coordinate disclosure timing with the reporter when a fix is required.

## Scope

Good-faith security research is welcome. Avoid destructive testing, data exfiltration, spam, social engineering, or denial-of-service attempts.

## Secrets

Never send real access tokens, OAuth secrets, `TOKEN_ENCRYPTION_KEY`, `.dev.vars`, Cloudflare tokens, or database dumps in public issues or PRs.
