import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const sitesPath = join(root, "sites.json");
const requiredFields = ["title", "slug", "path"];
const errors = [];

if (!existsSync(sitesPath)) {
  errors.push("sites.json is missing.");
} else {
  const sites = JSON.parse(readFileSync(sitesPath, "utf8"));

  if (!Array.isArray(sites)) {
    errors.push("sites.json must contain an array.");
  } else {
    const slugs = new Set();

    sites.forEach((site, index) => {
      for (const field of requiredFields) {
        if (!site[field]) {
          errors.push(`Site ${index + 1} is missing "${field}".`);
        }
      }

      if (site.slug && slugs.has(site.slug)) {
        errors.push(`Duplicate slug: ${site.slug}`);
      }

      slugs.add(site.slug);

      if (site.path && !existsSync(join(root, site.path, "index.html"))) {
        errors.push(`Missing index.html for ${site.title || site.slug}: ${site.path}`);
      }
    });
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("All site entries look good.");
