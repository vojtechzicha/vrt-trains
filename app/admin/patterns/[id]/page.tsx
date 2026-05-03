'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OperatingPattern } from '@/types';
import { Card, CardBody } from '@/components/ui';
import { PatternEditor } from '@/components/admin/PatternEditor';

export default function EditPatternPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [pattern, setPattern] = useState<OperatingPattern | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPattern();
  }, [id]);

  async function fetchPattern() {
    try {
      const response = await fetch(`/api/admin/patterns/${id}`);
      if (!response.ok) {
        router.push('/admin/patterns');
        return;
      }
      const data = await response.json();
      setPattern(data);
    } catch (error) {
      console.error('Failed to fetch pattern:', error);
      router.push('/admin/patterns');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(patternData: Omit<OperatingPattern, 'id'>) {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/patterns/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patternData),
      });

      if (!response.ok) {
        throw new Error('Failed to update pattern');
      }

      router.push('/admin/patterns');
    } catch (error) {
      console.error('Failed to update pattern:', error);
      alert('Failed to update pattern');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12">Loading...</div>;
  }

  if (!pattern) {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/patterns" className="text-sm text-blue-600 hover:underline">
          ← Back to Patterns
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Edit Pattern: {pattern.name}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Modify the service pattern settings
        </p>
      </div>

      <Card>
        <CardBody>
          <PatternEditor
            initialPattern={pattern}
            onSave={handleSave}
            onCancel={() => router.push('/admin/patterns')}
            saving={saving}
          />
        </CardBody>
      </Card>
    </div>
  );
}
