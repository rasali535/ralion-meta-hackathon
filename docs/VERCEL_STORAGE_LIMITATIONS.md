# Vercel Serverless Storage Architecture & Constraints

## Executive Summary

When deploying modern Next.js applications to Vercel, serverless function runtimes operate in isolated, ephemeral execution containers (AWS Lambda). A common failure mode during serverless deployments is attempting to write persistent application data or assets directly into the application directory (e.g., `./data`, `./uploads`, or `./.data/creative`).

This document explains:
1. The root architectural cause of filesystem read-only errors on Vercel (`EROFS`).
2. Why writing to the application directory fails and must never be used as a fix.
3. The temporary fallback behavior implemented for ephemeral demo sessions.
4. The production storage architecture used by Ralion OS.

---

## 1. Architectural Constraints on Vercel / AWS Lambda

### Read-Only Root Filesystem (`EROFS`)
Vercel packages Next.js API routes and server actions into containerized serverless functions.
- The root filesystem (`/var/task` or the deployed code directory) is mounted as **strictly read-only**.
- Any attempt by Node.js or native system calls to create directories (`fs.mkdir`), write files (`fs.writeFile`), or mutate files in the deployed directory throws:
  ```
  [Error: EROFS: read-only file system, mkdir '.data/creative'] {
    errno: -30,
    code: 'EROFS',
    syscall: 'mkdir',
    path: '.data/creative'
  }
  ```

### Ephemeral `/tmp` Scratch Space
AWS Lambda provides an ephemeral scratch directory at `/tmp` (typically 512 MB to 10 GB depending on configuration):
- `/tmp` is writable during the lifetime of the warm container.
- **Critical Limitation: Stateless Container Scaling**:
  - Consecutive requests may hit completely different function instances or container nodes in different availability zones.
  - A file written to `/tmp` on Request A is **not visible** to Request B if Request B runs on another container or after a cold-start recycle.
  - Containers are recycled automatically after periods of inactivity (cold boot) or periodic redeployments.

---

## 2. Ralion Meta OS Vercel Adaptation

To ensure demo reliability on Vercel without crashing or attempting prohibited writes to the code root:

1. **Auto-Detection of Serverless Environment**:
   `lib/creative.js` detects serverless hosting (`process.env.VERCEL` or `process.env.AWS_LAMBDA_FUNCTION_NAME`):
   ```javascript
   function resolveStorageDir() {
     if (process.env.CREATIVE_STORAGE_DIR) {
       return process.env.CREATIVE_STORAGE_DIR;
     }
     const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
     if (isServerless) {
       return join(tmpdir(), 'ralion-creative');
     }
     return join(process.cwd(), '.data', 'creative');
   }
   ```
2. **Deterministic & Mock Fallbacks**:
   - For demo evaluations, mock image generation provides deterministic SVG/PNG data URLs and immediate rendering.
   - Capability-signed asset URLs (`/api/creative/asset?id=...&sig=...&exp=...`) dynamically stream the asset or fallback placeholder without relying on disk persistence.
3. **Graceful Handling of Cold Starts**:
   - When an asset cannot be read from ephemeral `/tmp` due to a container swap, the route returns an informative SVG or status rather than throwing an unhandled exception or 500 error.

---

## 3. Production Architecture (Ralion OS Separation)

In production enterprise deployments of Ralion OS (as referenced in `rasali535/alinew`), persistent media storage is completely decoupled from the compute runtime:

```
[ Next.js API / Lambda ]
         │
         ▼
[ Signed Capability URL ]
         │
         ├─────────────────────────────────────────┐
         ▼                                         ▼
[ Object Storage: Cloudflare R2 / AWS S3 / GCS ]   [ PostgreSQL / Supabase DB ]
(Immutable BLOB storage with global CDN)          (Metadata, tenant IDs, hashes, audit log)
```

### Production Guarantees:
- **Tenant Isolation**: S3/R2 keys are prefixed by `org_id/workspace_id/asset_id`.
- **Pre-signed Upload & Download URLs**: Serverless functions never buffer large image binaries in memory or disk; clients upload and fetch directly via CDN pre-signed URLs.
- **Audit Trails & TTLs**: Media lifecycle policies automatically archive or prune ephemeral demo assets.
- **Zero Local Disk Dependency**: Production compute containers remain 100% stateless and horizontally scalable across any cloud or edge provider.
