import React, { useEffect, useState, useCallback } from "react";
import {
  Button, Card, Table, Modal, Input, Select, DatePicker,
  message, Form, Row, Col, Tag, Space, Typography,
  InputNumber, Tooltip, Upload, Divider, Steps, Slider,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  UploadOutlined, SearchOutlined, EnvironmentOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";
import MapLocationPicker from "@/components/app/MapLocationPicker";

const { Title, Text, Paragraph } = Typography;
const API = getApiBase();

const STATUS_COLORS: Record<string, string> = {
  active: "green", paused: "orange", draft: "default", pending_review: "blue",
  rejected: "red", archived: "gray", expired: "volcano",
};

const OBJECTIVES = [
  { value: "coaching", label: "🎯 Coaching (Bookings)" },
  { value: "awareness", label: "📢 Awareness" },
  { value: "traffic", label: "🔗 Traffic" },
  { value: "engagement", label: "💬 Engagement" },
  { value: "bookings", label: "📅 Bookings" },
  { value: "announcements", label: "📣 Announcements" },
];

const PLACEMENTS = [
  { value: "feed", label: "📱 Community Feed" },
  { value: "home_banner", label: "🏠 Home Banner" },
  { value: "search", label: "🔍 Search Results" },
  { value: "discovery", label: "🧭 Discovery Page" },
  { value: "profile_boost", label: "⭐ Profile Boost" },
  { value: "notification", label: "🔔 Notification" },
  { value: "all", label: "🌐 All Placements" },
];

const EGYPT_CITIES = [
  "Cairo","Giza","Alexandria","Sharm El Sheikh","Hurghada",
  "Luxor","Aswan","Mansoura","Tanta","Zagazig",
  "Ismailia","Suez","Port Said","Damietta","Fayoum",
  "Minya","Sohag","Qena","Beni Suef","6th October",
  "New Cairo","Nasr City","Maadi","Heliopolis","Dokki",
];

export default function CoachAdsCampaigns() {
  const { token } = useAuth();
  const { t } = useI18n();
  const headers = { Authorization: `Bearer ${token}` };

  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);
  const [campaignAds, setCampaignAds] = useState<any[]>([]);
  const [creatives, setCreatives] = useState<any[]>([]);

  const [campaignModal, setCampaignModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [adModal, setAdModal] = useState(false);
  const [editingAd, setEditingAd] = useState<any>(null);
  const [adStep, setAdStep] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [mapLat, setMapLat] = useState<number | null>(null);
  const [mapLng, setMapLng] = useState<number | null>(null);

  const [campaignForm] = Form.useForm();
  const [adForm] = Form.useForm();

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/ads/campaigns`, { headers });
      setCampaigns(res.data.campaigns || []);
    } catch {} finally { setLoading(false); }
  }, [token]);

  const fetchCreatives = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ads/creatives`, { headers });
      setCreatives(res.data.creatives || []);
    } catch {}
  }, [token]);

  const fetchCampaignAds = useCallback(async (campaignId: number) => {
    try {
      const setsRes = await axios.get(`${API}/api/ads/campaigns/${campaignId}/ad-sets`, { headers });
      const adSets = setsRes.data.adSets || [];
      const allAds: any[] = [];
      for (const s of adSets) {
        try {
          const adsRes = await axios.get(`${API}/api/ads/ad-sets/${s.id}/ads`, { headers });
          (adsRes.data.ads || []).forEach((a: any) => allAds.push({ ...a, ad_set_name: s.name, targeting: s }));
        } catch {}
      }
      setCampaignAds(allAds);
    } catch {}
  }, [token]);

  useEffect(() => { fetchCampaigns(); fetchCreatives(); }, []);
  useEffect(() => { if (selectedCampaign) fetchCampaignAds(selectedCampaign.id); }, [selectedCampaign]);

  // ── Campaign CRUD ──
  function openCreateCampaign() {
    setEditingCampaign(null); campaignForm.resetFields(); setCampaignModal(true);
  }
  function openEditCampaign(c: any) {
    setEditingCampaign(c);
    campaignForm.setFieldsValue({ name: c.name, objective: c.objective, daily_budget: c.daily_budget, lifetime_budget: c.lifetime_budget, budget_type: c.budget_type || "daily" });
    setCampaignModal(true);
  }
  async function saveCampaign() {
    try {
      const vals = await campaignForm.validateFields();
      const payload: any = { name: vals.name, objective: vals.objective || "coaching", daily_budget: vals.daily_budget || 0, lifetime_budget: vals.lifetime_budget || 0, budget_type: vals.budget_type || "daily" };
      if (vals.schedule?.[0]) payload.schedule_start = vals.schedule[0].format?.("YYYY-MM-DD") || vals.schedule[0];
      if (vals.schedule?.[1]) payload.schedule_end = vals.schedule[1].format?.("YYYY-MM-DD") || vals.schedule[1];
      if (editingCampaign) {
        await axios.patch(`${API}/api/ads/campaigns/${editingCampaign.id}`, payload, { headers });
        message.success(t("coach_ads_updated") || "Campaign updated");
      } else {
        await axios.post(`${API}/api/ads/campaigns`, payload, { headers });
        message.success(t("campaign_created") || "Campaign created");
      }
      setCampaignModal(false); fetchCampaigns();
    } catch (e: any) { message.error(e?.response?.data?.message || t("failed_save")); }
  }
  async function deleteCampaign(id: number) {
    Modal.confirm({ title: t("coach_ads_remove_confirm") || "Delete campaign?", onOk: async () => {
      try {
        await axios.delete(`${API}/api/ads/campaigns/${id}`, { headers });
        message.success(t("coach_ads_removed") || "Deleted");
        if (selectedCampaign?.id === id) { setSelectedCampaign(null); setCampaignAds([]); }
        fetchCampaigns();
      } catch (e: any) { message.error(e?.response?.data?.message || "Delete failed"); }
    }});
  }

  // ── Ad CRUD (merged Ad Set + Ad) ──
  function openCreateAd() {
    if (!selectedCampaign) { message.info(t("select_campaign_first") || "Select a campaign first"); return; }
    setEditingAd(null); adForm.resetFields();
    adForm.setFieldsValue({ target_gender: "all", target_age_min: 18, target_age_max: 65, placement: "feed", daily_budget: 50, target_radius_km: 50 });
    setMapLat(null); setMapLng(null);
    setAdStep(0); setAdModal(true);
  }
  function openEditAd(ad: any) {
    setEditingAd(ad);
    const tgt = ad.targeting || {};
    adForm.setFieldsValue({ name: ad.name, headline: ad.headline, body: ad.body, cta: ad.cta, creative_id: ad.creative_id, placement: tgt.placement || "feed", target_gender: tgt.target_gender || "all", target_age_min: tgt.target_age_min || 18, target_age_max: tgt.target_age_max || 65, target_location: tgt.target_location || undefined, target_radius_km: tgt.target_radius_km || 50, daily_budget: tgt.daily_budget || 50 });
    setMapLat(tgt.target_lat ? Number(tgt.target_lat) : null);
    setMapLng(tgt.target_lng ? Number(tgt.target_lng) : null);
    setAdStep(0); setAdModal(true);
  }
  async function saveAd() {
    try {
      const vals = await adForm.validateFields();
      if (editingAd) {
        await axios.patch(`${API}/api/ads/ads/${editingAd.id}`, { name: vals.name, headline: vals.headline, body: vals.body, cta: vals.cta, creative_id: vals.creative_id }, { headers });
        if (editingAd.targeting?.id) {
          await axios.patch(`${API}/api/ads/ad-sets/${editingAd.targeting.id}`, { placement: vals.placement, target_gender: vals.target_gender, target_age_min: vals.target_age_min, target_age_max: vals.target_age_max, target_location: vals.target_location, target_lat: mapLat, target_lng: mapLng, target_radius_km: vals.target_radius_km, daily_budget: vals.daily_budget }, { headers });
        }
        message.success(t("coach_ads_updated") || "Ad updated");
      } else {
        const adSetRes = await axios.post(`${API}/api/ads/campaigns/${selectedCampaign.id}/ad-sets`, {
          name: vals.name || "Ad Group", placement: vals.placement || "feed",
          target_gender: vals.target_gender || "all", target_age_min: vals.target_age_min || 18, target_age_max: vals.target_age_max || 65,
          target_location: vals.target_location || null, target_lat: mapLat, target_lng: mapLng, target_radius_km: vals.target_radius_km || 50,
          target_interests: vals.target_keywords ? vals.target_keywords.split(",").map((k: string) => k.trim()) : null,
          daily_budget: vals.daily_budget || 0,
        }, { headers });
        const adSetId = adSetRes.data.adSet?.id;
        if (!adSetId) throw new Error("Failed to create ad group");
        await axios.post(`${API}/api/ads/ad-sets/${adSetId}/ads`, { name: vals.name, headline: vals.headline, body: vals.body, cta: vals.cta, creative_id: vals.creative_id, campaign_id: selectedCampaign.id }, { headers });
        message.success(t("coach_ads_submitted") || "Ad created!");
      }
      setAdModal(false); fetchCampaignAds(selectedCampaign.id);
    } catch (e: any) { message.error(e?.response?.data?.message || t("failed_save")); }
  }
  async function deleteAd(ad: any) {
    Modal.confirm({ title: t("coach_ads_remove_confirm") || "Delete ad?", onOk: async () => {
      try {
        await axios.delete(`${API}/api/ads/ads/${ad.id}`, { headers });
        if (ad.targeting?.id) { try { await axios.delete(`${API}/api/ads/ad-sets/${ad.targeting.id}`, { headers }); } catch {} }
        message.success(t("coach_ads_removed") || "Deleted");
        fetchCampaignAds(selectedCampaign.id);
      } catch (e: any) { message.error(e?.response?.data?.message || "Delete failed"); }
    }});
  }

  async function uploadCreativeFile(file: File) {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await axios.post(`${API}/api/ads/creatives/upload`, fd, { headers: { ...headers, "Content-Type": "multipart/form-data" } });
      const c = res.data.creative;
      if (c) { setCreatives(prev => [c, ...prev]); adForm.setFieldsValue({ creative_id: c.id }); message.success(t("upload_success") || "Uploaded!"); }
    } catch { message.error(t("upload_failed") || "Upload failed"); }
    finally { setUploading(false); }
  }

  const selectedCreativeId = Form.useWatch("creative_id", adForm);
  const selectedCreative = creatives.find((c: any) => c.id === selectedCreativeId);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>{t("campaigns") || "Campaigns"}</Title>
          <Text type="secondary">{t("coach_ads_subtitle") || "Promote your coaching with sponsored posts"}</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreateCampaign}>{t("create_campaign") || "New Campaign"}</Button>
      </div>

      <Table dataSource={campaigns} rowKey="id" loading={loading} pagination={{ pageSize: 10 }}
        onRow={(r) => ({ onClick: () => setSelectedCampaign(r), style: { cursor: "pointer" } })}
        columns={[
          { title: t("name") || "Name", dataIndex: "name", render: (v: any) => <Text strong>{v}</Text> },
          { title: t("ad_objective") || "Objective", dataIndex: "objective", render: (v: any) => <Tag>{OBJECTIVES.find(o => o.value === v)?.label || v}</Tag> },
          { title: t("status") || "Status", dataIndex: "status", render: (v: any) => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
          { title: t("budget") || "Budget", key: "budget", render: (_: any, r: any) => `${r.daily_budget || r.lifetime_budget || 0} EGP/${r.budget_type || "daily"}` },
          { title: t("created") || "Created", dataIndex: "created_at", render: (v: any) => v ? new Date(v).toLocaleDateString() : "-" },
          { title: t("actions") || "Actions", key: "actions", width: 120, render: (_: any, r: any) => (
            <Space size="small" onClick={(e) => e.stopPropagation()}>
              <Tooltip title={t("edit")}><Button size="small" icon={<EditOutlined />} onClick={() => openEditCampaign(r)} /></Tooltip>
              <Tooltip title={t("delete")}><Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteCampaign(r.id)} /></Tooltip>
            </Space>
          )},
        ]} />

      {selectedCampaign && (
        <Card title={<><EyeOutlined /> {selectedCampaign.name} — {t("ads") || "Ads"}</>} style={{ marginTop: 16 }}
          extra={<Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAd}>{t("create_ad") || "Create Ad"}</Button>
            <Button onClick={() => { setSelectedCampaign(null); setCampaignAds([]); }}>{t("close") || "Close"}</Button>
          </Space>}>
          {campaignAds.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <Paragraph type="secondary">{t("no_ads") || "No ads yet"}</Paragraph>
              <Button type="primary" icon={<PlusOutlined />} onClick={openCreateAd}>{t("create_ad")}</Button>
            </div>
          ) : (
            <Table dataSource={campaignAds} rowKey="id" size="small" pagination={false} columns={[
              { title: t("name") || "Name", dataIndex: "name", render: (v: any, r: any) => (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {r.media_url && <img src={r.media_url} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />}
                  <div><Text strong>{v}</Text>{r.headline && <div><Text type="secondary" style={{ fontSize: 12 }}>{r.headline}</Text></div>}</div>
                </div>
              )},
              { title: t("ad_placement") || "Placement", key: "p", render: (_: any, r: any) => <Tag>{PLACEMENTS.find(p => p.value === r.targeting?.placement)?.label || "Feed"}</Tag> },
              { title: t("targeting") || "Targeting", key: "t", render: (_: any, r: any) => {
                const tgt = r.targeting || {};
                const parts: string[] = [];
                if (tgt.target_gender && tgt.target_gender !== "all") parts.push(tgt.target_gender);
                parts.push(`${tgt.target_age_min || 18}-${tgt.target_age_max || 65}`);
                if (tgt.target_location) parts.push(`📍${tgt.target_location}`);
                return <Text type="secondary" style={{ fontSize: 12 }}>{parts.join(" · ")}</Text>;
              }},
              { title: t("budget") || "Budget", key: "b", render: (_: any, r: any) => `${r.targeting?.daily_budget || 0} EGP` },
              { title: t("impressions"), dataIndex: "impressions", render: (v: any) => (v || 0).toLocaleString() },
              { title: t("clicks"), dataIndex: "clicks", render: (v: any) => (v || 0).toLocaleString() },
              { title: t("actions"), key: "a", width: 100, render: (_: any, r: any) => (
                <Space size="small">
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEditAd(r)} />
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteAd(r)} />
                </Space>
              )},
            ]} />
          )}
        </Card>
      )}

      {/* Campaign Modal */}
      <Modal open={campaignModal} title={editingCampaign ? t("edit") + " Campaign" : t("create_campaign") || "Create Campaign"}
        onCancel={() => setCampaignModal(false)} onOk={saveCampaign} okText={t("save") || "Save"} width={600}>
        <Form form={campaignForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label={t("campaign_name") || "Campaign Name"} rules={[{ required: true }]}>
            <Input placeholder="e.g. Summer Promotion" size="large" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="objective" label={t("ad_objective") || "Objective"} initialValue="coaching"><Select size="large">{OBJECTIVES.map(o => <Select.Option key={o.value} value={o.value}>{o.label}</Select.Option>)}</Select></Form.Item></Col>
            <Col span={12}><Form.Item name="budget_type" label={t("budget_type") || "Budget Type"} initialValue="daily"><Select size="large"><Select.Option value="daily">{t("daily") || "Daily"}</Select.Option><Select.Option value="lifetime">{t("lifetime") || "Lifetime"}</Select.Option></Select></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="daily_budget" label={t("daily_budget") || "Daily Budget (EGP)"}><InputNumber min={0} style={{ width: "100%" }} size="large" addonAfter="EGP" /></Form.Item></Col>
            <Col span={12}><Form.Item name="lifetime_budget" label={t("lifetime_budget") || "Lifetime Budget (EGP)"}><InputNumber min={0} style={{ width: "100%" }} size="large" addonAfter="EGP" /></Form.Item></Col>
          </Row>
          <Form.Item name="schedule" label={t("schedule") || "Schedule"}><DatePicker.RangePicker style={{ width: "100%" }} size="large" /></Form.Item>
        </Form>
      </Modal>

      {/* Ad Modal — 3-step wizard */}
      <Modal open={adModal} title={editingAd ? t("coach_ads_edit") || "Edit Ad" : t("create_ad") || "Create Ad"}
        onCancel={() => setAdModal(false)} width={720}
        footer={<div style={{ display: "flex", justifyContent: "space-between" }}>
          <Button disabled={adStep === 0} onClick={() => setAdStep(s => s - 1)}>{t("back") || "Back"}</Button>
          <Space>
            <Button onClick={() => setAdModal(false)}>{t("cancel") || "Cancel"}</Button>
            {adStep < 2 ? <Button type="primary" onClick={() => setAdStep(s => s + 1)}>{t("next") || "Next"}</Button>
              : <Button type="primary" onClick={saveAd}>{t("save") || "Save Ad"}</Button>}
          </Space>
        </div>}>
        <Steps current={adStep} size="small" style={{ marginBottom: 24 }}
          items={[{ title: t("creative") || "Creative" }, { title: t("targeting") || "Targeting" }, { title: t("review") || "Review" }]} />
        <Form form={adForm} layout="vertical">
          {/* Step 0: Creative */}
          <div style={{ display: adStep === 0 ? "block" : "none" }}>
            <Form.Item name="name" label={t("ad_title") || "Ad Name"} rules={[{ required: true }]}><Input placeholder={t("coach_ads_title_placeholder") || "e.g. Transform Your Body"} size="large" /></Form.Item>
            <Form.Item name="headline" label={t("headline") || "Headline"}><Input placeholder={t("coach_ads_title_placeholder") || "Catchy headline..."} /></Form.Item>
            <Form.Item name="body" label={t("description") || "Description"}><Input.TextArea rows={3} placeholder={t("coach_ads_description_placeholder") || "Describe your services..."} /></Form.Item>
            <Form.Item name="cta" label={t("call_to_action") || "Call to Action"}><Input placeholder={t("coach_ads_cta_placeholder") || "Book Now"} /></Form.Item>
            <Divider>{t("ad_image_video") || "Ad Image / Video"}</Divider>
            <Form.Item name="creative_id" label={t("choose_creative") || "Choose Creative"}>
              <Select placeholder={t("select_or_upload") || "Select or upload"} allowClear size="large"
                dropdownRender={(menu) => (<>{menu}<Divider style={{ margin: "8px 0" }} />
                  <Upload beforeUpload={(file) => { uploadCreativeFile(file); return false; }} showUploadList={false} accept="image/*,video/*">
                    <Button icon={<UploadOutlined />} loading={uploading} block>{t("upload_new") || "Upload New Image/Video"}</Button>
                  </Upload></>)}>
                {creatives.map((c: any) => (
                  <Select.Option key={c.id} value={c.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {c.media_url && <img src={c.media_url} alt="" style={{ width: 32, height: 32, objectFit: "cover", borderRadius: 4 }} />}
                      <span>{c.name || `#${c.id}`}</span>
                      <Tag style={{ marginLeft: "auto" }}>{c.format || "image"}</Tag>
                    </div>
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            {selectedCreative?.media_url && <div style={{ textAlign: "center", marginBottom: 16 }}><img src={selectedCreative.media_url} alt="Preview" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: "1px solid #eee" }} /></div>}
          </div>
          {/* Step 1: Targeting */}
          <div style={{ display: adStep === 1 ? "block" : "none" }}>
            <Form.Item name="placement" label={t("ad_placement") || "Placement"}><Select size="large">{PLACEMENTS.map(p => <Select.Option key={p.value} value={p.value}>{p.label}</Select.Option>)}</Select></Form.Item>
            <Row gutter={16}>
              <Col span={8}><Form.Item name="target_gender" label={t("gender") || "Gender"}><Select size="large"><Select.Option value="all">{t("all") || "All"}</Select.Option><Select.Option value="male">{t("male") || "Male"}</Select.Option><Select.Option value="female">{t("female") || "Female"}</Select.Option></Select></Form.Item></Col>
              <Col span={8}><Form.Item name="target_age_min" label={t("min_age") || "Min Age"}><InputNumber min={13} max={100} style={{ width: "100%" }} size="large" /></Form.Item></Col>
              <Col span={8}><Form.Item name="target_age_max" label={t("max_age") || "Max Age"}><InputNumber min={13} max={100} style={{ width: "100%" }} size="large" /></Form.Item></Col>
            </Row>
            <Divider><EnvironmentOutlined /> {t("location_targeting") || "Location"}</Divider>
            <Row gutter={16}>
              <Col span={16}><Form.Item name="target_location" label={t("target_city") || "City"}><Select placeholder={t("select_city") || "Optional"} allowClear showSearch size="large" onChange={(val: string) => {
                const cityCoords: Record<string, [number, number]> = { Cairo:[30.0444,31.2357], Giza:[30.0131,31.2089], Alexandria:[31.2001,29.9187], "Sharm El Sheikh":[27.9158,34.3300], Hurghada:[27.2579,33.8116], Luxor:[25.6872,32.6396], Aswan:[24.0889,32.8998], Mansoura:[31.0409,31.3785], Tanta:[30.7865,31.0004], Zagazig:[30.5877,31.5020], Ismailia:[30.5965,32.2715], Suez:[29.9668,32.5498], "Port Said":[31.2653,32.3019], Damietta:[31.4175,31.8144], Fayoum:[29.3084,30.8428], Minya:[28.0871,30.7618], Sohag:[26.5591,31.6948], Qena:[26.1551,32.7160], "Beni Suef":[29.0661,31.0994], "6th October":[29.9285,30.9188], "New Cairo":[30.0300,31.4700], "Nasr City":[30.0511,31.3656], Maadi:[29.9602,31.2564], Heliopolis:[30.0866,31.3225], Dokki:[30.0392,31.2009] };
                if (val && cityCoords[val]) { setMapLat(cityCoords[val][0]); setMapLng(cityCoords[val][1]); } else if (!val) { setMapLat(null); setMapLng(null); }
              }}>{EGYPT_CITIES.map(c => <Select.Option key={c} value={c}>{c}</Select.Option>)}</Select></Form.Item></Col>
              <Col span={8}><Form.Item name="target_radius_km" label={t("radius_km") || "Radius (km)"}><InputNumber min={1} max={500} style={{ width: "100%" }} size="large" /></Form.Item></Col>
            </Row>
            <Form.Item label={t("pin_on_map") || "Pin on Map"}>
              <MapLocationPicker
                lat={mapLat}
                lng={mapLng}
                radius={adForm.getFieldValue("target_radius_km") || 50}
                onPick={(lat, lng, city) => {
                  setMapLat(lat); setMapLng(lng);
                  adForm.setFieldsValue({ target_location: city || adForm.getFieldValue("target_location") });
                }}
              />
              {mapLat && mapLng && (
                <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <Tag color="blue">📍 {mapLat.toFixed(4)}, {mapLng.toFixed(4)}</Tag>
                  <Form.Item name="target_radius_km" noStyle><Slider min={5} max={200} step={5} style={{ flex: 1 }} /></Form.Item>
                  <span style={{ fontSize: 12, color: "#888", minWidth: 50 }}>{adForm.getFieldValue("target_radius_km") || 50} km</span>
                  <Button size="small" danger onClick={() => { setMapLat(null); setMapLng(null); adForm.setFieldsValue({ target_location: undefined }); }}>Clear</Button>
                </div>
              )}
            </Form.Item>
            <Divider><SearchOutlined /> {t("keyword_targeting") || "Keywords"}</Divider>
            <Form.Item name="target_keywords" label={t("search_keywords") || "Search Keywords"}><Input.TextArea rows={2} placeholder={t("keywords_hint") || "fitness, weight loss, muscle..."} /></Form.Item>
            <Form.Item name="daily_budget" label={t("ad_daily_budget") || "Daily Budget (EGP)"}><InputNumber min={0} style={{ width: "100%" }} size="large" addonAfter="EGP" /></Form.Item>
          </div>
          {/* Step 2: Review */}
          <div style={{ display: adStep === 2 ? "block" : "none" }}>
            <Card size="small" title={t("ad_preview") || "Preview"} style={{ marginBottom: 16 }}>
              {selectedCreative?.media_url && <div style={{ textAlign: "center", marginBottom: 12 }}><img src={selectedCreative.media_url} alt="" style={{ maxWidth: "100%", maxHeight: 180, borderRadius: 8 }} /></div>}
              <Title level={5}>{adForm.getFieldValue("headline") || adForm.getFieldValue("name") || "—"}</Title>
              <Paragraph type="secondary">{adForm.getFieldValue("body") || "—"}</Paragraph>
              {adForm.getFieldValue("cta") && <Button type="primary" size="small">{adForm.getFieldValue("cta")}</Button>}
            </Card>
            <Card size="small" title={t("targeting_summary") || "Targeting"}>
              <Row gutter={[16, 8]}>
                <Col span={12}><Text type="secondary">{t("ad_placement")}:</Text> <Text strong>{PLACEMENTS.find(p => p.value === adForm.getFieldValue("placement"))?.label || "Feed"}</Text></Col>
                <Col span={12}><Text type="secondary">{t("gender")}:</Text> <Text strong>{adForm.getFieldValue("target_gender") || "All"}</Text></Col>
                <Col span={12}><Text type="secondary">{t("age_range") || "Age"}:</Text> <Text strong>{adForm.getFieldValue("target_age_min") || 18}–{adForm.getFieldValue("target_age_max") || 65}</Text></Col>
                <Col span={12}><Text type="secondary">{t("location")}:</Text> <Text strong>{adForm.getFieldValue("target_location") || t("all") || "All"}{mapLat ? ` (📍${mapLat.toFixed(2)}, ${mapLng?.toFixed(2)})` : ""}</Text></Col>
                <Col span={12}><Text type="secondary">{t("budget")}:</Text> <Text strong>{adForm.getFieldValue("daily_budget") || 0} EGP/{t("day") || "day"}</Text></Col>
              </Row>
            </Card>
          </div>
        </Form>
      </Modal>
    </div>
  );
}
