function createInventoryRepository({ readRecords } = {}) {
  const safeReadRecords = typeof readRecords === 'function' ? readRecords : async () => [];

  return {
    async getAlertSourceRows(filters = {}) {
      const rows = await safeReadRecords(filters);

      if (!filters.categoryId) {
        return rows;
      }

      return rows.filter((row) => row.categoryId === filters.categoryId);
    }
  };
}

module.exports = {
  createInventoryRepository
};
