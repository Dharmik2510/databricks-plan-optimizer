import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Loader2, Server, Shield, X } from 'lucide-react';
import { Button } from '../../design-system/components';
import { datasourcesApi, CreateDataSourceDto, DataSource } from '../../api/datasources';

interface AddDataSourceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingDataSource?: DataSource | null;
}

const inputClassName = 'w-full rounded-xl border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-950/70 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none transition-all focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10';
const labelClassName = 'mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400';

export const AddDataSourceModal: React.FC<AddDataSourceModalProps> = ({
  open,
  onClose,
  onSuccess,
  editingDataSource,
}) => {
  const [formData, setFormData] = useState<CreateDataSourceDto>({
    name: '',
    description: '',
    connection_type: 'gateway_shs',
    shs_base_url: '',
    shs_auth_scheme: 'bearer',
    shs_auth_token: '',
    shs_auth_header_name: '',
    external_mcp_url: '',
    external_mcp_token: '',
  });
  const [useTunnel, setUseTunnel] = useState(false);
  const [tunnelConfig, setTunnelConfig] = useState({
    ssh_host: '',
    ssh_port: 22,
    ssh_user: '',
    ssh_private_key: '',
    remote_host: 'localhost',
    remote_port: 18080,
  });
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    if (!editingDataSource) {
      setFormData({
        name: '',
        description: '',
        connection_type: 'gateway_shs',
        shs_base_url: '',
        shs_auth_scheme: 'bearer',
        shs_auth_token: '',
        shs_auth_header_name: '',
        external_mcp_url: '',
        external_mcp_token: '',
      });
      setUseTunnel(false);
      setTunnelConfig({
        ssh_host: '',
        ssh_port: 22,
        ssh_user: '',
        ssh_private_key: '',
        remote_host: 'localhost',
        remote_port: 18080,
      });
      setError(null);
      setTestResult(null);
      return;
    }

    setFormData({
      name: editingDataSource.name,
      description: editingDataSource.description || '',
      connection_type: editingDataSource.connection_type,
      shs_base_url: editingDataSource.shs_base_url || '',
      shs_auth_scheme: (editingDataSource.shs_auth_scheme as any) || 'bearer',
      shs_auth_token: '',
      shs_auth_header_name: '',
      external_mcp_url: editingDataSource.external_mcp_url || '',
      external_mcp_token: '',
    });

    if (editingDataSource.tunnel_config) {
      setUseTunnel(true);
      setTunnelConfig({
        ssh_host: editingDataSource.tunnel_config.ssh_host || '',
        ssh_port: editingDataSource.tunnel_config.ssh_port || 22,
        ssh_user: editingDataSource.tunnel_config.ssh_user || '',
        ssh_private_key: '',
        remote_host: editingDataSource.tunnel_config.remote_host || 'localhost',
        remote_port: editingDataSource.tunnel_config.remote_port || 18080,
      });
    } else {
      setUseTunnel(false);
    }
    setError(null);
    setTestResult(null);
  }, [editingDataSource, open]);

  const handleChange = (field: keyof CreateDataSourceDto, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
    setError(null);
  };

  const handleTunnelChange = (field: keyof typeof tunnelConfig, value: string | number) => {
    setTunnelConfig((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
    setError(null);
  };

  const canSubmit = useMemo(() => {
    if (!formData.name?.trim()) return false;
    if (formData.connection_type === 'gateway_shs') {
      if (!formData.shs_base_url?.trim()) return false;
      if (formData.shs_auth_scheme === 'header' && !formData.shs_auth_header_name?.trim()) return false;
      return true;
    }
    return Boolean(formData.external_mcp_url?.trim());
  }, [formData]);

  const buildPayload = () => {
    const payload: any = { ...formData };
    if (useTunnel && formData.connection_type === 'gateway_shs') {
      payload.tunnel_config = tunnelConfig;
    }
    return payload;
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setError(null);
      setTestResult(null);
      const result = await datasourcesApi.testConnection(buildPayload());
      setTestResult(result);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Connection test failed');
      setTestResult({ success: false, message: 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      if (editingDataSource) {
        await datasourcesApi.update(editingDataSource.id, buildPayload());
      } else {
        await datasourcesApi.create(buildPayload());
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save data source');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 md:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-md"
            onClick={() => !loading && !testing && onClose()}
            aria-label="Close modal"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-[linear-gradient(130deg,rgba(255,255,255,0.98),rgba(241,245,249,0.96))] dark:border-slate-700/80 dark:bg-[linear-gradient(130deg,rgba(15,23,42,0.96),rgba(2,6,23,0.94))] shadow-2xl"
            initial={{ y: 14, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 10, opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-orange-400/20 blur-3xl dark:bg-orange-500/15" />
            <div className="pointer-events-none absolute -left-20 bottom-8 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/15" />

            <div className="relative border-b border-slate-200/80 dark:border-slate-700/80 px-6 py-5 md:px-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-600 dark:text-orange-300">Connection Setup</div>
                  <h2 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                    {editingDataSource ? 'Edit Data Source' : 'Add Data Source'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Configure Gateway SHS or External MCP with secure credentials.</p>
                </div>
                <button
                  type="button"
                  onClick={() => !loading && !testing && onClose()}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-700 p-2 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-white/80 dark:hover:bg-slate-900/80 transition-colors"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="relative max-h-[72vh] overflow-y-auto px-6 py-5 md:px-8 custom-scrollbar">
              <div className="space-y-4">
                {error && (
                  <div className="rounded-xl border border-red-300/60 bg-red-50/90 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-300">
                    {error}
                  </div>
                )}
                {testResult && (
                  <div className={`rounded-xl border px-4 py-3 text-sm ${testResult.success
                      ? 'border-emerald-300/60 bg-emerald-50/90 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/35 dark:text-emerald-300'
                      : 'border-red-300/60 bg-red-50/90 text-red-700 dark:border-red-900/50 dark:bg-red-950/35 dark:text-red-300'
                    }`}>
                    <span className="inline-flex items-center gap-2 font-medium">
                      {testResult.success && <CheckCircle2 className="h-4 w-4" />}
                      {testResult.message}
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-5 grid gap-4">
                <div>
                  <label className={labelClassName}>Name *</label>
                  <input value={formData.name} onChange={(e) => handleChange('name', e.target.value)} className={inputClassName} placeholder="Production Spark History" />
                </div>

                <div>
                  <label className={labelClassName}>Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    className={`${inputClassName} min-h-[86px] resize-y`}
                    placeholder="Optional context for your team"
                  />
                </div>

                <div>
                  <label className={labelClassName}>Connection Type</label>
                  <select
                    value={formData.connection_type}
                    onChange={(e) => handleChange('connection_type', e.target.value)}
                    className={inputClassName}
                  >
                    <option value="gateway_shs">Gateway (Hosted MCP)</option>
                    <option value="external_mcp">External MCP Server</option>
                  </select>
                </div>

                {formData.connection_type === 'gateway_shs' && (
                  <div className="rounded-2xl border border-blue-200/80 bg-blue-50/60 p-4 dark:border-blue-900/60 dark:bg-blue-950/20">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-blue-700 dark:text-blue-300">
                      <Server className="h-4 w-4" />
                      Spark History Server Configuration
                    </h3>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className={labelClassName}>SHS Base URL *</label>
                        <input
                          value={formData.shs_base_url}
                          onChange={(e) => handleChange('shs_base_url', e.target.value)}
                          className={inputClassName}
                          placeholder="https://shs.example.com:18080"
                        />
                      </div>

                      <div>
                        <label className={labelClassName}>Authentication Scheme</label>
                        <select
                          value={formData.shs_auth_scheme}
                          onChange={(e) => handleChange('shs_auth_scheme', e.target.value)}
                          className={inputClassName}
                        >
                          <option value="none">None</option>
                          <option value="bearer">Bearer Token</option>
                          <option value="basic">Basic Auth</option>
                          <option value="header">Custom Header</option>
                        </select>
                      </div>

                      {formData.shs_auth_scheme !== 'none' && (
                        <div>
                          <label className={labelClassName}>Authentication Token</label>
                          <input
                            type="password"
                            value={formData.shs_auth_token}
                            onChange={(e) => handleChange('shs_auth_token', e.target.value)}
                            className={inputClassName}
                            placeholder={editingDataSource ? 'Leave blank to keep existing token' : 'Enter token'}
                          />
                        </div>
                      )}

                      {formData.shs_auth_scheme === 'header' && (
                        <div>
                          <label className={labelClassName}>Custom Header Name *</label>
                          <input
                            value={formData.shs_auth_header_name}
                            onChange={(e) => handleChange('shs_auth_header_name', e.target.value)}
                            className={inputClassName}
                            placeholder="X-Auth-Token"
                          />
                        </div>
                      )}

                      <div className="rounded-xl border border-slate-200/80 bg-white/70 p-3 dark:border-slate-700 dark:bg-slate-900/70">
                        <button
                          type="button"
                          onClick={() => setUseTunnel((prev) => !prev)}
                          className="flex w-full items-center justify-between text-left"
                        >
                          <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                            <Shield className="h-4 w-4 text-orange-500" />
                            SSH Tunnel (for private SHS)
                          </span>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{useTunnel ? 'Enabled' : 'Disabled'}</span>
                        </button>

                        <AnimatePresence initial={false}>
                          {useTunnel && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label className={labelClassName}>SSH Host</label>
                                  <input value={tunnelConfig.ssh_host} onChange={(e) => handleTunnelChange('ssh_host', e.target.value)} className={inputClassName} placeholder="bastion.example.com" />
                                </div>
                                <div>
                                  <label className={labelClassName}>SSH User</label>
                                  <input value={tunnelConfig.ssh_user} onChange={(e) => handleTunnelChange('ssh_user', e.target.value)} className={inputClassName} placeholder="ubuntu" />
                                </div>
                                <div>
                                  <label className={labelClassName}>SSH Port</label>
                                  <input type="number" value={tunnelConfig.ssh_port} onChange={(e) => handleTunnelChange('ssh_port', Number(e.target.value) || 22)} className={inputClassName} />
                                </div>
                                <div>
                                  <label className={labelClassName}>Remote Port</label>
                                  <input type="number" value={tunnelConfig.remote_port} onChange={(e) => handleTunnelChange('remote_port', Number(e.target.value) || 18080)} className={inputClassName} />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className={labelClassName}>Remote Host</label>
                                  <input value={tunnelConfig.remote_host} onChange={(e) => handleTunnelChange('remote_host', e.target.value)} className={inputClassName} />
                                </div>
                                <div className="sm:col-span-2">
                                  <label className={labelClassName}>SSH Private Key</label>
                                  <textarea
                                    value={tunnelConfig.ssh_private_key}
                                    onChange={(e) => handleTunnelChange('ssh_private_key', e.target.value)}
                                    className={`${inputClassName} min-h-[120px] font-mono text-xs`}
                                    placeholder={editingDataSource ? 'Leave blank to keep existing key' : '-----BEGIN RSA PRIVATE KEY-----'}
                                  />
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                )}

                {formData.connection_type === 'external_mcp' && (
                  <div className="rounded-2xl border border-violet-200/80 bg-violet-50/60 p-4 dark:border-violet-900/60 dark:bg-violet-950/20">
                    <h3 className="flex items-center gap-2 text-sm font-bold text-violet-700 dark:text-violet-300">
                      <Server className="h-4 w-4" />
                      External MCP Server Configuration
                    </h3>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className={labelClassName}>MCP Server URL *</label>
                        <input
                          value={formData.external_mcp_url}
                          onChange={(e) => handleChange('external_mcp_url', e.target.value)}
                          className={inputClassName}
                          placeholder="https://mcp.example.com"
                        />
                      </div>
                      <div>
                        <label className={labelClassName}>Authentication Token (Optional)</label>
                        <input
                          type="password"
                          value={formData.external_mcp_token}
                          onChange={(e) => handleChange('external_mcp_token', e.target.value)}
                          className={inputClassName}
                          placeholder={editingDataSource ? 'Leave blank to keep existing token' : 'Optional'}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="relative border-t border-slate-200/80 dark:border-slate-700/80 px-6 py-4 md:px-8">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="ghost" onClick={onClose} disabled={loading || testing}>Cancel</Button>
                <Button
                  variant="outline"
                  onClick={handleTestConnection}
                  disabled={loading || testing || !canSubmit}
                  leftIcon={testing ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                >
                  {testing ? 'Testing...' : 'Test Connection'}
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={loading || testing || !canSubmit}
                  leftIcon={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : undefined}
                  className="bg-orange-600 hover:bg-orange-500 dark:bg-orange-500 dark:hover:bg-orange-400"
                >
                  {loading ? 'Saving...' : editingDataSource ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
