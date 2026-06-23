import { PrismaClient } from './src/generated/prisma/index.js';
const prisma = new PrismaClient();
async function main() {
  const emp = await prisma.employee.findFirst({ where: { lastName: 'Evangelista' } });
  console.log(emp?.firstName, emp?.lastName, emp?.serviceStartDate, emp?.monthlySalary);
}
main();
