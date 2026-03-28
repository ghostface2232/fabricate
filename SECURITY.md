# Security Policy

## Reporting a Vulnerability

Please do not report security issues in public GitHub issues.

If GitHub private vulnerability reporting is enabled for this repository, use that.
Otherwise, contact the maintainer directly through GitHub with enough detail to reproduce the issue.

Include:

- a short description of the problem
- affected area or file if known
- reproduction steps
- screenshots or logs if they help

## Scope

This is a client-side browser tool with no backend, so the most relevant issues are:

- unsafe file handling during export or OPFS operations
- dependency vulnerabilities with real downstream impact
- anything that could lead to arbitrary script execution in the app context

## Response

This is a small project, so there is no guaranteed SLA.
Valid reports will be reviewed and fixed as time permits.