# Contributing to ZN blocker

Thank you for your interest in contributing.

## Contributor Application

Before opening a pull request, submit a Contributor Application issue in GitHub:

1. Go to Issues.
2. Select Contributor Application.
3. Describe your skills, planned contribution area, and relevant previous work.
4. Wait for maintainer approval.

## Development Setup

1. Fork the repository.
2. Create a feature branch from main.
3. Install dependencies and run local checks:

```bash
npm run build:icons
npm run build:rules
```

4. Load the extension unpacked in Chrome/Edge for manual testing.

## Pull Request Requirements

- Keep each pull request focused on one area.
- Include a clear summary of what changed and why.
- Include test evidence (screenshots, logs, or reproduction steps).
- Update docs when behavior changes.

## Coding Guidelines

- Keep changes small and readable.
- Preserve existing project style.
- Avoid unrelated refactors in feature PRs.
- Prefer deterministic scripts and reproducible output files.

## What Not to Submit

- Features designed to bypass platform access-control enforcement.
- Undocumented changes that alter extension permissions.
- Breaking changes without migration notes.

## Review Process

1. Maintainers validate scope and safety.
2. Maintainers request revisions when needed.
3. Approved PRs are merged to main.
4. Releases are cut from tagged commits only.
