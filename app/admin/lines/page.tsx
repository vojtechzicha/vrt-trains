'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Line, LineType } from '@/types';

interface LineWithCount extends Line {
  variantCount: number;
}
import { Card, CardHeader, CardBody, Button, Input, Select, ColorPicker } from '@/components/ui';
import { LineBadge } from '@/components/lines';

const lineTypes: { value: LineType; label: string }[] = [
  { value: 'suburban', label: 'Suburban' },
  { value: 'regional', label: 'Regional' },
  { value: 'intercity', label: 'InterCity' },
  { value: 'express', label: 'Express' },
  { value: 'local', label: 'Local' },
];

function calculateContrastColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

export default function LinesAdminPage() {
  const [lines, setLines] = useState<LineWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#E31E24');
  const [type, setType] = useState<LineType>('suburban');

  useEffect(() => {
    fetchLines();
  }, []);

  async function fetchLines() {
    try {
      const res = await fetch('/api/admin/lines');
      const data = await res.json();
      setLines(data);
    } catch (error) {
      console.error('Failed to fetch lines:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch('/api/admin/lines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          name,
          color,
          textColor: calculateContrastColor(color),
          type,
          variants: [],
        }),
      });

      if (res.ok) {
        await fetchLines();
        resetForm();
        setShowForm(false);
      }
    } catch (error) {
      console.error('Failed to create line:', error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this line and all its variants?')) return;

    try {
      await fetch(`/api/admin/lines/${id}`, { method: 'DELETE' });
      await fetchLines();
    } catch (error) {
      console.error('Failed to delete line:', error);
    }
  }

  function resetForm() {
    setIdentifier('');
    setName('');
    setColor('#E31E24');
    setType('suburban');
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Lines</h1>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Line'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">New Line</h2>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <Input
                  label="Identifier"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="S1"
                  required
                  autoFocus
                />
                <Input
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Airport Express"
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Select
                  label="Type"
                  options={lineTypes}
                  value={type}
                  onChange={(v) => setType(v as LineType)}
                />
                <ColorPicker
                  label="Color"
                  value={color}
                  onChange={setColor}
                />
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500 dark:text-gray-400">Preview:</span>
                <LineBadge
                  identifier={identifier || 'XX'}
                  color={color}
                  textColor={calculateContrastColor(color)}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Line'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lines.map((line) => (
          <Card key={line.id} className="hover:shadow-md transition-shadow">
            <CardBody>
              <div className="flex items-start justify-between mb-3">
                <LineBadge
                  identifier={line.identifier}
                  color={line.color}
                  textColor={line.textColor}
                  className="text-lg px-3 py-1"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">{line.type}</span>
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{line.name}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {line.variantCount} variant{line.variantCount !== 1 ? 's' : ''}
              </p>
              <div className="flex gap-2">
                <Link
                  href={`/admin/lines/${line.id}/variants`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Manage Variants
                </Link>
                <span className="text-gray-300">|</span>
                <Link
                  href={`/admin/lines/${line.id}`}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Edit
                </Link>
                <span className="text-gray-300">|</span>
                <button
                  onClick={() => handleDelete(line.id)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Delete
                </button>
              </div>
            </CardBody>
          </Card>
        ))}
        {lines.length === 0 && (
          <Card className="col-span-full">
            <CardBody className="text-center py-8 text-gray-500 dark:text-gray-400">
              No lines yet. Add your first line above.
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}
