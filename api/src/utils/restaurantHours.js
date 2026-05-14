function parseTimeMinutes(rawValue) {
  const value = String(rawValue || "").trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}

function normalizeDayOfWeek(rawValue) {
  const day = Number(rawValue);
  if (!Number.isInteger(day) || day < 0 || day > 6) {
    return null;
  }

  return day;
}

function isOpenInSlot(nowMinutes, openMinutes, closeMinutes) {
  if (openMinutes === null || closeMinutes === null) {
    return false;
  }

  if (closeMinutes === openMinutes) {
    return true;
  }

  if (closeMinutes > openMinutes) {
    return nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  }

  return nowMinutes >= openMinutes || nowMinutes < closeMinutes;
}

function hasOvernightTail(nowMinutes, openMinutes, closeMinutes) {
  if (openMinutes === null || closeMinutes === null) {
    return false;
  }

  if (closeMinutes > openMinutes) {
    return false;
  }

  return nowMinutes < closeMinutes;
}

function isRestaurantOpenNow(restaurant, referenceDate = new Date()) {
  const operationalFlag = Boolean(restaurant?.isOpen);
  if (!operationalFlag) {
    return false;
  }

  const openingHours = Array.isArray(restaurant?.openingHours) ? restaurant.openingHours : [];
  if (openingHours.length === 0) {
    return true;
  }

  const now = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  const dayOfWeek = now.getDay();
  const previousDay = (dayOfWeek + 6) % 7;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const todayRules = openingHours.filter((slot) => normalizeDayOfWeek(slot.dayOfWeek) === dayOfWeek);
  const previousDayRules = openingHours.filter((slot) => normalizeDayOfWeek(slot.dayOfWeek) === previousDay);

  for (const slot of todayRules) {
    if (slot.isClosed) {
      continue;
    }

    const openMinutes = parseTimeMinutes(slot.openTime);
    const closeMinutes = parseTimeMinutes(slot.closeTime);
    if (isOpenInSlot(nowMinutes, openMinutes, closeMinutes)) {
      return true;
    }
  }

  for (const slot of previousDayRules) {
    if (slot.isClosed) {
      continue;
    }

    const openMinutes = parseTimeMinutes(slot.openTime);
    const closeMinutes = parseTimeMinutes(slot.closeTime);
    if (hasOvernightTail(nowMinutes, openMinutes, closeMinutes)) {
      return true;
    }
  }

  return false;
}

module.exports = {
  isRestaurantOpenNow,
  normalizeDayOfWeek,
  parseTimeMinutes
};
