/**
 * Migration script to drop the unique index on evaluationId
 * This is needed because UserEvaluationSession documents don't have a top-level evaluationId field
 * 
 * Run this script once to fix the database schema
 */

require('dotenv').config();
const mongoose = require('mongoose');

async function dropIndex() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('evaluations');

    // Get existing indexes
    console.log('\n📋 Current indexes on evaluations collection:');
    const indexes = await collection.indexes();
    indexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    // Check if the problematic index exists
    const hasEvaluationIdIndex = indexes.some(
      index => index.name === 'evaluationId_1' || JSON.stringify(index.key).includes('evaluationId')
    );

    if (hasEvaluationIdIndex) {
      console.log('\n🔧 Dropping evaluationId_1 index...');
      try {
        await collection.dropIndex('evaluationId_1');
        console.log('✅ Successfully dropped evaluationId_1 index');
      } catch (error) {
        if (error.codeName === 'IndexNotFound') {
          console.log('ℹ️  Index evaluationId_1 does not exist (already dropped)');
        } else {
          throw error;
        }
      }
    } else {
      console.log('\nℹ️  No evaluationId index found (nothing to drop)');
    }

    // Show final indexes
    console.log('\n📋 Final indexes on evaluations collection:');
    const finalIndexes = await collection.indexes();
    finalIndexes.forEach(index => {
      console.log(`  - ${index.name}:`, JSON.stringify(index.key));
    });

    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await mongoose.connection.close();
    console.log('📴 Disconnected from MongoDB');
  }
}

// Run the migration
dropIndex()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Error:', error);
    process.exit(1);
  });
