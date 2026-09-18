/**
 * Lets Markdown refer to organizational facts instead of repeating them:
 *   {{email:general}}  -> a mailto link to that role address
 *   {{phone:office}}   -> a tel link to the office phone
 * Unknown keys throw, so a typo fails the build.
 */
import { settings } from "./snapshot.ts";

const organization = settings.organization;

type Node = { type: string; value?: string; url?: string; children?: Node[] };

const TOKEN = /\{\{(email|phone):([a-z_]+)\}\}/g;

function replacement(kind: string, key: string): Node {
  if (kind === "email") {
    const address = organization.emails[key];
    if (!address) throw new Error(`Unknown email key "${key}" in Markdown`);
    return {
      type: "link",
      url: `mailto:${address}`,
      children: [{ type: "text", value: address }],
    };
  }
  if (key !== "office")
    throw new Error(`Unknown phone key "${key}" in Markdown`);
  const phone = organization.office.phone;
  return {
    type: "link",
    url: `tel:${organization.office.phone_e164}`,
    children: [{ type: "text", value: phone }],
  };
}

function walk(node: Node) {
  if (!node.children) return;
  const next: Node[] = [];
  for (const child of node.children) {
    if (child.type === "text" && child.value && TOKEN.test(child.value)) {
      TOKEN.lastIndex = 0;
      let last = 0;
      for (const m of child.value.matchAll(TOKEN)) {
        if (m.index > last)
          next.push({ type: "text", value: child.value.slice(last, m.index) });
        next.push(replacement(m[1]!, m[2]!));
        last = m.index + m[0].length;
      }
      if (last < child.value.length)
        next.push({ type: "text", value: child.value.slice(last) });
    } else {
      walk(child);
      next.push(child);
    }
  }
  node.children = next;
}

export default function remarkOrg() {
  return (tree: Node) => walk(tree);
}
