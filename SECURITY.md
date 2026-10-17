# Security

The latest public preview is the review target. Older versions may not receive
backported fixes. Updates are manual; this app does not silently replace itself.

Use GitHub's **Security → Report a vulnerability** if private reporting is enabled.
If absent, open an issue requesting a private reporting channel, without exploit
details or personal records. No guaranteed response time or bug bounty is offered.

The app runs on loopback with session-token and host/origin checks. It is intended
for trusted users of a Windows computer and its shared folders, not public-server
hosting. Import files only from sources you trust and keep separate backups.

Review scope is in docs/PUBLIC-RELEASE-REVIEW.md. This is not a comprehensive
security audit or a claim that vulnerabilities are absent.
