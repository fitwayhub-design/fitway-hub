import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Button, Tabs, Tag, Spin, Modal, Form, Input, Select,
  message, Statistic, Row, Col, Space, Badge, Tooltip, Typography, Descriptions,
} from 'antd';
import {
  DashboardOutlined, AuditOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FlagOutlined, EyeOutlined, PauseCircleOutlined, PlayCircleOutlined,
  StopOutlined, BarChartOutlined,
} from '@ant-design/icons';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';
import { getApiBase } from '@/lib/api';

const { Title, Text } = Typography;
const API = getApiBase();

const STATUS_COLORS: Record<string, string> = {
  active: 'green', paused: 'orange', draft: 'default', pending_review: 'blue',
  rejected: 'red', archived: 'gray', expired: 'volcano',
};

export default function AdminAdsManager() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const [overview, setOverview] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [campaignFilter, setCampaignFilter] = useState<string | null>(null);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [campaignDetailModal, setCampaignDetailModal] = useState<any>(null);
  const [auditPage, setAuditPage] = useState(1);
  const [reviewForm] = Form.useForm();

  const fetchOverview = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ads-manager/overview`, { headers });
      setOverview(res.data);
    } catch {}
  }, [token]);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};
      if (campaignFilter) params.status = campaignFilter;
      const res = await axios.get(`${API}/api/ads-manager/campaigns`, { headers, params });
      setCampaigns(res.data.campaigns || []);
    } finally { setLoading(false); }
  }, [token, campaignFilter]);

  const fetchPending = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ad-moderation`, { headers, params: { status: 'pending' } });
      setPending(res.data.reviews || []);
    } catch {}
  }, [token]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ad-moderation/stats/summary`, { headers });
      setStats(res.data);
    } catch {}
  }, [token]);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ads-manager/audit`, { headers, params: { page: auditPage } });
      setAuditLogs(res.data.logs || []);
    } catch {}
  }, [token, auditPage]);

  useEffect(() => { fetchOverview(); fetchCampaigns(); fetchPending(); fetchStats(); fetchAudit(); }, []);
  useEffect(() => { fetchCampaigns(); }, [campaignFilter]);
  useEffect(() => { fetchAudit(); }, [auditPage]);

  function refreshAll() { fetchOverview(); fetchCampaigns(); fetchPending(); fetchStats(); fetchAudit(); }

  async function campaignAction(id: number, action: string, note?: string) {
    try {
      const res = await axios.patch(`${API}/api/ads-manager/campaigns/${id}/action`, { action, note }, { headers });
      message.success(`Campaign ${action}d`);
      // Optimistic update for instant feedback
      const newStatus = res.data?.campaign?.status;
      if (newStatus) {
        setCampaigns(prev => prev.map(c => c.id === id ? { ...c, status: newStatus } : c));
      }
      await Promise.all([fetchOverview(), fetchCampaigns(), fetchPending(), fetchStats(), fetchAudit()]);
    } catch (e: any) { message.error(e?.response?.data?.message || 'Action failed'); }
  }

  async function openReviewDetail(reviewId: number) {
    try {
      const res = await axios.get(`${API}/api/ad-moderation/${reviewId}`, { headers });
      setSelectedReview(res.data);
      reviewForm.resetFields();
      setReviewModalOpen(true);
    } catch { message.error('Failed to load review'); }
  }

  async function submitReviewAction() {
    try {
      const vals = await reviewForm.validateFields();
      await axios.patch(`${API}/api/ad-moderation/${selectedReview.review.id}`, {
        action: vals.action, notes: vals.notes,
      }, { headers });
      message.success('Review updated');
      setReviewModalOpen(false);
      await Promise.all([fetchOverview(), fetchCampaigns(), fetchPending(), fetchStats(), fetchAudit()]);
    } catch (e: any) { message.error(e?.response?.data?.message || 'Failed'); }
  }

  async function openCampaignDetail(campaignId: number) {
    try {
      const res = await axios.get(`${API}/api/ads/campaigns/${campaignId}`, { headers });
      setCampaignDetailModal(res.data);
    } catch { message.error('Failed to load campaign details'); }
  }

  const campaignColumns = [
    { title: 'Name', dataIndex: 'name', key: 'name', render: (v: any, r: any) => (
      <a onClick={() => openCampaignDetail(r.id)}><Text strong>{v}</Text></a>
    )},
    { title: 'Coach', dataIndex: 'coach_name', key: 'coach' },
    { title: 'Objective', dataIndex: 'objective', key: 'objective', render: (v: any) => <Tag>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (v: any) => <Tag color={STATUS_COLORS[v] || 'default'}>{v}</Tag> },
    { title: 'Budget', key: 'budget', render: (_: any, r: any) => {
      const b = r.daily_budget || r.budget_total || 0;
      return `${Number(b).toFixed(2)} EGP`;
    }},
    { title: 'Impressions', dataIndex: 'impressions', key: 'impressions', render: (v: any) => v || 0 },
    { title: 'Clicks', dataIndex: 'clicks', key: 'clicks', render: (v: any) => v || 0 },
    { title: 'Created', dataIndex: 'created_at', key: 'created', render: (v: any) => v ? new Date(v).toLocaleDateString() : '-' },
    { title: 'Actions', key: 'actions', render: (_: any, r: any) => (
      <Space size="small">
        {r.status === 'pending_review' && (
          <>
            <Tooltip title="Approve"><Button type="primary" size="small" icon={<CheckCircleOutlined />} onClick={() => campaignAction(r.id, 'approve')} /></Tooltip>
            <Tooltip title="Reject"><Button danger size="small" icon={<CloseCircleOutlined />} onClick={() => campaignAction(r.id, 'reject')} /></Tooltip>
          </>
        )}
        {r.status === 'active' && (
          <Tooltip title="Pause"><Button size="small" icon={<PauseCircleOutlined />} onClick={() => campaignAction(r.id, 'pause')} /></Tooltip>
        )}
        {r.status === 'paused' && (
          <Tooltip title="Resume"><Button size="small" icon={<PlayCircleOutlined />} onClick={() => campaignAction(r.id, 'resume')} /></Tooltip>
        )}
        {!['archived'].includes(r.status) && (
          <Tooltip title="Archive"><Button size="small" icon={<StopOutlined />} onClick={() => campaignAction(r.id, 'archive')} /></Tooltip>
        )}
      </Space>
    )},
  ];

  const pendingColumns = [
    { title: 'Campaign', dataIndex: 'campaign_name', key: 'campaign', render: (v: any, r: any) => (
      <a onClick={() => openReviewDetail(r.id)}><Text strong>{v}</Text></a>
    )},
    { title: 'Coach', dataIndex: 'coach_name', key: 'coach' },
    { title: 'Email', dataIndex: 'coach_email', key: 'email' },
    { title: 'Objective', dataIndex: 'objective', key: 'objective', render: (v: any) => <Tag>{v}</Tag> },
    { title: 'Budget', key: 'budget', render: (_: any, r: any) => `${r.daily_budget || 0} / ${r.lifetime_budget || 0} EGP` },
    { title: 'Submitted', dataIndex: 'created_at', key: 'created', render: (v: any) => v ? new Date(v).toLocaleDateString() : '-' },
    { title: 'Actions', key: 'actions', render: (_: any, r: any) => (
      <Space>
        <Button type="primary" size="small" onClick={() => openReviewDetail(r.id)} icon={<EyeOutlined />}>Review</Button>
        <Button size="small" onClick={() => campaignAction(r.campaign_id, 'approve')}>Quick Approve</Button>
        <Button danger size="small" onClick={() => campaignAction(r.campaign_id, 'reject')}>Reject</Button>
      </Space>
    )},
  ];

  const auditColumns = [
    { title: 'When', dataIndex: 'created_at', key: 'when', render: (v: any) => v ? new Date(v).toLocaleString() : '-' },
    { title: 'Actor', dataIndex: 'actor_name', key: 'actor', render: (v: any) => v || 'System' },
    { title: 'Action', dataIndex: 'action', key: 'action', render: (v: any) => <Tag color="processing">{v}</Tag> },
    { title: 'Entity', dataIndex: 'entity_type', key: 'entity' },
    { title: 'Entity ID', dataIndex: 'entity_id', key: 'eid' },
    { title: 'Details', dataIndex: 'details', key: 'details', ellipsis: true, render: (v: any) => {
      if (!v) return '-';
      try { return <Text code>{typeof v === 'string' ? v : JSON.stringify(v)}</Text>; } catch { return '-'; }
    }},
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={2} style={{ marginBottom: 24 }}>
        <DashboardOutlined /> Ads Manager
      </Title>

      {/* Overview Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="Total Campaigns" value={overview?.campaigns || 0} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="Active" value={overview?.active || 0} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card>
            <Badge count={overview?.pending || 0} offset={[10, 0]}>
              <Statistic title="Pending Review" value={overview?.pending || 0} valueStyle={{ color: '#1890ff' }} />
            </Badge>
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="Events Today" value={overview?.events_today || 0} prefix={<BarChartOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card><Statistic title="Spend Today" value={overview?.spend_today || 0} suffix="EGP" precision={2} /></Card>
        </Col>
        {stats?.totals && (
          <Col xs={12} sm={8} lg={4}>
            <Card><Statistic title="Auto-Flagged" value={stats.totals.auto_flagged || 0} valueStyle={{ color: '#faad14' }} prefix={<FlagOutlined />} /></Card>
          </Col>
        )}
      </Row>

      {/* Main Tabs */}
      <Tabs defaultActiveKey="campaigns" items={[
        {
          key: 'campaigns',
          label: `All Campaigns (${campaigns.length})`,
          children: (
            <>
              <Space style={{ marginBottom: 16 }}>
                <Select value={campaignFilter} onChange={setCampaignFilter} allowClear placeholder="Filter by status" style={{ width: 180 }}>
                  {['draft','pending_review','active','paused','rejected','archived','expired'].map(s =>
                    <Select.Option key={s} value={s}>{s}</Select.Option>
                  )}
                </Select>
                <Button onClick={() => { setCampaignFilter(null); fetchCampaigns(); }}>Reset</Button>
              </Space>
              <Table dataSource={campaigns} rowKey="id" loading={loading} columns={campaignColumns}
                pagination={{ pageSize: 15, showSizeChanger: true, showTotal: (t) => `${t} campaigns` }} />
            </>
          ),
        },
        {
          key: 'pending',
          label: <Badge count={pending.length} offset={[10, 0]}>Pending Reviews</Badge>,
          children: (
            <Table dataSource={pending} rowKey="id" columns={pendingColumns}
              locale={{ emptyText: 'No pending reviews' }}
              pagination={{ pageSize: 10 }} />
          ),
        },
        {
          key: 'moderation',
          label: 'Moderation Stats',
          children: (
            <Row gutter={[16, 16]}>
              <Col span={6}><Card><Statistic title="Total Reviews" value={stats?.totals?.total || 0} /></Card></Col>
              <Col span={6}><Card><Statistic title="Approved" value={stats?.totals?.approved || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="Rejected" value={stats?.totals?.rejected || 0} valueStyle={{ color: '#ff4d4f' }} /></Card></Col>
              <Col span={6}><Card><Statistic title="Flagged" value={stats?.totals?.flagged || 0} valueStyle={{ color: '#faad14' }} /></Card></Col>
              <Col span={24}>
                <Card title="Recent Moderation Activity">
                  <Table dataSource={stats?.recent || []} rowKey="id" pagination={false} size="small" columns={[
                    { title: 'Campaign', dataIndex: 'campaign_name' },
                    { title: 'Coach', dataIndex: 'coach_name' },
                    { title: 'Status', dataIndex: 'status', render: (v: any) => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
                    { title: 'Resolved', dataIndex: 'resolved_at', render: (v: any) => v ? new Date(v).toLocaleString() : '-' },
                  ]} />
                </Card>
              </Col>
            </Row>
          ),
        },
        {
          key: 'audit',
          label: <><AuditOutlined /> Audit Logs</>,
          children: (
            <Table dataSource={auditLogs} rowKey="id" columns={auditColumns}
              pagination={{ pageSize: 50, current: auditPage, onChange: setAuditPage, showTotal: (t) => `${t} entries` }} />
          ),
        },
      ]} />

      {/* Review Detail Modal */}
      <Modal open={reviewModalOpen} onCancel={() => setReviewModalOpen(false)} onOk={submitReviewAction}
        title="Campaign Review" width={700} okText="Submit Review">
        {selectedReview ? (
          <div>
            <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Campaign">{selectedReview.review?.name || selectedReview.review?.campaign_name}</Descriptions.Item>
              <Descriptions.Item label="Coach">{selectedReview.review?.coach_name} ({selectedReview.review?.coach_email})</Descriptions.Item>
              <Descriptions.Item label="Objective">{selectedReview.review?.objective}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLORS[selectedReview.review?.campaign_status]}>{selectedReview.review?.campaign_status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Daily Budget">{selectedReview.review?.daily_budget || 0} EGP</Descriptions.Item>
              <Descriptions.Item label="Lifetime Budget">{selectedReview.review?.lifetime_budget || 0} EGP</Descriptions.Item>
            </Descriptions>

            {selectedReview.adSets?.length > 0 && (
              <Card title="Ad Sets" size="small" style={{ marginBottom: 12 }}>
                <Table dataSource={selectedReview.adSets} rowKey="id" size="small" pagination={false} columns={[
                  { title: 'Name', dataIndex: 'name' },
                  { title: 'Placement', dataIndex: 'placement' },
                  { title: 'Budget', dataIndex: 'daily_budget', render: (v: any) => `${v || 0} EGP` },
                ]} />
              </Card>
            )}
            {selectedReview.ads?.length > 0 && (
              <Card title="Ads" size="small" style={{ marginBottom: 12 }}>
                <Table dataSource={selectedReview.ads} rowKey="id" size="small" pagination={false} columns={[
                  { title: 'Name', dataIndex: 'name' },
                  { title: 'Headline', dataIndex: 'headline' },
                  { title: 'CTA', dataIndex: 'cta' },
                ]} />
              </Card>
            )}

            <Form form={reviewForm} layout="vertical" style={{ marginTop: 12 }}>
              <Form.Item name="action" label="Moderation Decision" rules={[{ required: true, message: 'Select an action' }]}>
                <Select placeholder="Choose action">
                  <Select.Option value="approve"><CheckCircleOutlined style={{ color: '#52c41a' }} /> Approve</Select.Option>
                  <Select.Option value="reject"><CloseCircleOutlined style={{ color: '#ff4d4f' }} /> Reject</Select.Option>
                  <Select.Option value="flag"><FlagOutlined style={{ color: '#faad14' }} /> Flag for Later</Select.Option>
                  <Select.Option value="needs_changes">Needs Changes</Select.Option>
                </Select>
              </Form.Item>
              <Form.Item name="notes" label="Notes/Reason"><Input.TextArea rows={3} placeholder="Optional notes for the coach..." /></Form.Item>
            </Form>
          </div>
        ) : <Spin />}
      </Modal>

      {/* Campaign Detail Modal */}
      <Modal open={!!campaignDetailModal} onCancel={() => setCampaignDetailModal(null)}
        title="Campaign Details" width={700} footer={null}>
        {campaignDetailModal && (
          <div>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="Name">{campaignDetailModal.campaign?.name}</Descriptions.Item>
              <Descriptions.Item label="Objective">{campaignDetailModal.campaign?.objective}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLORS[campaignDetailModal.campaign?.status]}>{campaignDetailModal.campaign?.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="Daily Budget">{campaignDetailModal.campaign?.daily_budget || 0} EGP</Descriptions.Item>
              <Descriptions.Item label="Lifetime Budget">{campaignDetailModal.campaign?.lifetime_budget || 0} EGP</Descriptions.Item>
              <Descriptions.Item label="Created">{campaignDetailModal.campaign?.created_at ? new Date(campaignDetailModal.campaign.created_at).toLocaleDateString() : '-'}</Descriptions.Item>
            </Descriptions>

            {campaignDetailModal.adSets?.length > 0 && (
              <Card title={`Ad Sets (${campaignDetailModal.adSets.length})`} size="small" style={{ marginTop: 16 }}>
                <Table dataSource={campaignDetailModal.adSets} rowKey="id" size="small" pagination={false} columns={[
                  { title: 'Name', dataIndex: 'name' },
                  { title: 'Placement', dataIndex: 'placement' },
                  { title: 'Target', render: (_: any, r: any) => `${r.target_gender || 'all'}, ${r.target_age_min || 18}-${r.target_age_max || 65}` },
                  { title: 'Budget', dataIndex: 'daily_budget', render: (v: any) => `${v || 0} EGP` },
                ]} />
              </Card>
            )}
            {campaignDetailModal.ads?.length > 0 && (
              <Card title={`Ads (${campaignDetailModal.ads.length})`} size="small" style={{ marginTop: 12 }}>
                <Table dataSource={campaignDetailModal.ads} rowKey="id" size="small" pagination={false} columns={[
                  { title: 'Name', dataIndex: 'name' },
                  { title: 'Headline', dataIndex: 'headline' },
                  { title: 'Status', dataIndex: 'status', render: (v: any) => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
                  { title: 'Impressions', dataIndex: 'impressions', render: (v: any) => v || 0 },
                  { title: 'Clicks', dataIndex: 'clicks', render: (v: any) => v || 0 },
                ]} />
              </Card>
            )}

            <Space style={{ marginTop: 16 }}>
              {campaignDetailModal.campaign?.status === 'pending_review' && (
                <>
                  <Button type="primary" onClick={() => { campaignAction(campaignDetailModal.campaign.id, 'approve'); setCampaignDetailModal(null); }}>Approve</Button>
                  <Button danger onClick={() => { campaignAction(campaignDetailModal.campaign.id, 'reject'); setCampaignDetailModal(null); }}>Reject</Button>
                </>
              )}
              {campaignDetailModal.campaign?.status === 'active' && (
                <Button onClick={() => { campaignAction(campaignDetailModal.campaign.id, 'pause'); setCampaignDetailModal(null); }}>Pause</Button>
              )}
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
}

