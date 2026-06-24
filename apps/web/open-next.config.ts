import { defineCloudflareConfig } from '@opennextjs/cloudflare';

// Minimal config for the preview (default in-memory incremental cache; add r2IncrementalCache
// before production if ISR caching of the portal pages matters).
export default defineCloudflareConfig({});
