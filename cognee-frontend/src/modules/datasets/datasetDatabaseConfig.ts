import type { CogneeInstance } from "@/modules/instances/types";

export interface DatabaseTargetConfig {
  provider: string;
  handler: string;
  name: string;
  host: string;
  port: string;
  username: string;
  has_password: boolean;
}

export interface DatasetDatabaseConfig {
  dataset_id: string;
  graph: DatabaseTargetConfig;
  vector: DatabaseTargetConfig;
}

export type DatasetDatabaseConfigUpdate = Partial<{
  graph_database_name: string;
  graph_database_host: string;
  graph_database_port: string;
  graph_database_username: string;
  graph_database_password: string;
  vector_database_name: string;
  vector_database_host: string;
  vector_database_port: string;
  vector_database_username: string;
  vector_database_password: string;
}>;

type DatabaseTargetConfigResponse = Omit<DatabaseTargetConfig, "port"> & {
  port: string | number | null;
};

type DatasetDatabaseConfigResponse = Omit<DatasetDatabaseConfig, "graph" | "vector"> & {
  graph: DatabaseTargetConfigResponse;
  vector: DatabaseTargetConfigResponse;
};

function normalizeDatabaseConfig(config: DatasetDatabaseConfigResponse): DatasetDatabaseConfig {
  return {
    ...config,
    graph: { ...config.graph, port: config.graph.port == null ? "" : String(config.graph.port) },
    vector: { ...config.vector, port: config.vector.port == null ? "" : String(config.vector.port) },
  };
}

export async function getDatasetDatabaseConfig(
  instance: CogneeInstance,
  datasetId: string,
): Promise<DatasetDatabaseConfig | null> {
  const response = await instance.fetch(`/v1/datasets/${datasetId}/database-config`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load database settings (${response.status})`);
  return normalizeDatabaseConfig(await response.json() as DatasetDatabaseConfigResponse);
}

export async function updateDatasetDatabaseConfig(
  instance: CogneeInstance,
  datasetId: string,
  update: DatasetDatabaseConfigUpdate,
): Promise<DatasetDatabaseConfig> {
  const response = await instance.fetch(`/v1/datasets/${datasetId}/database-config`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(update),
  });
  if (!response.ok) throw new Error(`Failed to save database settings (${response.status})`);
  return normalizeDatabaseConfig(await response.json() as DatasetDatabaseConfigResponse);
}
