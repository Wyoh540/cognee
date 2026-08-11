"use client";

import { Alert, Badge, Button, Card, Group, PasswordInput, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { useState } from "react";
import type { DatabaseTargetConfig, DatasetDatabaseConfig, DatasetDatabaseConfigUpdate } from "@/modules/datasets/datasetDatabaseConfig";
import { updateTenantDatasetDatabaseConfig } from "@/modules/admin/adminApi";

function TargetFields({ label, target, password, onChange, onPasswordChange }: {
  label: string;
  target: DatabaseTargetConfig;
  password: string;
  onChange: (target: DatabaseTargetConfig) => void;
  onPasswordChange: (password: string) => void;
}) {
  const set = (field: keyof DatabaseTargetConfig, value: string) => onChange({ ...target, [field]: value });
  return <Card padding="md" radius="md" withBorder bg="var(--mantine-color-default)">
    <Stack gap="sm">
      <Group justify="space-between"><Title order={4} size="sm">{label}</Title><Badge variant="light" color="violet">{target.provider}</Badge></Group>
      <Text size="xs" c="dimmed">{target.handler}</Text>
      <SimpleGrid cols={{ base: 1, sm: 2 }}><TextInput label="Host" value={target.host} onChange={(e) => set("host", e.currentTarget.value)} /><TextInput label="Port" value={target.port} onChange={(e) => set("port", e.currentTarget.value)} /></SimpleGrid>
      <TextInput label="Database name" value={target.name} onChange={(e) => set("name", e.currentTarget.value)} />
      <TextInput label="Username" value={target.username} onChange={(e) => set("username", e.currentTarget.value)} />
      <PasswordInput label="Password" value={password} placeholder={target.has_password ? "Leave blank to keep current password" : "No password configured"} onChange={(e) => onPasswordChange(e.currentTarget.value)} />
    </Stack>
  </Card>;
}

export default function WorkspaceDatabaseSettings({ tenantId, datasetName, initialConfig, onSaved }: {
  tenantId: string;
  datasetName: string;
  initialConfig: DatasetDatabaseConfig;
  onSaved: (config: DatasetDatabaseConfig) => void;
}) {
  const [config, setConfig] = useState(initialConfig);
  const [graphPassword, setGraphPassword] = useState("");
  const [vectorPassword, setVectorPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSaving(true); setError(null);
    const body: DatasetDatabaseConfigUpdate = {
      graph_database_host: config.graph.host, graph_database_port: config.graph.port,
      graph_database_name: config.graph.name, graph_database_username: config.graph.username,
      vector_database_host: config.vector.host, vector_database_port: config.vector.port,
      vector_database_name: config.vector.name, vector_database_username: config.vector.username,
    };
    if (graphPassword) body.graph_database_password = graphPassword;
    if (vectorPassword) body.vector_database_password = vectorPassword;
    try {
      const saved = await updateTenantDatasetDatabaseConfig(tenantId, config.dataset_id, body);
      setConfig(saved); setGraphPassword(""); setVectorPassword(""); onSaved(saved);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Failed to save settings"); }
    finally { setSaving(false); }
  };

  return <Stack gap="md" mt="md">
    <Group justify="space-between"><div><Text fw={600}>{datasetName}</Text><Text size="xs" c="dimmed">Database connection</Text></div><Button size="xs" color="violet" loading={saving} onClick={save}>Save changes</Button></Group>
    {error && <Alert color="red" title="Unable to save settings">{error}</Alert>}
    <SimpleGrid cols={{ base: 1, lg: 2 }}>
      <TargetFields label="Graph database" target={config.graph} password={graphPassword} onChange={(graph) => setConfig({ ...config, graph })} onPasswordChange={setGraphPassword} />
      <TargetFields label="Vector database" target={config.vector} password={vectorPassword} onChange={(vector) => setConfig({ ...config, vector })} onPasswordChange={setVectorPassword} />
    </SimpleGrid>
  </Stack>;
}
