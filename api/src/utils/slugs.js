function slugifyValue(rawValue) {
  const normalized = String(rawValue || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "restaurant";
}

async function ensureUniqueRestaurantSlug(db, rawValue, excludeRestaurantId) {
  const baseSlug = slugifyValue(rawValue);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existingRestaurant = await db.restaurant.findFirst({
      where: {
        slug: candidate,
        ...(excludeRestaurantId
          ? {
              id: {
                not: excludeRestaurantId
              }
            }
          : {})
      },
      select: {
        id: true
      }
    });

    if (!existingRestaurant) {
      return candidate;
    }

    candidate = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

module.exports = {
  slugifyValue,
  ensureUniqueRestaurantSlug
};
