import { getLines } from '@/lib/data';
import { LineCard } from '@/components/lines';

export default async function LinesPage() {
  const lines = await getLines();

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Train Lines</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lines.map((line) => (
          <LineCard key={line.id} line={line} />
        ))}
      </div>
    </div>
  );
}
