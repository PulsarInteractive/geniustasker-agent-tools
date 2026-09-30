# Agent profiles

## Pick an identity without expanding access

The default profile is usable. Use `profiles list` / `tasker_profiles` to see
eligible profiles within this connection. `profiles create --file profile.json`
or `tasker_create_profile` accepts one retained UUID, a name and a narrower grant;
creation does not select it. Reconcile that UUID after an uncertain reply rather
than generating a replacement. Never create profiles to bypass the shared quota.

Use `profiles select --profile ID` / `tasker_select_profile` only when changing
identity matches the task. This rotates the shared context's credentials; it
cannot switch back to a broader profile. Finish or reconcile pending operations
first, since their saved journals remain bound to the original profile. Different
independent terminals should have separate context names, not a silently shared
credential file. After selection read identity and capabilities again.

`profiles restrict --file restriction.json` / `tasker_restrict_profile` needs the
current `profileId`, `expectedRevision`, `name` and narrower/equal `grant` from
identity. It can rename or restrict itself, never raise a human-set ceiling.
After uncertainty reread identity before another edit. A denied selection is not
permission to forge an ID, alter credential files or reconnect without a human.
