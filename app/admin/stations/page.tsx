'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Station, StationType } from '@/types';
import { Card, CardHeader, CardBody, Button, Input, Select, NumberInput } from '@/components/ui';

const stationTypes: { value: StationType; label: string }[] = [
  { value: 'hub', label: 'Hub' },
  { value: 'terminal', label: 'Terminal' },
  { value: 'regular', label: 'Regular' },
  { value: 'airport', label: 'Airport' },
  { value: 'request', label: 'Request Stop' },
];

const countries: { value: string; label: string }[] = [
  { value: 'Czech', label: 'Czech' },
  { value: 'Germany', label: 'Germany' },
  { value: 'Austria', label: 'Austria' },
  { value: 'Poland', label: 'Poland' },
  { value: 'Slovakia', label: 'Slovakia' },
  { value: 'Hungary', label: 'Hungary' },
];

export default function StationsAdminPage() {
  const router = useRouter();
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState<'physical' | 'virtual' | null>(null);
  const [saving, setSaving] = useState(false);

  // Physical station form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<StationType>('regular');
  const [platforms, setPlatforms] = useState(2);
  const [isTerminal, setIsTerminal] = useState(false);
  const [country, setCountry] = useState('Czech');

  // Virtual station form state
  const [virtualCode, setVirtualCode] = useState('');
  const [virtualName, setVirtualName] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberFilter, setMemberFilter] = useState('');

  useEffect(() => {
    fetchStations();
  }, []);

  async function fetchStations() {
    try {
      const res = await fetch('/api/admin/stations');
      const data = await res.json();
      setStations(data);
    } catch (error) {
      console.error('Failed to fetch stations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name, type, platforms, isTerminal, country }),
      });

      if (res.ok) {
        await fetchStations();
        resetForm();
        setShowForm(null);
      }
    } catch (error) {
      console.error('Failed to create station:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleVirtualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedMemberIds.length < 2) {
      alert('Please select at least 2 stations');
      return;
    }
    setSaving(true);

    try {
      const res = await fetch('/api/admin/stations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: virtualCode,
          name: virtualName,
          type: 'hub',
          platforms: 0,
          isTerminal: false,
          isVirtual: true,
          memberStationIds: selectedMemberIds,
        }),
      });

      if (res.ok) {
        await fetchStations();
        resetVirtualForm();
        setShowForm(null);
      }
    } catch (error) {
      console.error('Failed to create virtual station:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this station?')) return;

    try {
      await fetch(`/api/admin/stations/${id}`, { method: 'DELETE' });
      await fetchStations();
    } catch (error) {
      console.error('Failed to delete station:', error);
    }
  }

  function resetForm() {
    setCode('');
    setName('');
    setType('regular');
    setPlatforms(2);
    setIsTerminal(false);
    setCountry('Czech');
  }

  function resetVirtualForm() {
    setVirtualCode('');
    setVirtualName('');
    setSelectedMemberIds([]);
    setMemberFilter('');
  }

  function toggleMemberStation(stationId: string) {
    setSelectedMemberIds((prev) =>
      prev.includes(stationId)
        ? prev.filter((id) => id !== stationId)
        : [...prev, stationId]
    );
  }

  const physicalStations = stations.filter((s) => !s.isVirtual);
  const virtualStations = stations.filter((s) => s.isVirtual);

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stations</h1>
        <div className="flex gap-2">
          <Button
            variant={showForm === 'virtual' ? 'primary' : 'secondary'}
            onClick={() => setShowForm(showForm === 'virtual' ? null : 'virtual')}
          >
            {showForm === 'virtual' ? 'Cancel' : '+ Virtual Station'}
          </Button>
          <Button
            onClick={() => setShowForm(showForm === 'physical' ? null : 'physical')}
          >
            {showForm === 'physical' ? 'Cancel' : '+ Add Station'}
          </Button>
        </div>
      </div>

      {/* Physical Station Form */}
      {showForm === 'physical' && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">New Physical Station</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="PHN"
                  required
                  autoFocus
                />
                <Input
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Praha hlavní nádraží"
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-4">
                <Select
                  label="Type"
                  options={stationTypes}
                  value={type}
                  onChange={(v) => setType(v as StationType)}
                />
                <Select
                  label="Country"
                  options={countries}
                  value={country}
                  onChange={(v) => setCountry(v)}
                />
                <NumberInput
                  label="Platforms"
                  value={platforms}
                  onChange={setPlatforms}
                  min={1}
                  max={50}
                />
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isTerminal}
                      onChange={(e) => setIsTerminal(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">Terminal station</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Station'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Virtual Station Form */}
      {showForm === 'virtual' && (
        <Card className="mb-6 ring-2 ring-amber-200">
          <CardHeader className="bg-amber-50">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>🏙</span>
              New Virtual Station (City Station)
            </h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleVirtualSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Code"
                  value={virtualCode}
                  onChange={(e) => setVirtualCode(e.target.value.toUpperCase())}
                  placeholder="BUD"
                  required
                  autoFocus
                />
                <Input
                  label="Name"
                  value={virtualName}
                  onChange={(e) => setVirtualName(e.target.value)}
                  placeholder="Budapest"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Member Stations (select at least 2)
                </label>
                <input
                  type="text"
                  value={memberFilter}
                  onChange={(e) => setMemberFilter(e.target.value)}
                  placeholder="Filter stations..."
                  className="w-full px-3 py-2 mb-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
                />
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto bg-gray-50">
                  <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                    {physicalStations
                      .filter((station) =>
                        memberFilter === '' ||
                        station.name.toLowerCase().includes(memberFilter.toLowerCase()) ||
                        station.code.toLowerCase().includes(memberFilter.toLowerCase())
                      )
                      .map((station) => (
                      <label
                        key={station.id}
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                          selectedMemberIds.includes(station.id)
                            ? 'bg-amber-100 ring-1 ring-amber-400'
                            : 'bg-white hover:bg-gray-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(station.id)}
                          onChange={() => toggleMemberStation(station.id)}
                          className="w-4 h-4 rounded border-gray-300 text-amber-600"
                        />
                        <span className="text-sm">
                          <span className="font-mono text-gray-500 mr-1">{station.code}</span>
                          {station.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                {selectedMemberIds.length > 0 && (
                  <p className="text-sm text-amber-600 mt-2">
                    {selectedMemberIds.length} station{selectedMemberIds.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving || selectedMemberIds.length < 2}>
                  {saving ? 'Saving...' : 'Create Virtual Station'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Virtual Stations Table */}
      {virtualStations.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="bg-amber-50">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span>🏙</span>
              Virtual Stations
            </h2>
          </CardHeader>
          <CardBody className="p-0">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Member Stations</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {virtualStations.map((station) => (
                  <tr key={station.id} className="hover:bg-amber-50">
                    <td className="px-4 py-3 text-sm font-mono font-medium">{station.code}</td>
                    <td className="px-4 py-3 text-sm">{station.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {station.memberStationIds?.map((id) => {
                        const member = physicalStations.find((s) => s.id === id);
                        return member?.name;
                      }).filter(Boolean).join(', ') || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right">
                      <Link
                        href={`/admin/stations/${station.id}`}
                        className="text-blue-600 hover:underline mr-3"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDelete(station.id)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      )}

      {/* Physical Stations Table */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Physical Stations</h2>
        </CardHeader>
        <CardBody className="p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Platforms</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {physicalStations.map((station) => (
                <tr key={station.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono font-medium">{station.code}</td>
                  <td className="px-4 py-3 text-sm">{station.name}</td>
                  <td className="px-4 py-3 text-sm capitalize">{station.type}</td>
                  <td className="px-4 py-3 text-sm">{station.platforms}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <Link
                      href={`/admin/stations/${station.id}`}
                      className="text-blue-600 hover:underline mr-3"
                    >
                      Edit
                    </Link>
                    <button
                      onClick={() => handleDelete(station.id)}
                      className="text-red-600 hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {physicalStations.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No stations yet. Add your first station above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </div>
  );
}
