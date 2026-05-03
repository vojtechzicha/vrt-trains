import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getLine, getVariantsByLine, getTimetablesByVariants, getStations, getRoutes } from '@/lib/data';
import { LineBadge, LineTimetable } from '@/components/lines';
import { Card, CardHeader, CardBody, ScrollableContainer } from '@/components/ui';

interface LineDetailPageProps {
  params: Promise<{ lineId: string }>;
}

export default async function LineDetailPage({ params }: LineDetailPageProps) {
  const { lineId } = await params;
  const line = await getLine(lineId);

  if (!line) {
    notFound();
  }

  const variants = await getVariantsByLine(lineId);
  const variantIds = variants.map((v) => v.id);
  const timetables = await getTimetablesByVariants(variantIds);
  const stations = await getStations();
  const routes = await getRoutes();

  // Group variants by direction
  const outboundVariants = variants.filter((v) => v.direction === 'outbound');
  const inboundVariants = variants.filter((v) => v.direction === 'inbound');

  // Get timetables for each direction
  const outboundTimetables = timetables.filter((t) =>
    outboundVariants.some((v) => v.id === t.variantId)
  );
  const inboundTimetables = timetables.filter((t) =>
    inboundVariants.some((v) => v.id === t.variantId)
  );

  // Get terminal stations for display
  const getTerminals = (variantList: typeof variants) => {
    if (variantList.length === 0) return { from: '', to: '' };
    const first = variantList[0];
    const fromStation = stations.find((s) => s.id === first.stations[0]?.stationId);
    const toStation = stations.find((s) => s.id === first.stations[first.stations.length - 1]?.stationId);
    return { from: fromStation?.name || '', to: toStation?.name || '' };
  };

  const outboundTerminals = getTerminals(outboundVariants);
  const inboundTerminals = getTerminals(inboundVariants);

  return (
    <div>
      <div className="mb-6">
        <Link href="/lines" className="text-sm text-blue-600 hover:underline">
          &larr; Back to Lines
        </Link>
      </div>

      <div className="flex items-center gap-4 mb-8">
        <LineBadge
          identifier={line.identifier}
          color={line.color}
          textColor={line.textColor}
          className="text-2xl px-4 py-2"
        />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{line.name}</h1>
          <p className="text-gray-500 dark:text-gray-400 capitalize">{line.type}</p>
        </div>
      </div>

      <div className="space-y-8">
        {outboundVariants.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">
                {outboundTerminals.from} → {outboundTerminals.to}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Variants: {outboundVariants.map((v) => v.code).join(', ')}
              </p>
            </CardHeader>
            <CardBody className="p-0">
              <ScrollableContainer>
                <LineTimetable
                  variants={outboundVariants}
                  timetables={outboundTimetables}
                  stations={stations}
                  routes={routes}
                />
              </ScrollableContainer>
            </CardBody>
          </Card>
        )}

        {inboundVariants.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">
                {inboundTerminals.from} → {inboundTerminals.to}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Variants: {inboundVariants.map((v) => v.code).join(', ')}
              </p>
            </CardHeader>
            <CardBody className="p-0">
              <ScrollableContainer>
                <LineTimetable
                  variants={inboundVariants}
                  timetables={inboundTimetables}
                  stations={stations}
                  routes={routes}
                />
              </ScrollableContainer>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
