import React, { useEffect, useState, useCallback } from "react";
import {
  Button, Card, Table, Modal, Input, Select, DatePicker,
  message, Tabs, Form, Row, Col, Statistic, Tag, Space, Typography,
  InputNumber, Empty, Tooltip,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  RocketOutlined, EyeOutlined, WalletOutlined, BarChartOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { getApiBase } from "@/lib/api";
import {
  LineChart, Line as RLine, XAxis, YAxis, CartesianGrid,
  Tooltip as RTooltip, ResponsiveContainer, Legend,
} from "recharts";

const { Title, Text } = Typography;
const API = getApiBase();

const STATUS_COLORS: Record<string, string> = {
  active: "green", paused: "orange", draft: "default", pending_review: "blue",
  rejected: "red", archived: "gray", expired: "volcano",
};

export default function CoachAdsManager() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [creatives, setCreatives] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [walletLedger, setWalletLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [campaignAdSets, setCampaignAdSets] = useState<any[]>([]);

  const [campaignModal, setCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [adSetModal, setAdSetModal] = useState(false);
  const [editingAdSet, setEditingAdSet] = useState<any>(null);
  const [adModal, setAdModal] = useState(false);
  const [creativeModal, setCreativeModal] = useState(false);

  const [campaignForm] = Form.useForm();
  const [adSetForm] = Form.useForm();
  const [adForm] = Form.useForm();
  const [creativeForm] = Form.useForm();

  /* ── Fetchers ─────────────────────────────────────────────────── */

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/ads/campaigns`, { headers });
      setCampaigns(res.data.campaigns || []);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [token]);

  const fetchAds = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ads-manager/ads`, { headers });
      setAds(res.data.ads || []);
    } catch {}
  }, [token]);

  const fetchCreatives = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ads/creatives`, { headers });
      setCreatives(res.data.creatives || []);
    } catch {}
  }, [token]);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ads/analytics/summary`, { headers });
      setAnalytics(res.data);
    } catch {}
  }, [token]);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ads/wallet`, { headers });
      setWallet(res.data.wallet);
      setWalletLedger(res.data.ledger || []);
    } catch {}
  }, [token]);

  const fetchCampaignAdSets = useCallback(async (campaignId: number) => {
    try {
      const res = await axios.get(`${API}/api/ads/campaigns/${campaignId}/ad-sets`, { headers });
      setCampaignAdSets(res.data.adSets || []);
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchCampaigns();
    fetchAds();
    fetchCreatives();
    fetchAnalytics();
    fetchWallet();
  }, []);

  useEffect(() => {
    if (selectedCampaign) fetchCampaignAdSets(selectedCampaign.id);
  }, [selectedCampaign]);

  /* ── Campaign CRUD ────────────────────────────────────────────── */

  function openCreateCampaign() {
    setEditingCampaign(null);
    campaignForm.resetFields();
    setCampaignModal(true);
  }

  function openEditCampaign(c: any) {
    setEditingCampaign(c);
    campaignForm.setFieldsValue({
      name: c.name,
      objective: c.objective,
      daily_budget: c.daily_budget,
      lifetime_budget: c.lifetime_budget,
      budget_type: c.budget_type || "daily",
    });
    setCampaignModal(true);
  }

  async function saveCampaign() {
    try {
      const vals = await campaignForm.validateFields();
      const payload: any = {
        name: vals.name,
        objective: vals.objective || "coaching",
        daily_budget: vals.daily_budget || 0,
        lifetime_budget: vals.lifetime_budget || 0,
        budget_type: vals.budget_type || "daily",
      };
      if (vals.schedule?.[0]) payload.schedule_start = vals.schedule[0].format?.("YYYY-MM-DD") || vals.schedule[0];
      if (vals.schedule?.[1]) payload.schedule_end = vals.schedule[1].format?.("YYYY-MM-DD") || vals.schedule[1];

      if (editingCampaign) {
        await axios.patch(`${API}/api/ads/campaigns/${editingCampaign.id}`, payload, { headers });
        message.success("Campaign updated");
      } else {
        await axios.post(`${API}/api/ads/campaigns`, payload, { headers });
        message.success("Campaign created");
      }
      setCampaignModal(false);
      fetchCampaigns();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Save failed");
    }
  }

  async function deleteCampaign(id: number) {
    Modal.confirm({
      title: "Delete campaign?",
      content: "This will permanently delete the campaign and all its ad sets.",
      onOk: async () => {
        try {
          await axios.delete(`${API}/api/ads/campaigns/${id}`, { headers });
          message.success("Campaign deleted");
          fetchCampaigns();
        } catch (e: any) {
          message.error(e?.response?.data?.message || "Delete failed");
        }
      },
    });
  }

  /* ── Ad Set CRUD ──────────────────────────────────────────────── */

  function openCreateAdSet() {
    if (!selectedCampaign) { message.info("Select a campaign first"); return; }
    setEditingAdSet(null);
    adSetForm.resetFields();
    adSetForm.setFieldsValue({ campaignId: selectedCampaign.id });
    setAdSetModal(true);
  }

  function openEditAdSet(s: any) {
    setEditingAdSet(s);
    adSetForm.setFieldsValue({
      campaignId: s.campaign_id,
      name: s.name, placement: s.placement,
      target_gender: s.target_gender, target_age_min: s.target_age_min,
      target_age_max: s.target_age_max, daily_budget: s.daily_budget,
    });
    setAdSetModal(true);
  }

  async function saveAdSet() {
    try {
      const vals = await adSetForm.validateFields();
      const payload = {
        name: vals.name, placement: vals.placement || "feed",
        target_gender: vals.target_gender || "all",
        target_age_min: vals.target_age_min || 18,
        target_age_max: vals.target_age_max || 65,
        daily_budget: vals.daily_budget || 0,
      };
      if (editingAdSet) {
        await axios.patch(`${API}/api/ads/ad-sets/${editingAdSet.id}`, payload, { headers });
        message.success("Ad set updated");
      } else {
        await axios.post(`${API}/api/ads/campaigns/${vals.campaignId}/ad-sets`, payload, { headers });
        message.success("Ad set created");
      }
      setAdSetModal(false);
      if (selectedCampaign) fetchCampaignAdSets(selectedCampaign.id);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Save failed");
    }
  }

  async function deleteAdSet(id: number) {
    try {
      await axios.delete(`${API}/api/ads/ad-sets/${id}`, { headers });
      message.success("Ad set deleted");
      if (selectedCampaign) fetchCampaignAdSets(selectedCampaign.id);
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Delete failed");
    }
  }

  /* ── Ad CRUD ──────────────────────────────────────────────────── */

  function openCreateAd() {
    if (!selectedCampaign) { message.info("Select a campaign first"); return; }
    adForm.resetFields();
    adForm.setFieldsValue({ campaign_id: selectedCampaign.id });
    setAdModal(true);
  }

  async function saveAd() {
    try {
      const vals = await adForm.validateFields();
      await axios.post(
        `${API}/api/ads/ad-sets/${vals.ad_set_id}/ads`,
        { name: vals.name, creative_id: vals.creative_id, headline: vals.headline, body: vals.body, cta: vals.cta, campaign_id: vals.campaign_id },
        { headers },
      );
      message.success("Ad created");
      setAdModal(false);
      fetchAds();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Create failed");
    }
  }

  async function deleteAd(id: number) {
    try {
      await axios.delete(`${API}/api/ads/ads/${id}`, { headers });
      message.success("Ad deleted");
      fetchAds();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Delete failed");
    }
  }

  /* ── Creative ─────────────────────────────────────────────────── */

  async function saveCreative() {
    try {
      const vals = await creativeForm.validateFields();
      await axios.post(`${API}/api/ads/creatives`, { name: vals.name, format: vals.format || "image", media_url: vals.media_url }, { headers });
      message.success("Creative created");
      setCreativeModal(false);
      fetchCreatives();
    } catch (e: any) {
      message.error(e?.response?.data?.message || "Create failed");
    }
  }

  /* ── Analytics chart data ─────────────────────────────────────── */

  const chartData = analytics?.byDay?.reduce((acc: any[], row: any) => {
    let day = acc.find((d: any) => d.day === row.day);
    if (!day) { day = { day: row.day }; acc.push(day); }
    day[row.event_type] = row.cnt;
    return acc;
  }, []) || [];

  /* ── Render ───────────────────────────────────────────────────── */

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}><RocketOutlined /> Ads Manager</Title>

      {/* Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Campaigns" value={analytics?.totals?.total_campaigns || campaigns.length} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Active" value={analytics?.totals?.active_campaigns || 0} valueStyle={{ color: "#52c41a" }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Impressions" value={analytics?.totals?.total_impressions || 0} prefix={<EyeOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Clicks" value={analytics?.totals?.total_clicks || 0} prefix={<BarChartOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Conversions" value={analytics?.totals?.total_conversions || 0} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Total Spent" value={analytics?.totals?.total_spent || 0} suffix="EGP" precision={2} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Wallet Balance" value={wallet?.balance || 0} prefix={<WalletOutlined />} suffix="EGP" precision={2} valueStyle={{ color: "#1890ff" }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card><Statistic title="Lifetime Spent" value={wallet?.lifetime_spent || 0} suffix="EGP" precision={2} /></Card>
        </Col>
      </Row>

      {/* Main Tabs */}
      <Tabs defaultActiveKey="campaigns" items={[
        {
          key: "campaigns",
          label: `Campaigns (${campaigns.length})`,
          children: (
            <>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateCampaign} style={{ marginBottom: 16 }}>
                Create Campaign
              </Button>
              <Table dataSource={campaigns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} columns={[
                { title: "Name", dataIndex: "name", render: (v: any, r: any) => (
                  <a onClick={() => setSelectedCampaign(r)}><Text strong>{v}</Text></a>
                )},
                { title: "Objective", dataIndex: "objective", render: (v: any) => <Tag>{v}</Tag> },
                { title: "Status", dataIndex: "status", render: (v: any) => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
                { title: "Budget", key: "budget", render: (_: any, r: any) => `${r.daily_budget || r.budget_total || 0} EGP (${r.budget_type || "daily"})` },
                { title: "Created", dataIndex: "created_at", render: (v: any) => v ? new Date(v).toLocaleDateString() : "-" },
                { title: "Actions", key: "actions", render: (_: any, r: any) => (
                  <Space size="small">
                    <Tooltip title="Edit"><Button size="small" icon={<EditOutlined />} onClick={() => openEditCampaign(r)} /></Tooltip>
                    <Tooltip title="View Ad Sets"><Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedCampaign(r)} /></Tooltip>
                    <Tooltip title="Delete"><Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteCampaign(r.id)} /></Tooltip>
                  </Space>
                )},
              ]} />

              {selectedCampaign && (
                <Card title={`Ad Sets for: ${selectedCampaign.name}`} style={{ marginTop: 16 }}
                  extra={<Space>
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreateAdSet}>Add Ad Set</Button>
                    <Button size="small" icon={<PlusOutlined />} onClick={openCreateAd}>Add Ad</Button>
                    <Button size="small" onClick={() => setSelectedCampaign(null)}>Close</Button>
                  </Space>}>
                  <Table dataSource={campaignAdSets} rowKey="id" size="small" pagination={false} columns={[
                    { title: "Name", dataIndex: "name" },
                    { title: "Placement", dataIndex: "placement", render: (v: any) => <Tag>{v}</Tag> },
                    { title: "Target", render: (_: any, r: any) => `${r.target_gender || "all"}, ${r.target_age_min || 18}-${r.target_age_max || 65}` },
                    { title: "Budget", dataIndex: "daily_budget", render: (v: any) => `${v || 0} EGP/day` },
                    { title: "Actions", render: (_: any, r: any) => (
                      <Space size="small">
                        <Button size="small" icon={<EditOutlined />} onClick={() => openEditAdSet(r)} />
                        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteAdSet(r.id)} />
                      </Space>
                    )},
                  ]} />
                </Card>
              )}
            </>
          ),
        },
        {
          key: "ads",
          label: `Ads (${ads.length})`,
          children: (
            <>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAd} style={{ marginBottom: 16 }}>Create Ad</Button>
              <Table dataSource={ads} rowKey="id" pagination={{ pageSize: 10 }} columns={[
                { title: "Name", dataIndex: "name" },
                { title: "Campaign", dataIndex: "campaign_name" },
                { title: "Ad Set", dataIndex: "ad_set_name" },
                { title: "Headline", dataIndex: "headline" },
                { title: "Status", dataIndex: "status", render: (v: any) => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
                { title: "Impressions", dataIndex: "impressions", render: (v: any) => v || 0 },
                { title: "Clicks", dataIndex: "clicks", render: (v: any) => v || 0 },
                { title: "CTR", dataIndex: "ctr", render: (v: any) => v ? `${(Number(v) * 100).toFixed(2)}%` : "-" },
                { title: "Actions", render: (_: any, r: any) => (
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteAd(r.id)} />
                )},
              ]} />
            </>
          ),
        },
        {
          key: "creatives",
          label: `Creatives (${creatives.length})`,
          children: (
            <>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => { creativeForm.resetFields(); setCreativeModal(true); }} style={{ marginBottom: 16 }}>
                Add Creative
              </Button>
              <Table dataSource={creatives} rowKey="id" pagination={{ pageSize: 10 }} columns={[
                { title: "ID", dataIndex: "id", width: 60 },
                { title: "Name", dataIndex: "name" },
                { title: "Format", dataIndex: "format", render: (v: any) => <Tag>{v || "image"}</Tag> },
                { title: "Preview", dataIndex: "media_url", render: (v: any) => v ? <img src={v} style={{ height: 40, borderRadius: 4 }} alt="" /> : "-" },
                { title: "Status", dataIndex: "status", render: (v: any) => <Tag color={v === "active" ? "green" : "default"}>{v}</Tag> },
                { title: "Created", dataIndex: "created_at", render: (v: any) => v ? new Date(v).toLocaleDateString() : "-" },
              ]} />
            </>
          ),
        },
        {
          key: "analytics",
          label: <><BarChartOutlined /> Analytics</>,
          children: (
            <div>
              <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                <Col span={6}><Card><Statistic title="Total Impressions" value={analytics?.totals?.total_impressions || 0} /></Card></Col>
                <Col span={6}><Card><Statistic title="Total Clicks" value={analytics?.totals?.total_clicks || 0} /></Card></Col>
                <Col span={6}><Card><Statistic title="Total Conversions" value={analytics?.totals?.total_conversions || 0} /></Card></Col>
                <Col span={6}><Card><Statistic title="Total Spent" value={analytics?.totals?.total_spent || 0} suffix="EGP" precision={2} /></Card></Col>
              </Row>

              <Card title="Events Over Time" style={{ marginBottom: 16 }}>
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="day" />
                      <YAxis />
                      <RTooltip />
                      <Legend />
                      <RLine type="monotone" dataKey="impression" stroke="#1890ff" name="Impressions" />
                      <RLine type="monotone" dataKey="click" stroke="#52c41a" name="Clicks" />
                      <RLine type="monotone" dataKey="save" stroke="#faad14" name="Saves" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <Empty description="No event data yet" />}
              </Card>

              {analytics?.topAds?.length > 0 && (
                <Card title="Top Performing Ads">
                  <Table dataSource={analytics.topAds} rowKey="id" pagination={false} size="small" columns={[
                    { title: "Ad", dataIndex: "name" },
                    { title: "Campaign", dataIndex: "campaign_name" },
                    { title: "Impressions", dataIndex: "impressions" },
                    { title: "Clicks", dataIndex: "clicks" },
                    { title: "Conversions", dataIndex: "conversions" },
                    { title: "CTR", dataIndex: "ctr", render: (v: any) => v ? `${(Number(v) * 100).toFixed(2)}%` : "-" },
                  ]} />
                </Card>
              )}
            </div>
          ),
        },
        {
          key: "wallet",
          label: <><WalletOutlined /> Wallet</>,
          children: (
            <div>
              <Row gutter={16} style={{ marginBottom: 16 }}>
                <Col span={8}><Card><Statistic title="Balance" value={wallet?.balance || 0} suffix="EGP" precision={2} valueStyle={{ color: "#1890ff" }} /></Card></Col>
                <Col span={8}><Card><Statistic title="Lifetime Spent" value={wallet?.lifetime_spent || 0} suffix="EGP" precision={2} /></Card></Col>
              </Row>
              <Card title="Transaction History">
                <Table dataSource={walletLedger} rowKey="id" pagination={{ pageSize: 15 }} columns={[
                  { title: "Date", dataIndex: "created_at", render: (v: any) => v ? new Date(v).toLocaleString() : "-" },
                  { title: "Type", dataIndex: "entry_type", render: (v: any) => <Tag color={v === "credit" ? "green" : v === "debit" ? "red" : "blue"}>{v}</Tag> },
                  { title: "Amount", dataIndex: "amount", render: (v: any) => `${v} EGP` },
                  { title: "Balance After", dataIndex: "balance_after", render: (v: any) => `${v} EGP` },
                  { title: "Note", dataIndex: "note" },
                ]} />
              </Card>
            </div>
          ),
        },
      ]} />

      {/* ── Campaign Modal ───────────────────────────────────────── */}
      <Modal open={campaignModal} title={editingCampaign ? "Edit Campaign" : "Create Campaign"}
        onCancel={() => setCampaignModal(false)} onOk={saveCampaign} okText="Save" width={600}>
        <Form form={campaignForm} layout="vertical">
          <Form.Item name="name" label="Campaign Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Summer Promotion" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="objective" label="Objective" initialValue="coaching">
                <Select>
                  {["coaching","awareness","traffic","engagement","bookings","announcements"].map(o =>
                    <Select.Option key={o} value={o}>{o.charAt(0).toUpperCase() + o.slice(1)}</Select.Option>
                  )}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="budget_type" label="Budget Type" initialValue="daily">
                <Select>
                  <Select.Option value="daily">Daily</Select.Option>
                  <Select.Option value="lifetime">Lifetime</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="daily_budget" label="Daily Budget (EGP)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="lifetime_budget" label="Lifetime Budget (EGP)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="schedule" label="Schedule">
            <DatePicker.RangePicker style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Ad Set Modal ─────────────────────────────────────────── */}
      <Modal open={adSetModal} title={editingAdSet ? "Edit Ad Set" : "Create Ad Set"}
        onCancel={() => setAdSetModal(false)} onOk={saveAdSet} okText="Save" width={600}>
        <Form form={adSetForm} layout="vertical">
          <Form.Item name="campaignId" hidden><Input /></Form.Item>
          <Form.Item name="name" label="Ad Set Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Male 25-35 Feed" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="placement" label="Placement" initialValue="feed">
                <Select>
                  {["feed","home_banner","community","search","profile_boost","notification","discovery","all"].map(p =>
                    <Select.Option key={p} value={p}>{p.replace(/_/g, " ")}</Select.Option>
                  )}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="target_gender" label="Target Gender" initialValue="all">
                <Select>
                  <Select.Option value="all">All</Select.Option>
                  <Select.Option value="male">Male</Select.Option>
                  <Select.Option value="female">Female</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="target_age_min" label="Min Age" initialValue={18}>
                <InputNumber min={13} max={100} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="target_age_max" label="Max Age" initialValue={65}>
                <InputNumber min={13} max={100} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="daily_budget" label="Daily Budget (EGP)">
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Ad Modal ─────────────────────────────────────────────── */}
      <Modal open={adModal} title="Create Ad" onCancel={() => setAdModal(false)} onOk={saveAd} okText="Create" width={600}>
        <Form form={adForm} layout="vertical">
          <Form.Item name="campaign_id" hidden><Input /></Form.Item>
          <Form.Item name="ad_set_id" label="Ad Set" rules={[{ required: true }]}>
            <Select placeholder="Select ad set">
              {campaignAdSets.map((s: any) => <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="name" label="Ad Name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="creative_id" label="Creative">
            <Select placeholder="Select creative" allowClear>
              {creatives.map((c: any) => <Select.Option key={c.id} value={c.id}>{c.name || `Creative #${c.id}`} ({c.format || "image"})</Select.Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="headline" label="Headline">
            <Input placeholder="e.g. Get Fit Today!" />
          </Form.Item>
          <Form.Item name="body" label="Body">
            <Input.TextArea rows={3} placeholder="Ad body text..." />
          </Form.Item>
          <Form.Item name="cta" label="Call to Action">
            <Input placeholder="e.g. Book Now" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Creative Modal ───────────────────────────────────────── */}
      <Modal open={creativeModal} title="Add Creative" onCancel={() => setCreativeModal(false)} onOk={saveCreative} okText="Save">
        <Form form={creativeForm} layout="vertical">
          <Form.Item name="name" label="Name" rules={[{ required: true }]}>
            <Input placeholder="Creative name" />
          </Form.Item>
          <Form.Item name="format" label="Format" initialValue="image">
            <Select>
              <Select.Option value="image">Image</Select.Option>
              <Select.Option value="video">Video</Select.Option>
              <Select.Option value="carousel">Carousel</Select.Option>
              <Select.Option value="text">Text Only</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="media_url" label="Media URL">
            <Input placeholder="https://..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
