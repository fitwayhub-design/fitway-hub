import React, { useEffect, useState, useCallback } from "react";
import {
  Card, Form, Switch, InputNumber, Button, Row, Col, Table, Tabs,
  Tag, Space, Typography, message, Modal, Input, Select, Popconfirm, Spin,
} from "antd";
import {
  SettingOutlined, HistoryOutlined, AppstoreOutlined,
  FlagOutlined, SafetyOutlined, BlockOutlined, PlusOutlined,
  EditOutlined, DeleteOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";

const { Title, Text } = Typography;
const API = getApiBase();

export default function AdsSettings() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any[]>([]);
  const [grouped, setGrouped] = useState<Record<string, any[]>>({});
  const [history, setHistory] = useState<any[]>([]);
  const [placements, setPlacements] = useState<any[]>([]);
  const [featureFlags, setFeatureFlags] = useState<any[]>([]);
  const [approvalRules, setApprovalRules] = useState<any[]>([]);
  const [presets, setPresets] = useState<any[]>([]);

  const [settingsForm] = Form.useForm();
  const [ruleForm] = Form.useForm();
  const [presetForm] = Form.useForm();

  const [ruleModal, setRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<any>(null);
  const [presetModal, setPresetModal] = useState(false);
  const [editingPreset, setEditingPreset] = useState<any>(null);

  /* ── Fetchers ─────────────────────────────────────────────────── */

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/ad-settings`, { headers });
      const list = res.data.settings || [];
      setSettings(list);
      setGrouped(res.data.grouped || {});
      const map: Record<string, any> = {};
      for (const s of list) {
        if (s.setting_type === "boolean") map[s.setting_key] = s.setting_value === "true";
        else if (s.setting_type === "integer") map[s.setting_key] = parseInt(s.setting_value);
        else map[s.setting_key] = s.setting_value;
      }
      settingsForm.setFieldsValue(map);
    } catch {} finally { setLoading(false); }
  }, [token]);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ad-settings/history`, { headers });
      setHistory(res.data.history || []);
    } catch {}
  }, [token]);

  const fetchPlacements = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ad-settings/placements`, { headers });
      setPlacements(res.data.placements || []);
    } catch {}
  }, [token]);

  const fetchFeatureFlags = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ad-settings/feature-flags`, { headers });
      setFeatureFlags(res.data.flags || []);
    } catch {}
  }, [token]);

  const fetchApprovalRules = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ad-settings/approval-rules`, { headers });
      setApprovalRules(res.data.rules || []);
    } catch {}
  }, [token]);

  const fetchPresets = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ad-settings/presets`, { headers });
      setPresets(res.data.presets || []);
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchSettings();
    fetchHistory();
    fetchPlacements();
    fetchFeatureFlags();
    fetchApprovalRules();
    fetchPresets();
  }, []);

  /* ── Settings bulk save ───────────────────────────────────────── */

  async function handleSave(values: any) {
    setLoading(true);
    try {
      const updates = Object.keys(values).map(k => ({ key: k, value: values[k] }));
      await axios.post(`${API}/api/ad-settings/bulk`, { updates }, { headers });
      message.success("Settings saved");
      fetchSettings();
      fetchHistory();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Save failed");
    } finally { setLoading(false); }
  }

  /* ── Placements toggle ────────────────────────────────────────── */

  async function togglePlacement(key: string, enabled: boolean) {
    try {
      await axios.patch(`${API}/api/ad-settings/placements/${key}`, { enabled }, { headers });
      message.success(`Placement ${enabled ? "enabled" : "disabled"}`);
      fetchPlacements();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Failed");
    }
  }

  /* ── Feature flags toggle ─────────────────────────────────────── */

  async function toggleFeatureFlag(key: string, enabled: boolean) {
    try {
      await axios.patch(`${API}/api/ad-settings/feature-flags/${key}`, { enabled }, { headers });
      message.success(`Flag ${enabled ? "enabled" : "disabled"}`);
      fetchFeatureFlags();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Failed");
    }
  }

  /* ── Approval Rules CRUD ──────────────────────────────────────── */

  function openCreateRule() {
    setEditingRule(null);
    ruleForm.resetFields();
    setRuleModal(true);
  }

  function openEditRule(r: any) {
    setEditingRule(r);
    ruleForm.setFieldsValue({ rule_name: r.rule_name, rule_type: r.rule_type, condition_json: r.condition_json, action_on_match: r.action_on_match, enabled: r.enabled });
    setRuleModal(true);
  }

  async function saveRule() {
    try {
      const vals = await ruleForm.validateFields();
      if (editingRule) {
        await axios.patch(`${API}/api/ad-settings/approval-rules/${editingRule.id}`, vals, { headers });
        message.success("Rule updated");
      } else {
        await axios.post(`${API}/api/ad-settings/approval-rules`, vals, { headers });
        message.success("Rule created");
      }
      setRuleModal(false);
      fetchApprovalRules();
    } catch (e: any) { message.error(e?.response?.data?.message || "Save failed"); }
  }

  async function deleteRule(id: number) {
    try {
      await axios.delete(`${API}/api/ad-settings/approval-rules/${id}`, { headers });
      message.success("Rule deleted");
      fetchApprovalRules();
    } catch (e: any) { message.error(e?.response?.data?.message || "Delete failed"); }
  }

  /* ── Presets CRUD ─────────────────────────────────────────────── */

  function openCreatePreset() {
    setEditingPreset(null);
    presetForm.resetFields();
    setPresetModal(true);
  }

  function openEditPreset(p: any) {
    setEditingPreset(p);
    presetForm.setFieldsValue({ name: p.name, preset_type: p.preset_type, config_json: typeof p.config_json === "object" ? JSON.stringify(p.config_json) : p.config_json, is_default: p.is_default });
    setPresetModal(true);
  }

  async function savePreset() {
    try {
      const vals = await presetForm.validateFields();
      const payload = { ...vals };
      if (typeof payload.config_json === "string") {
        try { payload.config_json = JSON.parse(payload.config_json); } catch {}
      }
      if (editingPreset) {
        await axios.patch(`${API}/api/ad-settings/presets/${editingPreset.id}`, payload, { headers });
        message.success("Preset updated");
      } else {
        await axios.post(`${API}/api/ad-settings/presets`, payload, { headers });
        message.success("Preset created");
      }
      setPresetModal(false);
      fetchPresets();
    } catch (e: any) { message.error(e?.response?.data?.message || "Save failed"); }
  }

  async function deletePreset(id: number) {
    try {
      await axios.delete(`${API}/api/ad-settings/presets/${id}`, { headers });
      message.success("Preset deleted");
      fetchPresets();
    } catch (e: any) { message.error(e?.response?.data?.message || "Delete failed"); }
  }

  /* ── Render helper: grouped settings form fields ──────────────── */

  function renderSettingField(s: any) {
    const key = s.setting_key;
    if (s.setting_type === "boolean") {
      return (
        <Col span={8} key={key}>
          <Form.Item name={key} label={s.label || key.replace(/_/g, " ")} valuePropName="checked">
            <Switch />
          </Form.Item>
        </Col>
      );
    }
    if (s.setting_type === "integer") {
      return (
        <Col span={6} key={key}>
          <Form.Item name={key} label={s.label || key.replace(/_/g, " ")}>
            <InputNumber style={{ width: "100%" }} />
          </Form.Item>
        </Col>
      );
    }
    return (
      <Col span={8} key={key}>
        <Form.Item name={key} label={s.label || key.replace(/_/g, " ")}>
          <Input />
        </Form.Item>
      </Col>
    );
  }

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}><SettingOutlined /> Ads System Settings</Title>

      <Spin spinning={loading}>
        <Tabs defaultActiveKey="general" items={[
          {
            key: "general",
            label: <><SettingOutlined /> General Settings</>,
            children: (
              <Card>
                <Form form={settingsForm} layout="vertical" onFinish={handleSave}>
                  {Object.keys(grouped).length > 0 ? (
                    Object.entries(grouped).map(([group, items]) => (
                      <div key={group} style={{ marginBottom: 24 }}>
                        <Title level={5} style={{ textTransform: "capitalize" }}>{group.replace(/_/g, " ")}</Title>
                        <Row gutter={16}>
                          {(items as any[]).map(renderSettingField)}
                        </Row>
                      </div>
                    ))
                  ) : (
                    <Row gutter={16}>
                      {settings.map(renderSettingField)}
                    </Row>
                  )}
                  <Button type="primary" htmlType="submit" loading={loading} style={{ marginTop: 16 }}>
                    Save Settings
                  </Button>
                </Form>
              </Card>
            ),
          },
          {
            key: "placements",
            label: <><AppstoreOutlined /> Placements ({placements.length})</>,
            children: (
              <Card>
                <Table dataSource={placements} rowKey="placement_key" pagination={false} columns={[
                  { title: "Placement", dataIndex: "placement_key", render: (v: any) => <Tag>{v?.replace(/_/g, " ")}</Tag> },
                  { title: "Label", dataIndex: "label" },
                  { title: "Description", dataIndex: "description" },
                  { title: "Max Ads", dataIndex: "max_ads_per_view" },
                  { title: "Enabled", dataIndex: "enabled", render: (v: any, r: any) => (
                    <Switch checked={!!v} onChange={(checked) => togglePlacement(r.placement_key, checked)} />
                  )},
                ]} />
              </Card>
            ),
          },
          {
            key: "feature-flags",
            label: <><FlagOutlined /> Feature Flags ({featureFlags.length})</>,
            children: (
              <Card>
                <Table dataSource={featureFlags} rowKey="flag_key" pagination={false} columns={[
                  { title: "Flag", dataIndex: "flag_key", render: (v: any) => <Tag color="blue">{v}</Tag> },
                  { title: "Description", dataIndex: "description" },
                  { title: "Enabled", dataIndex: "enabled", render: (v: any, r: any) => (
                    <Switch checked={!!v} onChange={(checked) => toggleFeatureFlag(r.flag_key, checked)} />
                  )},
                ]} />
              </Card>
            ),
          },
          {
            key: "approval-rules",
            label: <><SafetyOutlined /> Approval Rules ({approvalRules.length})</>,
            children: (
              <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreateRule}>Add Rule</Button>}>
                <Table dataSource={approvalRules} rowKey="id" pagination={false} columns={[
                  { title: "Name", dataIndex: "rule_name" },
                  { title: "Type", dataIndex: "rule_type", render: (v: any) => <Tag>{v}</Tag> },
                  { title: "Action", dataIndex: "action_on_match", render: (v: any) => <Tag color={v === "reject" ? "red" : v === "flag" ? "orange" : "blue"}>{v}</Tag> },
                  { title: "Enabled", dataIndex: "enabled", render: (v: any) => <Tag color={v ? "green" : "default"}>{v ? "Yes" : "No"}</Tag> },
                  { title: "Actions", render: (_: any, r: any) => (
                    <Space size="small">
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditRule(r)} />
                      <Popconfirm title="Delete this rule?" onConfirm={() => deleteRule(r.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  )},
                ]} />
              </Card>
            ),
          },
          {
            key: "presets",
            label: <><BlockOutlined /> Presets ({presets.length})</>,
            children: (
              <Card extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreatePreset}>Add Preset</Button>}>
                <Table dataSource={presets} rowKey="id" pagination={false} columns={[
                  { title: "Name", dataIndex: "name" },
                  { title: "Type", dataIndex: "preset_type", render: (v: any) => <Tag>{v}</Tag> },
                  { title: "Default", dataIndex: "is_default", render: (v: any) => v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag> },
                  { title: "Created", dataIndex: "created_at", render: (v: any) => v ? new Date(v).toLocaleDateString() : "-" },
                  { title: "Actions", render: (_: any, r: any) => (
                    <Space size="small">
                      <Button size="small" icon={<EditOutlined />} onClick={() => openEditPreset(r)} />
                      <Popconfirm title="Delete this preset?" onConfirm={() => deletePreset(r.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} />
                      </Popconfirm>
                    </Space>
                  )},
                ]} />
              </Card>
            ),
          },
          {
            key: "history",
            label: <><HistoryOutlined /> Change History ({history.length})</>,
            children: (
              <Card>
                <Table dataSource={history} rowKey="id" pagination={{ pageSize: 15 }} columns={[
                  { title: "When", dataIndex: "changed_at", render: (v: any) => v ? new Date(v).toLocaleString() : "-" },
                  { title: "Setting", dataIndex: "setting_key", render: (v: any) => <Tag>{v}</Tag> },
                  { title: "Old Value", dataIndex: "old_value" },
                  { title: "New Value", dataIndex: "new_value" },
                  { title: "Changed By", dataIndex: "changed_by_name" },
                ]} />
              </Card>
            ),
          },
        ]} />
      </Spin>

      {/* ── Approval Rule Modal ──────────────────────────────────── */}
      <Modal open={ruleModal} title={editingRule ? "Edit Rule" : "Create Rule"} onCancel={() => setRuleModal(false)} onOk={saveRule} okText="Save" width={600}>
        <Form form={ruleForm} layout="vertical">
          <Form.Item name="rule_name" label="Rule Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Block profanity" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="rule_type" label="Type" initialValue="keyword">
                <Select>
                  <Select.Option value="keyword">Keyword</Select.Option>
                  <Select.Option value="budget">Budget</Select.Option>
                  <Select.Option value="targeting">Targeting</Select.Option>
                  <Select.Option value="creative">Creative</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="action_on_match" label="Action" initialValue="flag">
                <Select>
                  <Select.Option value="flag">Flag for Review</Select.Option>
                  <Select.Option value="reject">Auto-Reject</Select.Option>
                  <Select.Option value="approve">Auto-Approve</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="condition_json" label="Condition (JSON)">
            <Input.TextArea rows={3} placeholder='e.g. {"keywords": ["spam", "scam"]}' />
          </Form.Item>
          <Form.Item name="enabled" label="Enabled" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Preset Modal ─────────────────────────────────────────── */}
      <Modal open={presetModal} title={editingPreset ? "Edit Preset" : "Create Preset"} onCancel={() => setPresetModal(false)} onOk={savePreset} okText="Save" width={600}>
        <Form form={presetForm} layout="vertical">
          <Form.Item name="name" label="Preset Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Standard Coach Campaign" />
          </Form.Item>
          <Form.Item name="preset_type" label="Type" initialValue="campaign">
            <Select>
              <Select.Option value="campaign">Campaign</Select.Option>
              <Select.Option value="ad_set">Ad Set</Select.Option>
              <Select.Option value="creative">Creative</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="config_json" label="Configuration (JSON)">
            <Input.TextArea rows={4} placeholder='e.g. {"objective": "coaching", "daily_budget": 50}' />
          </Form.Item>
          <Form.Item name="is_default" label="Default" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
