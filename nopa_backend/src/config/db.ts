import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Enable WAL journal mode for SQLite to prevent database locks
prisma.$queryRawUnsafe('PRAGMA journal_mode=WAL;')
  .then(() => console.log('SQLite WAL mode enabled'))
  .catch(err => console.error('Failed to enable WAL mode', err));

// Soft delete global middleware
prisma.$use(async (params, next) => {
  const softDeleteModels = ['User', 'Caravan', 'ClassSession'];
  
  if (softDeleteModels.includes(params.model || '')) {
    // Exclude soft-deleted records by default for read queries
    if (
      params.action === 'findUnique' ||
      params.action === 'findFirst' ||
      params.action === 'findMany' ||
      params.action === 'count'
    ) {
      if (!params.args) {
        params.args = {};
      }
      if (!params.args.where) {
        params.args.where = {};
      }
      
      // If isDeleted is not explicitly requested, default to false
      if (params.args.where.isDeleted === undefined) {
        params.args.where.isDeleted = false;
      }
      
      // Convert findUnique to findFirst to avoid unique-fields schema validation errors
      if (params.action === 'findUnique') {
        params.action = 'findFirst';
      }
    }
    
    // Intercept delete actions to perform a soft delete instead
    if (params.action === 'delete') {
      params.action = 'update';
      if (!params.args) params.args = {};
      if (!params.args.data) params.args.data = {};
      params.args.data = {
        isDeleted: true,
        deletedAt: new Date()
      };
    }
    
    if (params.action === 'deleteMany') {
      params.action = 'updateMany';
      if (!params.args) params.args = {};
      if (!params.args.data) params.args.data = {};
      params.args.data = {
        isDeleted: true,
        deletedAt: new Date()
      };
    }
  }
  
  return next(params);
});

export default prisma;
