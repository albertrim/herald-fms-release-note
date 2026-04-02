import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = [
    { name: "신규 기능", sortOrder: 0 },
    { name: "기능 개선", sortOrder: 1 },
    { name: "UI/UX 변경", sortOrder: 2 },
    { name: "버그 수정", sortOrder: 3 },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }

  console.log("Seed completed: categories created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
