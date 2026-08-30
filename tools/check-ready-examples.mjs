import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const sixHours = 6 * 60 * 60 * 1000;
const examples = JSON.parse(await readFile(resolve(root, "data/ready-examples.json"), "utf8")).examples;
const prices = JSON.parse(await readFile(resolve(root, "data/prices/index.json"), "utf8"));
const observed = Date.parse(prices.observedAt ?? "");
if (!examples?.length) throw new Error("Ready-example contract must name at least one candidate.");
for (const example of examples) {
  if (!example.set || !example.productKey || !(example.quantity > 0)) throw new Error("Ready example must name set, product key, and positive quantity.");
  const sealed = JSON.parse(await readFile(resolve(root, `data/sealed/${example.set}.json`), "utf8"));
  const product = sealed.products?.find((item) => item.key === example.productKey);
  if (!product) throw new Error(`Ready example ${example.set}/${example.productKey} is not an exact sealed product.`);
  if (!product.contains?.length && !product.fixed?.length) throw new Error(`Ready example ${example.set}/${example.productKey} has no verified contents.`);
}
const ready = Number.isFinite(observed) && Date.now() - observed <= sixHours;
console.log(ready
  ? `Ready examples pass: ${examples.map((x) => `${x.set}/${x.productKey}`).join(", ")} · observed ${prices.observedAt}`
  : `No ready examples are advertised: snapshot observed ${prices.observedAt} is outside the six-hour window; manual budget fallback only.`);
