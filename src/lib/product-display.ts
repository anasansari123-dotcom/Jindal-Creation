/** Full label e.g. "Shuper Heavy 1100" */
export function formatProductDisplay(name: string, productId: string): string {
  const n = name.trim();
  const id = productId.trim();
  if (!id) return n;
  if (!n) return id;
  return `${n} ${id}`;
}

/** Dropdown / search label when category disambiguation helps */
export function formatProductOptionLabel(product: {
  name: string;
  productId: string;
  category?: string;
}): string {
  const base = formatProductDisplay(product.name, product.productId);
  const category = product.category?.trim();
  return category ? `${base} · ${category}` : base;
}

export const PRODUCT_NAME_DUPLICATE_MESSAGE =
  "Ye product name pehle se use ho raha hai. Har product ka alag naam hona chahiye.";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Case-insensitive duplicate check for product name */
export function productNameDuplicateQuery(name: string, excludeId?: string) {
  const trimmed = name.trim();
  const query: Record<string, unknown> = {
    name: { $regex: new RegExp(`^${escapeRegex(trimmed)}$`, "i") },
  };
  if (excludeId) query._id = { $ne: excludeId };
  return query;
}

export function sortProductsForCatalog<
  T extends { category: string; productId: string; name: string },
>(products: T[]): T[] {
  return [...products].sort((a, b) => {
    const byCategory = a.category.localeCompare(b.category);
    if (byCategory !== 0) return byCategory;
    const byNumber = a.productId.localeCompare(b.productId, undefined, {
      numeric: true,
    });
    if (byNumber !== 0) return byNumber;
    return a.name.localeCompare(b.name);
  });
}

export function groupProductsByCategory<
  T extends { category: string; productId: string; name: string },
>(products: T[]): { category: string; products: T[] }[] {
  const sorted = sortProductsForCatalog(products);
  const groups: { category: string; products: T[] }[] = [];
  for (const product of sorted) {
    const last = groups[groups.length - 1];
    if (last?.category === product.category) {
      last.products.push(product);
    } else {
      groups.push({ category: product.category, products: [product] });
    }
  }
  return groups;
}
