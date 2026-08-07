"use client";

import { Alert, Badge, Button, Card, Group, PasswordInput, SimpleGrid, Stack, Text, TextInput, Title } from "@mantine/core";
import { useEffect, useState } from "react";
import type { CogneeInstance } from "@/modules/instances/types";
import {
  getDatasetDatabaseConfig,
  updateDatasetDatabaseConfig,
  type DatabaseTargetConfig,
  type DatasetDatabaseConfig,
  type DatasetDatabaseConfigUpdate,
} from "@/modules/datasets/datasetDatabaseConfig";

function TargetFields({
  kind,
  target,
  password,
  onChange,
  onPasswordChange,
}: {
  kind: "graph" | "vector";
  target: DatabaseTargetConfig;
  password: string;
  onChange: (target: DatabaseTargetConfig) => void;
  onPasswordChange: (value: string) => void;
}) {
  const label = kind === "graph" ? "Graph database" : "Vector database";
  const set = (field: keyof DatabaseTargetConfig, value: string) => onChange({ ...target, [field]: value });
  const inputStyles = {
    label: { color: "rgba(237,236,234,0.62)", fontSize: 12, marginBottom: 5 },
    input: {
      background: "rgba(255,255,255,0.04)",
      borderColor: "rgba(255,255,255,0.12)",
      color: "#EDECEA",
    },
  };
  return (
    <Card
      padding="lg"
      radius="md"
      withBorder
      style={{ background: "rgba(0,0,0,0.28)", borderColor: "rgba(255,255,255,0.08)" }}
    >
      <Stack gap="md">
        <Group justify="space-between" align="flex-start">
          <Title order={3} size="sm" c="#EDECEA">{label}</Title>
          <Badge variant="light" color="violet" size="sm">{target.provider}</Badge>
        </Group>
        <Text size="xs" c="rgba(237,236,234,0.42)">{target.handler}</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <TextInput styles={inputStyles} label="Host" value={target.host} onChange={(e) => set("host", e.currentTarget.value)} />
          <TextInput styles={inputStyles} label="Port" value={target.port} onChange={(e) => set("port", e.currentTarget.value)} />
        </SimpleGrid>
        <TextInput styles={inputStyles} label="Database name" value={target.name} onChange={(e) => set("name", e.currentTarget.value)} />
        <TextInput styles={inputStyles} label="Username" value={target.username} onChange={(e) => set("username", e.currentTarget.value)} />
      <PasswordInput
        styles={inputStyles}
        label="Password"
        value={password}
        placeholder={target.has_password ? "Leave blank to keep current password" : "No password configured"}
        onChange={(e) => onPasswordChange(e.currentTarget.value)}
        />
      </Stack>
    </Card>
  );
}

export default function DatasetDatabaseSettings({ datasetId, instance }: { datasetId: string; instance: CogneeInstance }) {
  const [config, setConfig] = useState<DatasetDatabaseConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [graphPassword, setGraphPassword] = useState("");
  const [vectorPassword, setVectorPassword] = useState("");

  useEffect(() => {
    let active = true;
    getDatasetDatabaseConfig(instance, datasetId)
      .then((value) => { if (active) setConfig(value); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Failed to load database settings"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [datasetId, instance]);

  if (loading) return null;
  if (!config && !error) return null;

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError(null);
    const payload: DatasetDatabaseConfigUpdate = {
      graph_database_host: config.graph.host,
      graph_database_port: config.graph.port,
      graph_database_name: config.graph.name,
      graph_database_username: config.graph.username,
      vector_database_host: config.vector.host,
      vector_database_port: config.vector.port,
      vector_database_name: config.vector.name,
      vector_database_username: config.vector.username,
    };
    if (graphPassword) payload.graph_database_password = graphPassword;
    if (vectorPassword) payload.vector_database_password = vectorPassword;
    try {
      const saved = await updateDatasetDatabaseConfig(instance, datasetId, payload);
      setConfig(saved);
      setGraphPassword("");
      setVectorPassword("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Failed to save database settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      component="section"
      padding="xl"
      radius="lg"
      withBorder
      style={{ background: "rgba(255,255,255,0.045)", borderColor: "rgba(255,255,255,0.1)", backdropFilter: "blur(12px)" }}
    >
      <Stack gap="lg">
        <Group justify="space-between" align="center">
          <Stack gap={3}>
            <Title order={2} size="md" c="#EDECEA">Database connection</Title>
            <Text size="xs" c="rgba(237,236,234,0.48)">Dataset-specific graph and vector storage settings</Text>
          </Stack>
          {config && <Button color="violet" variant="filled" loading={saving} onClick={save}>Save changes</Button>}
        </Group>
      {error && <Alert color="red" variant="light" title="Unable to save settings">{error}</Alert>}
      {config && (
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="lg">
          <TargetFields kind="graph" target={config.graph} password={graphPassword} onChange={(graph) => setConfig({ ...config, graph })} onPasswordChange={setGraphPassword} />
          <TargetFields kind="vector" target={config.vector} password={vectorPassword} onChange={(vector) => setConfig({ ...config, vector })} onPasswordChange={setVectorPassword} />
        </SimpleGrid>
      )}
      </Stack>
    </Card>
  );
}
