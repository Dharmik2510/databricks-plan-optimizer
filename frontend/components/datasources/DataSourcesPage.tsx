import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { Add, Edit, Delete, Wifi, WifiOff } from '@mui/icons-material';
import { datasourcesApi, DataSource } from '../../api/datasources';
import { AddDataSourceModal } from './AddDataSourceModal';

export const DataSourcesPage: React.FC = () => {
  const [datasources, setDatasources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await datasourcesApi.getAll();
      setDatasources(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load data sources');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingDataSource(null);
    setAddModalOpen(true);
  };

  const handleEdit = (datasource: DataSource) => {
    setEditingDataSource(datasource);
    setAddModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    try {
      await datasourcesApi.delete(deletingId);
      await loadDataSources();
      setDeleteConfirmOpen(false);
      setDeletingId(null);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete data source');
    }
  };

  const confirmDelete = (id: string) => {
    setDeletingId(id);
    setDeleteConfirmOpen(true);
  };

  const getConnectionTypeLabel = (type: string) => {
    switch (type) {
      case 'gateway_shs':
        return 'Gateway (SHS)';
      case 'external_mcp':
        return 'External MCP';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Data Sources</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleAdd}
        >
          Add Data Source
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {datasources.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center">
              No data sources configured. Add your first data source to get started.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          {datasources.map((ds) => (
            <Card key={ds.id}>
              <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                  <Box flex={1}>
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <Typography variant="h6">{ds.name}</Typography>
                      {ds.is_active ? (
                        <Chip
                          icon={<Wifi />}
                          label="Active"
                          color="success"
                          size="small"
                        />
                      ) : (
                        <Chip
                          icon={<WifiOff />}
                          label="Inactive"
                          color="default"
                          size="small"
                        />
                      )}
                      <Chip
                        label={getConnectionTypeLabel(ds.connection_type)}
                        color="primary"
                        variant="outlined"
                        size="small"
                      />
                    </Box>

                    {ds.description && (
                      <Typography variant="body2" color="text.secondary" mb={1}>
                        {ds.description}
                      </Typography>
                    )}

                    {ds.connection_type === 'gateway_shs' && (
                      <Box mt={1}>
                        <Typography variant="caption" color="text.secondary">
                          SHS URL: {ds.shs_base_url}
                        </Typography>
                        <br />
                        <Typography variant="caption" color="text.secondary">
                          Auth: {ds.shs_auth_scheme}
                        </Typography>
                        {ds.tunnel_config && (
                          <>
                            <br />
                            <Typography variant="caption" color="text.secondary">
                              SSH Tunnel: {ds.tunnel_config.ssh_host}
                            </Typography>
                          </>
                        )}
                      </Box>
                    )}

                    {ds.connection_type === 'external_mcp' && (
                      <Box mt={1}>
                        <Typography variant="caption" color="text.secondary">
                          MCP URL: {ds.external_mcp_url}
                        </Typography>
                      </Box>
                    )}

                    <Box mt={1}>
                      <Typography variant="caption" color="text.secondary">
                        Created: {new Date(ds.created_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Box>

                  <Box display="flex" gap={1}>
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(ds)}
                      title="Edit"
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => confirmDelete(ds.id)}
                      title="Delete"
                      color="error"
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Box>
      )}

      <AddDataSourceModal
        open={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setEditingDataSource(null);
        }}
        onSuccess={() => {
          loadDataSources();
          setAddModalOpen(false);
          setEditingDataSource(null);
        }}
        editingDataSource={editingDataSource}
      />

      <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this data source? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
