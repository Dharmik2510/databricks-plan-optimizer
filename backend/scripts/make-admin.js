/**
 * Make a user an admin
 * Usage: node scripts/make-admin.js <email>
 * Example: node scripts/make-admin.js admin@example.com
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function makeAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.error('❌ Error: Please provide an email address');
    console.log('\nUsage: node scripts/make-admin.js <email>');
    console.log('Example: node scripts/make-admin.js admin@example.com\n');
    process.exit(1);
  }

  try {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!existingUser) {
      console.error(`❌ Error: No user found with email: ${email}`);
      console.log('\nTip: Make sure you have registered an account first!\n');
      process.exit(1);
    }

    console.log('\n📋 Current user info:');
    console.log(`   Name: ${existingUser.name}`);
    console.log(`   Email: ${existingUser.email}`);
    console.log(`   Current Role: ${existingUser.role}`);

    if (existingUser.role === 'ADMIN' || existingUser.role === 'SUPER_ADMIN') {
      console.log('\n✅ User is already an admin!\n');
      process.exit(0);
    }

    // Update user to admin
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { role: 'ADMIN' },
      select: { id: true, email: true, name: true, role: true },
    });

    console.log('\n✅ Successfully promoted to ADMIN!');
    console.log('\n📋 Updated user info:');
    console.log(`   Name: ${updatedUser.name}`);
    console.log(`   Email: ${updatedUser.email}`);
    console.log(`   New Role: ${updatedUser.role}`);
    console.log('\n🎉 You can now access the Admin Panel!');
    console.log('   👉 Log out and log back in to see the Admin Panel in the sidebar\n');

  } catch (error) {
    console.error('❌ Error updating user:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

makeAdmin();
