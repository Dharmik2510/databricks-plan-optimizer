import React, { useEffect, useState } from 'react';
import { CheckCircle2, Cloud, KeyRound, Loader2, PlugZap, RefreshCw, ShieldAlert, TestTube2 } from 'lucide-react';
import { AdminPageHeader } from '../shared/AdminPageHeader';
import { AdminCard } from '../shared/AdminCard';
import { orgConnectionsApi, OrgConnection } from '../../../api/orgConnections';
import { Button } from '../../../design-system/components';

const OrgConnectionsPage: React.FC = () => {
  const [connections, setConnections] = useState<OrgConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    mcpServerUrl: '',
    shsBaseUrl: '',
    authScheme: 'bearer' as OrgConnection['authScheme'],
    authToken: '',
    authHeaderName: '',
  });

  const loadConnections = async () => {
    setLoading(true);
    try {
      const data = await orgConnectionsApi.list();
      setConnections(data || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load connections');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      const created = await orgConnectionsApi.create({
        mcpServerUrl: form.mcpServerUrl,
        shsBaseUrl: form.shsBaseUrl || undefined,
        authScheme: form.authScheme,
        authToken: form.authScheme === 'none' ? undefined : form.authToken,
        authHeaderName: form.authScheme === 'header' ? form.authHeaderName : undefined,
      });
      setConnections((prev) => [created, ...prev]);
      setForm((prev) => ({ ...prev, authToken: '' }));
    } catch (err: any) {
      setError(err?.message || 'Failed to create connection');
    } finally {
      setSaving(false);
    }
  };

  const handleValidate = async (id: string) => {
    setValidatingId(id);
    setError(null);
    try {
      const updated = await orgConnectionsApi.validate(id);
      setConnections((prev) => prev.map((item) => (item.id === id ? updated : item)));
    } catch (err: any) {
      setError(err?.message || 'Validation failed');
    } finally {
      setValidatingId(null);
    }
  };

  const toggleActive = async (connection: OrgConnection) => {
    try {
      const updated = await orgConnectionsApi.update(connection.id, { isActive: !connection.isActive });
      setConnections((prev) => prev.map((item) => (item.id === connection.id ? updated : item)));
    } catch (err: any) {
      setError(err?.message || 'Failed to update connection');
    }
  };

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Spark History (MCP) Connections"
        description="Securely connect your org to Spark History Server via MCP. Tokens are encrypted with envelope encryption."
        icon={PlugZap}
      />

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <AdminCard className="space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Cloud className="h-4 w-4" /> Connect Spark History MCP
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <input
            value={form.mcpServerUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, mcpServerUrl: e.target.value }))}
            placeholder="MCP Server URL"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium"
          />
          <input
            value={form.shsBaseUrl}
            onChange={(e) => setForm((prev) => ({ ...prev, shsBaseUrl: e.target.value }))}
            placeholder="Spark History Server URL (optional)"
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium"
          />
          <select
            value={form.authScheme}
            onChange={(e) => setForm((prev) => ({ ...prev, authScheme: e.target.value as OrgConnection['authScheme'] }))}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
          >
            <option value="none">No Auth</option>
            <option value="bearer">Bearer</option>
            <option value="basic">Basic</option>
            <option value="header">Custom Header</option>
          </select>
          {form.authScheme === 'header' && (
            <input
              value={form.authHeaderName}
              onChange={(e) => setForm((prev) => ({ ...prev, authHeaderName: e.target.value }))}
              placeholder="Header Name (e.g. X-MCP-Auth)"
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium"
            />
          )}
          {form.authScheme !== 'none' && (
            <div className="relative md:col-span-2">
              <KeyRound className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={form.authToken}
                onChange={(e) => setForm((prev) => ({ ...prev, authToken: e.target.value }))}
                placeholder="Access token"
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-medium"
              />
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleCreate}
            disabled={saving || !form.mcpServerUrl}
            leftIcon={saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
          >
            Save Connection
          </Button>
          <Button variant="outline" onClick={loadConnections} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        </div>
      </AdminCard>

      <AdminCard>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Active Connections</h3>
            <p className="text-xs text-slate-500">Manage validated MCP endpoints</p>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {loading && <div className="text-sm text-slate-500">Loading connections…</div>}
          {!loading && connections.length === 0 && (
            <div className="text-sm text-slate-500">No connections configured.</div>
          )}
          {connections.map((connection) => (
            <div key={connection.id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{connection.mcpServerUrl}</div>
                  <div className="text-xs text-slate-500">Auth: {connection.authScheme}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={connection.isActive ? 'primary' : 'outline'}
                    onClick={() => toggleActive(connection)}
                  >
                    {connection.isActive ? 'Active' : 'Inactive'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleValidate(connection.id)}
                    leftIcon={validatingId === connection.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
                  >
                    Validate
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                {connection.validationError ? (
                  <>
                    <ShieldAlert className="h-4 w-4 text-rose-500" /> {connection.validationError}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {connection.lastValidatedAt ? `Validated ${new Date(connection.lastValidatedAt).toLocaleString()}` : 'Not validated yet'}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
};

export default OrgConnectionsPage;
