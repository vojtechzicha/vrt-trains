'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Line, LineType } from '@/types';
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

export default function EditLinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [color, setColor] = useState('#E31E24');
  const [type, setType] = useState<LineType>('suburban');

  useEffect(() => {
    fetchLine();
  }, [id]);

  async function fetchLine() {
    try {
      const res = await fetch(`/api/admin/lines/${id}`);
      if (!res.ok) {
        router.push('/admin/lines');
        return;
      }
      const line: Line = await res.json();
      setIdentifier(line.identifier);
      setName(line.name);
      setColor(line.color);
      setType(line.type);
    } catch (error) {
      console.error('Failed to fetch line:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`/api/admin/lines/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier,
          name,
          color,
          textColor: calculateContrastColor(color),
          type,
        }),
      });

      if (res.ok) {
        router.push('/admin/lines');
      }
    } catch (error) {
      console.error('Failed to update line:', error);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/lines" className="text-sm text-blue-600 hover:underline">
          ← Back to Lines
        </Link>
      </div>

      <Card>
        <CardHeader>
          <h1 className="text-xl font-bold">Edit Line</h1>
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
              <span className="text-sm text-gray-500">Preview:</span>
              <LineBadge
                identifier={identifier || 'XX'}
                color={color}
                textColor={calculateContrastColor(color)}
              />
            </div>
            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => router.push('/admin/lines')}>
                Cancel
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
