import React, { useState, useEffect } from 'react';
import { AdminPageHeader } from '../shared/AdminPageHeader';
import { AdminCard } from '../shared/AdminCard';
import {
  Settings,
  Save,
  RotateCcw,
  Bell,
  Shield,
  Database,
  Zap,
  Users,
  Activity,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2
} from 'lucide-react';

interface SettingConfig {
  key: string;
  label: string;
  description: string;
  type: 'boolean' | 'number' | 'text' | 'select';
  value: any;
  options?: { label: string; value: any }[];
  min?: number;
  max?: number;
}

interface SettingsCategory {
  id: string;
  title: string;
  icon: any;
  settings: SettingConfig[];
}

const GlobalSettings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [activeCategory, setActiveCategory] = useState('platform');

  // Settings state management
  const [settingsData, setSettingsData] = useState<SettingsCategory[]>([
    {
      id: 'platform',
      title: 'Platform Configuration',
      icon: Settings,
      settings: [
        {
          key: 'platformName',
          label: 'Platform Name',
          description: 'Display name shown throughout the application',
          type: 'text',
          value: 'Databricks Plan Optimizer'
        },
        {
          key: 'maintenanceMode',
          label: 'Maintenance Mode',
          description: 'Enable to restrict access during system maintenance',
          type: 'boolean',
          value: false
        },
        {
          key: 'allowRegistrations',
          label: 'Allow New Registrations',
          description: 'Enable new users to register for accounts',
          type: 'boolean',
          value: true
        },
        {
          key: 'defaultUserQuota',
          label: 'Default User Quota',
          description: 'Default number of analyses allowed per user',
          type: 'number',
          value: 100,
          min: 0,
          max: 10000
        }
      ]
    },
    {
      id: 'security',
      title: 'Security & Authentication',
      icon: Shield,
      settings: [
        {
          key: 'requireEmailVerification',
          label: 'Require Email Verification',
          description: 'Users must verify their email before accessing features',
          type: 'boolean',
          value: true
        },
        {
          key: 'sessionTimeout',
          label: 'Session Timeout (minutes)',
          description: 'Automatic logout after period of inactivity',
          type: 'number',
          value: 60,
          min: 5,
          max: 1440
        },
        {
          key: 'maxLoginAttempts',
          label: 'Max Login Attempts',
          description: 'Account locked after this many failed login attempts',
          type: 'number',
          value: 5,
          min: 3,
          max: 10
        },
        {
          key: 'passwordMinLength',
          label: 'Minimum Password Length',
          description: 'Required minimum characters for user passwords',
          type: 'number',
          value: 8,
          min: 6,
          max: 32
        }
      ]
    },
    {
      id: 'features',
      title: 'Feature Flags',
      icon: Zap,
      settings: [
        {
          key: 'enableAIConversations',
          label: 'Enable AI Conversations',
          description: 'Allow users to interact with AI assistant',
          type: 'boolean',
          value: true
        },
        {
          key: 'enableRepoIntegration',
          label: 'Enable Repository Integration',
          description: 'Allow users to connect and analyze repositories',
          type: 'boolean',
          value: true
        },
        {
          key: 'enableAdvancedAnalytics',
          label: 'Enable Advanced Analytics',
          description: 'Provide detailed insights and recommendations',
          type: 'boolean',
          value: true
        },
        {
          key: 'enableExportFeatures',
          label: 'Enable Export Features',
          description: 'Allow users to export analysis results',
          type: 'boolean',
          value: true
        },
        {
          key: 'enableFeedbackSystem',
          label: 'Enable Feedback System',
          description: 'Allow users to submit feedback and reports',
          type: 'boolean',
          value: true
        }
      ]
    },
    {
      id: 'notifications',
      title: 'Notifications',
      icon: Bell,
      settings: [
        {
          key: 'emailNotifications',
          label: 'Email Notifications',
          description: 'Send email notifications to users',
          type: 'boolean',
          value: true
        },
        {
          key: 'adminAlerts',
          label: 'Admin System Alerts',
          description: 'Receive alerts for critical system events',
          type: 'boolean',
          value: true
        },
        {
          key: 'notifyOnNewUser',
          label: 'Notify on New User Registration',
          description: 'Alert admins when new users register',
          type: 'boolean',
          value: false
        },
        {
          key: 'notifyOnFailedAnalysis',
          label: 'Notify on Failed Analysis',
          description: 'Alert admins when analyses fail',
          type: 'boolean',
          value: true
        }
      ]
    },
    {
      id: 'performance',
      title: 'Performance & Limits',
      icon: Activity,
      settings: [
        {
          key: 'maxConcurrentAnalyses',
          label: 'Max Concurrent Analyses',
          description: 'Maximum number of analyses processed simultaneously',
          type: 'number',
          value: 10,
          min: 1,
          max: 100
        },
        {
          key: 'analysisTimeout',
          label: 'Analysis Timeout (seconds)',
          description: 'Maximum time allowed for a single analysis',
          type: 'number',
          value: 300,
          min: 60,
          max: 3600
        },
        {
          key: 'cacheDuration',
          label: 'Cache Duration (hours)',
          description: 'How long to cache analysis results',
          type: 'number',
          value: 24,
          min: 1,
          max: 168
        },
        {
          key: 'maxFileSize',
          label: 'Max File Size (MB)',
          description: 'Maximum allowed file size for uploads',
          type: 'number',
          value: 50,
          min: 1,
          max: 500
        }
      ]
    },
    {
      id: 'database',
      title: 'Database & Storage',
      icon: Database,
      settings: [
        {
          key: 'enableAutoBackup',
          label: 'Enable Automatic Backups',
          description: 'Automatically backup database at scheduled intervals',
          type: 'boolean',
          value: true
        },
        {
          key: 'backupFrequency',
          label: 'Backup Frequency',
          description: 'How often to perform automatic backups',
          type: 'select',
          value: 'daily',
          options: [
            { label: 'Every 6 hours', value: '6h' },
            { label: 'Daily', value: 'daily' },
            { label: 'Weekly', value: 'weekly' },
            { label: 'Monthly', value: 'monthly' }
          ]
        },
        {
          key: 'retentionPeriod',
          label: 'Data Retention Period (days)',
          description: 'How long to keep old analysis data',
          type: 'number',
          value: 90,
          min: 7,
          max: 365
        },
        {
          key: 'enableQueryLogging',
          label: 'Enable Query Logging',
          description: 'Log all database queries for debugging',
          type: 'boolean',
          value: false
        }
      ]
    }
  ]);

  const handleSettingChange = (categoryId: string, settingKey: string, newValue: any) => {
    setSettingsData(prevData =>
      prevData.map(category =>
        category.id === categoryId
          ? {
              ...category,
              settings: category.settings.map(setting =>
                setting.key === settingKey ? { ...setting, value: newValue } : setting
              )
            }
          : category
      )
    );
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveSuccess(false);

    try {
      // Simulate API call - replace with actual API endpoint when available
      await new Promise(resolve => setTimeout(resolve, 1500));

      // TODO: Replace with actual API call
      // await apiClient.put('/admin/settings', settingsData);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = () => {
    if (confirm('Are you sure you want to reset all settings to their default values?')) {
      // Reset logic here - could reload from API or use hardcoded defaults
      window.location.reload();
    }
  };

  const renderSettingInput = (
    category: SettingsCategory,
    setting: SettingConfig
  ) => {
    const baseClasses =
      'px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all';

    switch (setting.type) {
      case 'boolean':
        return (
          <button
            onClick={() =>
              handleSettingChange(category.id, setting.key, !setting.value)
            }
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              setting.value
                ? 'bg-blue-600'
                : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                setting.value ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        );

      case 'number':
        return (
          <input
            type="number"
            value={setting.value}
            onChange={e =>
              handleSettingChange(category.id, setting.key, Number(e.target.value))
            }
            min={setting.min}
            max={setting.max}
            className={`${baseClasses} w-32`}
          />
        );

      case 'text':
        return (
          <input
            type="text"
            value={setting.value}
            onChange={e =>
              handleSettingChange(category.id, setting.key, e.target.value)
            }
            className={`${baseClasses} w-full max-w-md`}
          />
        );

      case 'select':
        return (
          <select
            value={setting.value}
            onChange={e =>
              handleSettingChange(category.id, setting.key, e.target.value)
            }
            className={`${baseClasses} w-48`}
          >
            {setting.options?.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        );

      default:
        return null;
    }
  };

  const activeSettings = settingsData.find(cat => cat.id === activeCategory);

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Global Settings"
        subtitle="Configure platform-wide settings, feature flags, and system preferences"
      >
        <div className="flex gap-3">
          <button
            onClick={handleResetToDefaults}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium transition-all flex items-center gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : saveSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                Saved!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </AdminPageHeader>

      <div className="grid grid-cols-12 gap-6">
        {/* Category Sidebar */}
        <div className="col-span-3">
          <AdminCard className="p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4 px-2">
              Categories
            </h3>
            <nav className="space-y-1">
              {settingsData.map(category => {
                const Icon = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setActiveCategory(category.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      activeCategory === category.id
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {category.title}
                  </button>
                );
              })}
            </nav>
          </AdminCard>
        </div>

        {/* Settings Panel */}
        <div className="col-span-9">
          <AdminCard className="p-6">
            {activeSettings && (
              <>
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-200 dark:border-slate-800">
                  {React.createElement(activeSettings.icon, {
                    className: 'w-6 h-6 text-blue-600 dark:text-blue-400'
                  })}
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      {activeSettings.title}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Configure {activeSettings.title.toLowerCase()} options
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {activeSettings.settings.map(setting => (
                    <div
                      key={setting.key}
                      className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800 last:border-0"
                    >
                      <div className="flex-1 pr-8">
                        <label className="block text-sm font-semibold text-slate-900 dark:text-white mb-1">
                          {setting.label}
                        </label>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {setting.description}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {renderSettingInput(activeSettings, setting)}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </AdminCard>

          {/* Info Banner */}
          <div className="mt-4 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-amber-800 dark:text-amber-200">
              <strong className="font-semibold">Important:</strong> Changes to
              critical settings may require a system restart to take effect. Some
              settings will apply immediately, while others may take a few minutes
              to propagate.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettings;
