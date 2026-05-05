/** Counselor soft-archive: documents are purged after this retention from `archivedAt`. */
export const ARCHIVE_RETENTION_DAYS = 20;

export const archivePurgeDateFromNow = () => {
  const d = new Date();
  d.setDate(d.getDate() + ARCHIVE_RETENTION_DAYS);
  return d;
};

/** Mongo fragment: record is not counselor-archived. */
export const notArchivedFilter = () => ({
  $or: [{ archivedAt: null }, { archivedAt: { $exists: false } }],
});

/** Mongo fragment: record is counselor-archived. */
export const isArchivedFilter = () => ({
  archivedAt: { $ne: null },
});
