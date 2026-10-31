# Local research profiles

Put the research profiles of real projects here, e.g. `profiles/local/my-project.yaml`,
starting from [`../default.yaml`](../default.yaml). Everything in this directory except this
README is ignored by Git, so a profile stays on your machine unless you copy it elsewhere.

Validate a profile with:

```bash
npm run validate:profiles -- profiles/local/my-project.yaml
```

Without arguments, `npm run validate:profiles` checks `profiles/default.yaml` and every
`.yaml` or `.yml` file in this directory.
