import { Injectable, NotFoundException } from '@nestjs/common';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { DataSourcesService } from '../datasources/datasources.service';
import { OrgConnectionsService } from '../org-connections/org-connections.service';

export type HistoricalAccessMode = 'datasource' | 'org_connection';

export interface HistoricalDataAccessContext {
  mode: HistoricalAccessMode;
  datasourceId?: string;
  datasourceConnectionType?: 'gateway_shs' | 'external_mcp';
  selectedBy: 'requested_datasource' | 'active_datasource' | 'legacy_org_connection';
}

@Injectable()
export class HistoricalDataAccessResolverService {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly dataSourcesService: DataSourcesService,
    private readonly orgConnectionsService: OrgConnectionsService,
  ) {}

  async resolve(
    userId: string,
    orgId: string | undefined,
    datasourceId?: string,
  ): Promise<HistoricalDataAccessContext> {
    if (datasourceId) {
      const datasource = await this.dataSourcesService.getWithDecryptedTokens(userId, datasourceId);
      const context: HistoricalDataAccessContext = {
        mode: 'datasource',
        datasourceId: datasource.id,
        datasourceConnectionType: datasource.connection_type,
        selectedBy: 'requested_datasource',
      };

      this.logger.info('Resolved historical data access via requested datasource', {
        userId,
        orgId,
        datasourceId: datasource.id,
        connectionType: datasource.connection_type,
      });

      return context;
    }

    const activeDatasource = await this.dataSourcesService.getActiveWithDecryptedTokens(userId);
    if (activeDatasource) {
      const context: HistoricalDataAccessContext = {
        mode: 'datasource',
        datasourceId: activeDatasource.id,
        datasourceConnectionType: activeDatasource.connection_type,
        selectedBy: 'active_datasource',
      };

      this.logger.info('Resolved historical data access via active datasource', {
        userId,
        orgId,
        datasourceId: activeDatasource.id,
        connectionType: activeDatasource.connection_type,
      });

      return context;
    }

    try {
      await this.orgConnectionsService.getActiveConnection(userId, orgId);
      const context: HistoricalDataAccessContext = {
        mode: 'org_connection',
        selectedBy: 'legacy_org_connection',
      };

      this.logger.info('Resolved historical data access via legacy org connection', {
        userId,
        orgId,
      });

      return context;
    } catch (error) {
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
      this.logger.warn('No datasource or org connection configured for historical analysis', {
        userId,
        orgId,
      });
      throw new NotFoundException(
        'No data source configured. Configure an active datasource (Gateway SHS or External MCP) or an org MCP connection.',
      );
    }
  }
}
