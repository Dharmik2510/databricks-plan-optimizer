import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Switch,
  FormControlLabel,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import { datasourcesApi, DataSource, CreateDataSourceDto } from '../../api/datasources';

interface AddDataSourceModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingDataSource?: DataSource | null;
}

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
    if (editingDataSource) {
      setFormData({
        name: editingDataSource.name,
        description: editingDataSource.description || '',
        connection_type: editingDataSource.connection_type,
        shs_base_url: editingDataSource.shs_base_url || '',
        shs_auth_scheme: (editingDataSource.shs_auth_scheme as any) || 'bearer',
        shs_auth_token: '',
        external_mcp_url: editingDataSource.external_mcp_url || '',
        external_mcp_token: '',
      });

      if (editingDataSource.tunnel_config) {
        setUseTunnel(true);
        setTunnelConfig({
          ...tunnelConfig,
          ...editingDataSource.tunnel_config,
          ssh_private_key: '', // Don't populate for security
        });
      }
    } else {
      resetForm();
    }
  }, [editingDataSource, open]);

  const resetForm = () => {
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
  };

  const handleChange = (field: keyof CreateDataSourceDto, value: any) => {
    setFormData({ ...formData, [field]: value });
    setTestResult(null);
  };

  const handleTunnelChange = (field: string, value: any) => {
    setTunnelConfig({ ...tunnelConfig, [field]: value });
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setError(null);
      setTestResult(null);

      const testData: any = { ...formData };
      if (useTunnel && formData.connection_type === 'gateway_shs') {
        testData.tunnel_config = tunnelConfig;
      }

      const result = await datasourcesApi.testConnection(testData);
      setTestResult(result);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Connection test failed');
      setTestResult({ success: false, message: 'Connection test failed' });
    } finally {
      setTesting(false);
    }
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);

      const submitData: any = { ...formData };
      if (useTunnel && formData.connection_type === 'gateway_shs') {
        submitData.tunnel_config = tunnelConfig;
      }

      if (editingDataSource) {
        await datasourcesApi.update(editingDataSource.id, submitData);
      } else {
        await datasourcesApi.create(submitData);
      }

      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save data source');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {editingDataSource ? 'Edit Data Source' : 'Add Data Source'}
      </DialogTitle>

      <DialogContent>
        <Box display="flex" flexDirection="column" gap={2} mt={1}>
          {error && (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {testResult && (
            <Alert severity={testResult.success ? 'success' : 'error'}>
              {testResult.message}
            </Alert>
          )}

          <TextField
            label="Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            fullWidth
          />

          <TextField
            label="Description"
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            multiline
            rows={2}
            fullWidth
          />

          <FormControl fullWidth>
            <InputLabel>Connection Type</InputLabel>
            <Select
              value={formData.connection_type}
              onChange={(e) => handleChange('connection_type', e.target.value)}
              label="Connection Type"
            >
              <MenuItem value="gateway_shs">Gateway (Hosted MCP)</MenuItem>
              <MenuItem value="external_mcp">External MCP Server</MenuItem>
            </Select>
          </FormControl>

          {formData.connection_type === 'gateway_shs' && (
            <>
              <Typography variant="subtitle2" color="primary">
                Spark History Server Configuration
              </Typography>

              <TextField
                label="SHS Base URL"
                value={formData.shs_base_url}
                onChange={(e) => handleChange('shs_base_url', e.target.value)}
                placeholder="https://shs.example.com:18080"
                required
                fullWidth
              />

              <FormControl fullWidth>
                <InputLabel>Authentication Scheme</InputLabel>
                <Select
                  value={formData.shs_auth_scheme}
                  onChange={(e) => handleChange('shs_auth_scheme', e.target.value)}
                  label="Authentication Scheme"
                >
                  <MenuItem value="none">None</MenuItem>
                  <MenuItem value="bearer">Bearer Token</MenuItem>
                  <MenuItem value="basic">Basic Auth</MenuItem>
                  <MenuItem value="header">Custom Header</MenuItem>
                </Select>
              </FormControl>

              {formData.shs_auth_scheme !== 'none' && (
                <TextField
                  label="Authentication Token"
                  value={formData.shs_auth_token}
                  onChange={(e) => handleChange('shs_auth_token', e.target.value)}
                  type="password"
                  fullWidth
                  helperText={editingDataSource ? 'Leave blank to keep existing token' : ''}
                />
              )}

              {formData.shs_auth_scheme === 'header' && (
                <TextField
                  label="Custom Header Name"
                  value={formData.shs_auth_header_name}
                  onChange={(e) => handleChange('shs_auth_header_name', e.target.value)}
                  placeholder="X-Auth-Token"
                  fullWidth
                />
              )}

              <Accordion expanded={useTunnel} onChange={(_, expanded) => setUseTunnel(expanded)}>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography>SSH Tunnel (for private SHS)</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box display="flex" flexDirection="column" gap={2}>
                    <TextField
                      label="SSH Host"
                      value={tunnelConfig.ssh_host}
                      onChange={(e) => handleTunnelChange('ssh_host', e.target.value)}
                      placeholder="bastion.example.com"
                      fullWidth
                    />

                    <Box display="flex" gap={2}>
                      <TextField
                        label="SSH Port"
                        type="number"
                        value={tunnelConfig.ssh_port}
                        onChange={(e) => handleTunnelChange('ssh_port', parseInt(e.target.value))}
                        fullWidth
                      />
                      <TextField
                        label="SSH User"
                        value={tunnelConfig.ssh_user}
                        onChange={(e) => handleTunnelChange('ssh_user', e.target.value)}
                        fullWidth
                      />
                    </Box>

                    <TextField
                      label="SSH Private Key"
                      value={tunnelConfig.ssh_private_key}
                      onChange={(e) => handleTunnelChange('ssh_private_key', e.target.value)}
                      multiline
                      rows={4}
                      placeholder="-----BEGIN RSA PRIVATE KEY-----"
                      fullWidth
                      helperText={editingDataSource ? 'Leave blank to keep existing key' : ''}
                    />

                    <Box display="flex" gap={2}>
                      <TextField
                        label="Remote Host"
                        value={tunnelConfig.remote_host}
                        onChange={(e) => handleTunnelChange('remote_host', e.target.value)}
                        fullWidth
                      />
                      <TextField
                        label="Remote Port"
                        type="number"
                        value={tunnelConfig.remote_port}
                        onChange={(e) => handleTunnelChange('remote_port', parseInt(e.target.value))}
                        fullWidth
                      />
                    </Box>
                  </Box>
                </AccordionDetails>
              </Accordion>
            </>
          )}

          {formData.connection_type === 'external_mcp' && (
            <>
              <Typography variant="subtitle2" color="primary">
                External MCP Server Configuration
              </Typography>

              <TextField
                label="MCP Server URL"
                value={formData.external_mcp_url}
                onChange={(e) => handleChange('external_mcp_url', e.target.value)}
                placeholder="https://mcp.example.com"
                required
                fullWidth
              />

              <TextField
                label="Authentication Token (Optional)"
                value={formData.external_mcp_token}
                onChange={(e) => handleChange('external_mcp_token', e.target.value)}
                type="password"
                fullWidth
                helperText={editingDataSource ? 'Leave blank to keep existing token' : ''}
              />
            </>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading || testing}>
          Cancel
        </Button>
        <Button
          onClick={handleTestConnection}
          disabled={loading || testing}
          variant="outlined"
        >
          {testing ? <CircularProgress size={20} /> : 'Test Connection'}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || testing}
          variant="contained"
        >
          {loading ? <CircularProgress size={20} /> : editingDataSource ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
