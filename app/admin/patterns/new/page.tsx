'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { OperatingPattern } from '@/types';
import { Card, CardHeader, CardBody } from '@/components/ui';
import { PatternEditor } from '@/components/admin/PatternEditor';

export default function NewPatternPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function handleSave(patternData: Omit<OperatingPattern, 'id'>) {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/patterns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patternData),
      });

      if (!response.ok) {
        throw new Error('Failed to create pattern');
      }

      router.push('/admin/patterns');
    } catch (error) {
      console.error('Failed to create pattern:', error);
      alert('Failed to create pattern');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/patterns" className="text-sm text-blue-600 hover:underline">
          ← Back to Patterns
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">New Operating Pattern</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Create a reusable service pattern for timetable generation
        </p>
      </div>

      <Card>
        <CardBody>
          <PatternEditor
            onSave={handleSave}
            onCancel={() => router.push('/admin/patterns')}
            saving={saving}
          />
        </CardBody>
      </Card>
    </div>
  );
}
