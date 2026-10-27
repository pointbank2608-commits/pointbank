// Compatibility entry for the current two-step preparation and explicit start regression.
if(process.env.GUIDE_SKIP_SAMPLES)process.env.UX_FOCUS='1';
await import('./check-prelaunch-ux.mjs');
