const express = require("express");
const prisma = require("../db");
const { authenticate } = require("../middleware/auth");
const { parseLatitude, parseLongitude } = require("../utils/geo");
const { mapOnlineOrder, mapUserAddress, normalizeOptionalText, toBoolean } = require("../utils/onlineOrder");

const router = express.Router();

function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data
  });
}

function sendError(res, message, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    message
  });
}

function normalizeText(value) {
  return String(value || "").trim();
}

async function resolveCustomer(req, res) {
  const customerId = normalizeText(req.auth?.customerId || req.auth?.userId);
  if (!customerId) {
    sendError(res, "Customer login required.", 401);
    return null;
  }

  const customer = await prisma.customer.findUnique({
    where: {
      id: customerId
    }
  });

  if (!customer) {
    sendError(res, "Customer login required.", 401);
    return null;
  }

  return customer;
}

function validateAddressBody(body, options = {}) {
  const isPatch = Boolean(options.isPatch);
  const hasField = (field) => Object.prototype.hasOwnProperty.call(body || {}, field);

  const title = hasField("title") ? normalizeOptionalText(body.title) : undefined;
  const receiverName = hasField("receiverName") ? normalizeOptionalText(body.receiverName) : undefined;
  const phone = hasField("phone") ? normalizeOptionalText(body.phone) : undefined;
  const addressText = hasField("addressText") ? normalizeOptionalText(body.addressText) : undefined;

  if (!isPatch || hasField("title")) {
    if (!title) {
      return { error: "title is required." };
    }
  }

  if (!isPatch || hasField("receiverName")) {
    if (!receiverName) {
      return { error: "receiverName is required." };
    }
  }

  if (!isPatch || hasField("phone")) {
    if (!phone) {
      return { error: "phone is required." };
    }
  }

  if (!isPatch || hasField("addressText")) {
    if (!addressText) {
      return { error: "addressText is required." };
    }
  }

  return {
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(receiverName !== undefined ? { receiverName } : {}),
      ...(phone !== undefined ? { phone } : {}),
      ...(addressText !== undefined ? { addressText } : {}),
      ...(hasField("city") ? { city: normalizeOptionalText(body.city) } : {}),
      ...(hasField("district") ? { district: normalizeOptionalText(body.district) } : {}),
      ...(hasField("neighborhood") ? { neighborhood: normalizeOptionalText(body.neighborhood) } : {}),
      ...(hasField("buildingNo") ? { buildingNo: normalizeOptionalText(body.buildingNo) } : {}),
      ...(hasField("floor") ? { floor: normalizeOptionalText(body.floor) } : {}),
      ...(hasField("apartmentNo") ? { apartmentNo: normalizeOptionalText(body.apartmentNo) } : {}),
      ...(hasField("doorNo") ? { doorNo: normalizeOptionalText(body.doorNo) } : {}),
      ...(hasField("note") ? { note: normalizeOptionalText(body.note) } : {}),
      ...(hasField("isDefault") ? { isDefault: toBoolean(body.isDefault, false) } : {}),
      ...(hasField("latitude") ? { latitude: parseLatitude(body.latitude) } : {}),
      ...(hasField("longitude") ? { longitude: parseLongitude(body.longitude) } : {})
    }
  };
}

router.use(authenticate);

router.get("/addresses", async (req, res) => {
  try {
    const customer = await resolveCustomer(req, res);
    if (!customer) {
      return;
    }

    const addresses = await prisma.userAddress.findMany({
      where: {
        userId: customer.id
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }]
    });

    return sendSuccess(res, {
      addresses: addresses.map(mapUserAddress)
    });
  } catch (error) {
    console.error("GET /api/me/addresses failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.post("/addresses", async (req, res) => {
  try {
    const customer = await resolveCustomer(req, res);
    if (!customer) {
      return;
    }

    const { data, error } = validateAddressBody(req.body || {});
    if (error) {
      return sendError(res, error, 400);
    }

    const createdAddress = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.userAddress.updateMany({
          where: {
            userId: customer.id,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        });
      }

      const addressCount = await tx.userAddress.count({
        where: {
          userId: customer.id
        }
      });

      return tx.userAddress.create({
        data: {
          userId: customer.id,
          ...data,
          isDefault: data.isDefault || addressCount === 0
        }
      });
    });

    return sendSuccess(
      res,
      {
        address: mapUserAddress(createdAddress)
      },
      201
    );
  } catch (error) {
    console.error("POST /api/me/addresses failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.put("/addresses/:id", async (req, res) => {
  try {
    const customer = await resolveCustomer(req, res);
    if (!customer) {
      return;
    }

    const addressId = normalizeText(req.params.id);
    if (!addressId) {
      return sendError(res, "Address id is required.", 400);
    }

    const existingAddress = await prisma.userAddress.findFirst({
      where: {
        id: addressId,
        userId: customer.id
      }
    });

    if (!existingAddress) {
      return sendError(res, "Address not found.", 404);
    }

    const { data, error } = validateAddressBody(req.body || {}, { isPatch: true });
    if (error) {
      return sendError(res, error, 400);
    }

    if (Object.keys(data).length === 0) {
      return sendError(res, "No valid fields provided.", 400);
    }

    const updatedAddress = await prisma.$transaction(async (tx) => {
      if (data.isDefault) {
        await tx.userAddress.updateMany({
          where: {
            userId: customer.id,
            isDefault: true
          },
          data: {
            isDefault: false
          }
        });
      }

      return tx.userAddress.update({
        where: {
          id: existingAddress.id
        },
        data
      });
    });

    return sendSuccess(res, {
      address: mapUserAddress(updatedAddress)
    });
  } catch (error) {
    console.error("PUT /api/me/addresses/:id failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.delete("/addresses/:id", async (req, res) => {
  try {
    const customer = await resolveCustomer(req, res);
    if (!customer) {
      return;
    }

    const addressId = normalizeText(req.params.id);
    if (!addressId) {
      return sendError(res, "Address id is required.", 400);
    }

    const existingAddress = await prisma.userAddress.findFirst({
      where: {
        id: addressId,
        userId: customer.id
      }
    });

    if (!existingAddress) {
      return sendError(res, "Address not found.", 404);
    }

    await prisma.$transaction(async (tx) => {
      await tx.userAddress.delete({
        where: {
          id: existingAddress.id
        }
      });

      if (existingAddress.isDefault) {
        const fallbackAddress = await tx.userAddress.findFirst({
          where: {
            userId: customer.id
          },
          orderBy: [{ createdAt: "desc" }]
        });

        if (fallbackAddress) {
          await tx.userAddress.update({
            where: {
              id: fallbackAddress.id
            },
            data: {
              isDefault: true
            }
          });
        }
      }
    });

    return sendSuccess(res, {
      id: existingAddress.id
    });
  } catch (error) {
    console.error("DELETE /api/me/addresses/:id failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

router.get("/orders", async (req, res) => {
  try {
    const customer = await resolveCustomer(req, res);
    if (!customer) {
      return;
    }

    const orders = await prisma.order.findMany({
      where: {
        source: "ONLINE",
        OR: [{ customerId: customer.id }, { customerUserId: customer.id }]
      },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true
          }
        },
        items: true
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return sendSuccess(res, {
      orders: orders.map(mapOnlineOrder)
    });
  } catch (error) {
    console.error("GET /api/me/orders failed:", error);
    return sendError(res, "Internal server error.", 500);
  }
});

module.exports = router;
