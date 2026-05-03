import { getLines, getVariants } from '@/lib/data';
import { LineCard } from '@/components/lines';

export default async function LinesPage() {
  const [lines, variants] = await Promise.all([getLines(), getVariants()]);

  // Calculate actual variant counts from variants.json
  const variantCounts = new Map<string, number>();
  for (const variant of variants) {
    variantCounts.set(variant.lineId, (variantCounts.get(variant.lineId) || 0) + 1);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Train Lines</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lines.map((line) => (
          <LineCard key={line.id} line={line} variantCount={variantCounts.get(line.id) || 0} />
        ))}
      </div>
    </div>
  );
}
