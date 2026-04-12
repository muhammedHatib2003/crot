function normalizeEmployeeRole(employeeRole) {
  return String(employeeRole || "").trim().toLowerCase();
}

async function getEmployeeContext(prisma, userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      employeeRole: true,
      restaurantId: true,
      fullName: true
    }
  });
}

module.exports = {
  getEmployeeContext,
  normalizeEmployeeRole
};
