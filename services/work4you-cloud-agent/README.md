# Work4You Cloud runtime (golden image)

Bootstrap HTTP surface deployed as Fly app `work4you-cloud-runtime`.

Per-tenant Cloud VMs (`w4y-agent-*`) are created by the Portal NAS
(`work4you-account-service`) via the Fly Machines API and pull this image
(`WORK4YOU_AGENT_IMAGE`).

This is **not** the legacy Wayne / `provisioner-w4y` stack.

```bash
fly deploy -a work4you-cloud-runtime --remote-only
```

After deploy, update Vercel `WORK4YOU_AGENT_IMAGE` to the new
`registry.fly.io/work4you-cloud-runtime:deployment-…` tag.
