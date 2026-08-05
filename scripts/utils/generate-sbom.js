// CHALLENGE-2760: generates a CycloneDX-format SBOM from the resolved yarn dependency graph.
//
// Not using `npm sbom` / `@cyclonedx/cyclonedx-npm` here: those tools shell out to `npm ls`
// internally, which fails on this repo because `yarn.lock` + the `resolutions` field (used to
// safe-patch several transitive advisories, see docs/SECURITY_ADVISORIES_CHALLENGE-2760.md)
// resolve versions npm's own dependency-tree validator flags as "invalid" (e.g. lodash/bn.js
// resolved above what some parent's package.json declares) even though the actual installed
// tree is exactly what yarn intentionally resolved. Parsing `yarn list --json` directly (the
// same data yarn itself uses) sidesteps that npm/yarn resolver mismatch entirely.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const raw = execSync('yarn list --json --ignore-engines', { maxBuffer: 1024 * 1024 * 64 }).toString();
const parsed = JSON.parse(raw);

const components = new Map();
for (const t of parsed.data.trees) {
  const nameVersion = t.name;
  const atIdx = nameVersion.lastIndexOf('@');
  const pkgName = nameVersion.slice(0, atIdx);
  const version = nameVersion.slice(atIdx + 1);
  const key = `${pkgName}@${version}`;
  if (components.has(key)) continue;
  const purlName = pkgName.startsWith('@') ? pkgName.replace('@', '%40') : pkgName;
  components.set(key, {
    type: 'library',
    'bom-ref': key,
    name: pkgName,
    version,
    purl: `pkg:npm/${purlName}@${version}`,
  });
}

const pkgJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));

const sbom = {
  bomFormat: 'CycloneDX',
  specVersion: '1.5',
  serialNumber: `urn:uuid:${crypto.randomUUID()}`,
  version: 1,
  metadata: {
    timestamp: new Date().toISOString(),
    component: { type: 'application', name: pkgJson.name, version: pkgJson.version },
    tools: [{ vendor: 'internal', name: 'generate-sbom.js (CHALLENGE-2760)', version: '1.0.0' }],
  },
  components: Array.from(components.values()).sort((a, b) =>
    a.name === b.name ? a.version.localeCompare(b.version) : a.name.localeCompare(b.name)
  ),
};

const outPath = path.join(__dirname, '../../docs/sbom.cyclonedx.json');
fs.writeFileSync(outPath, JSON.stringify(sbom, null, 2));
console.log(`Wrote ${sbom.components.length} components to ${outPath}`);
