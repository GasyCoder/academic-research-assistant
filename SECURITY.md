# Security reporting

Do not include keys, manuscripts, private profiles, exploit payloads or personal details in
public issues/PRs. Revoke exposed credentials with the relevant provider; this project does
not provision or rotate them.

## Private reporting status

GitHub Private Vulnerability Reporting is the intended private channel. It is **not active**:
a read-only check on 2026-11-01 returned `enabled: false` for this repository. No private
email address or working alternative is advertised. Activation and verification are an
owner action required before public release; this preparation does not change GitHub settings.

Once the owner has enabled it and verified the form, use **Security → Advisories → Report
a vulnerability** in the repository. Follow
[GitHub's private reporting instructions](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/report-vulnerabilities/privately-report-a-vulnerability).
Until then, do not submit vulnerability details in public. A minimal public issue may ask
the maintainer to establish a private contact, without payloads or sensitive information;
wait for a verified private channel before sending details.

## Owner activation checklist

An owner or repository administrator must:

1. Open repository **Settings → Security and quality → Advanced Security** and enable
   **Private vulnerability reporting**, following the
   [official configuration guide](https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting/configure-for-a-repository).
2. Confirm that the repository's **Security → Advisories** page offers **Report a vulnerability**
   to a potential reporter and that its private form opens. Do not submit a fabricated report.
3. Recheck `GET /repos/GasyCoder/academic-research-assistant/private-vulnerability-reporting`:
   it must return `enabled: true`. Record the verification date and update this status.
4. Assign responsibility for receiving/triaging private reports and decide a maintenance
   policy before publication. Do not invent a response-time commitment.

Changing this document does not activate GitHub reporting. If it cannot be enabled, the
owner must establish and verify another private channel before release, without publishing
a personal email unless explicitly authorized.

No response-time/backport commitment exists. Development is on main; historical v0.3.0 is the
latest tag and unreleased additions are not published versions. Older tags are not promised
security maintenance. The next release/maintenance policy needs owner approval.
See [boundaries](docs/privacy-and-security.md) and [release gates](docs/distribution.md#release-gates).
