/**
 * List all users in the database
 * Usage: node scripts/list-users.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (users.length === 0) {
      console.log('\n📭 No users found in the database\n');
      process.exit(0);
    }

    console.log(`\n👥 Found ${users.length} user(s):\n`);
    console.log('━'.repeat(80));

    users.forEach((user, index) => {
      const roleEmoji = user.role === 'SUPER_ADMIN' ? '👑' : user.role === 'ADMIN' ? '🛡️' : '👤';
      const statusEmoji = user.isActive ? '✅' : '❌';

      console.log(`\n${index + 1}. ${roleEmoji} ${user.name}`);
      console.log(`   Email:      ${user.email}`);
      console.log(`   Role:       ${user.role}`);
      console.log(`   Status:     ${statusEmoji} ${user.isActive ? 'Active' : 'Suspended'}`);
      console.log(`   Created:    ${user.createdAt.toLocaleDateString()}`);
      console.log(`   ID:         ${user.id}`);
    });

    console.log('\n' + '━'.repeat(80));
    console.log('\n💡 To make a user admin, run:');
    console.log('   node scripts/make-admin.js <email>\n');

  } catch (error) {
    console.error('❌ Error fetching users:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

listUsers();
