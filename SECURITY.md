# Security

Report suspected vulnerabilities privately through GitHub's security advisory
reporting for this repository. Do not put tokens, private project content or
account exports in public issues. For ordinary bugs, use synthetic reproduction
steps and redact identifiers that are not needed.

The client uses the official service, explicit browser consent, bounded grants
and private credential files. Revocation is separate from uninstalling npm or a
plugin. The beta uses development admission; package installation grants nothing.

Public changes are checked against a file allowlist and credential/private-path
patterns, then reviewed before publishing. Automated scans supplement review;
they cannot guarantee that arbitrary new content is safe to disclose.
