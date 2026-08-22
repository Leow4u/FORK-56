# Work4You Cloud runtime (golden image)

Full Work4You Docker image deployed as Fly app `work4you-cloud-runtime`.

Per-tenant Cloud VMs (`w4y-agent-*`) are created by the Portal NAS
(`work4you-account-service`) via the Fly Machines API and pull this image
(`WORK4YOU_AGENT_IMAGE`).

This is **not** the legacy Wayne / `provisioner-w4y` stack.

```bash
cd services/work4you-cloud-agent
fly deploy -a work4you-cloud-runtime --remote-only
```

After deploy, update Vercel `WORK4YOU_AGENT_IMAGE` to the new
`registry.fly.io/work4you-cloud-runtime:deployment-…` tag **only if** you
redeployed the golden image. Omit the variable to use the code default pin.

Stub machines use the image CMD (`python server.py`) as-is — do not override
`init.cmd` until the full Work4You container ships.
