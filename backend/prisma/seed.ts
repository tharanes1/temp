import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // FAQs — would otherwise live in i18n bundles. Spec §5.11 moves them server-side.
  const faqs = [
    { category: 'orders', question: 'How are orders assigned to me?', answer: 'Orders are assigned based on your distance from the hub, your rating, and your acceptance history.', order: 1 },
    { category: 'orders', question: 'What if I miss accepting an order in 45s?', answer: 'The order is offered to the next available rider. Repeated misses lower your priority temporarily.', order: 2 },
    { category: 'payment', question: 'When do I get paid?', answer: 'Earnings are settled every Monday by 10 AM to your primary bank account.', order: 1 },
    { category: 'payment', question: 'How do I withdraw cash-in-hand?', answer: 'Use the Cash-in-Hand screen to deposit at a partner bank or transfer via UPI to your wallet.', order: 2 },
    { category: 'account', question: 'How do I change my phone number?', answer: 'Contact support — phone changes require KYC re-verification.', order: 1 },
    { category: 'safety', question: 'What does the SOS button do?', answer: 'It alerts our 24/7 ops team with your live location and contacts emergency services if needed.', order: 1 },
  ];

  for (const f of faqs) {
    await prisma.faqEntry.upsert({
      where: { id: `${f.category}-${f.order}` },
      create: { id: `${f.category}-${f.order}`, ...f, isActive: true },
      update: { ...f, isActive: true },
    });
  }

  console.warn(`Seeded ${faqs.length} FAQ entries.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
