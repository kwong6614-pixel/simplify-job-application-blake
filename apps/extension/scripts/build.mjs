import { build, context } from "esbuild";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const root = join(import.meta.dirname, "..");
const dist = join(root, "dist");
const watch = process.argv.includes("--watch");

mkdirSync(dist, { recursive: true });

const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf-8"));
writeFileSync(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2));
cpSync(join(root, "public"), join(dist, "public"), { recursive: true });

const common = {
  bundle: true,
  platform: "browser",
  target: "chrome120",
  sourcemap: true,
  outdir: dist,
  entryPoints: {
    background: join(root, "src/background/service-worker.ts"),
    content: join(root, "src/content/index.ts"),
    popup: join(root, "src/popup/popup.ts"),
  },
};

async function run() {
  if (watch) {
    const ctx = await context(common);
    await ctx.watch();
    console.log("Watching extension...");
    return;
  }

  await build(common);
  console.log("Extension built to dist/");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
