import Link from 'next/link';
import { getStations, getLines, getVariants, getTimetables, getRoutes, getOutOfSyncVariants } from '@/lib/data';
import { Card, CardBody } from '@/components/ui';
import { OutOfSyncWarning } from '@/components/admin/OutOfSyncWarning';

export default async function AdminDashboard() {
  const stations = await getStations();
  const lines = await getLines();
  const variants = await getVariants();
  const timetables = await getTimetables();
  const routes = await getRoutes();
  const outOfSyncVariants = await getOutOfSyncVariants();

  const quickLinks = [
    { href: '/admin/stations', label: 'Manage Stations', icon: '◉', count: stations.length },
    { href: '/admin/routes', label: 'Manage Routes', icon: '⇢', count: routes.length },
    { href: '/admin/lines', label: 'Manage Lines', icon: '━', count: lines.length },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Admin Dashboard</h1>

      {/* Out of sync warning */}
      <OutOfSyncWarning variants={outOfSyncVariants} lines={lines} />

      <div className="grid gap-4 md:grid-cols-5 mb-8">
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-blue-600">{stations.length}</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">Stations</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-cyan-600">{routes.length}</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">Routes</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-green-600">{lines.length}</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">Lines</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-purple-600">{variants.length}</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">Variants</div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-3xl font-bold text-orange-600">{timetables.length}</div>
            <div className="text-gray-500 dark:text-gray-400 text-sm">Timetables</div>
          </CardBody>
        </Card>
      </div>

      <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Quick Actions</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {quickLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardBody className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center text-2xl">
                  {link.icon}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100">{link.label}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{link.count} items</p>
                </div>
              </CardBody>
            </Card>
          </Link>
        ))}

        <Link href="/admin/routes/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-2 border-dashed border-gray-300 dark:border-gray-600">
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-cyan-100 flex items-center justify-center text-2xl">
                +
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">New Route</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Create a new route corridor</p>
              </div>
            </CardBody>
          </Card>
        </Link>

        <Link href="/admin/lines">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-2 border-dashed border-gray-300 dark:border-gray-600">
            <CardBody className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center text-2xl">
                +
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">New Line</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Create a new train line</p>
              </div>
            </CardBody>
          </Card>
        </Link>
      </div>
    </div>
  );
}
