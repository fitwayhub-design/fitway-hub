import React, { useEffect, useState, useCallback } from "react";
import { Table, Typography, Tag, Button, Space, Tooltip, message, Modal } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";

const { Title, Text } = Typography;
const API = getApiBase();

const STATUS_COLORS: Record<string, string> = {
  active: "green", paused: "orange", draft: "default", pending_review: "blue",
  rejected: "red", archived: "gray", expired: "volcano",
};

export default function CoachMyAds() {
  const { token } = useAuth();
  const { t } = useI18n();
  const headers = { Authorization: `Bearer ${token}` };

  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/ads/ads`, { headers });
      setAds(res.data.ads || []);
    } catch {} finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAds(); }, []);

  async function deleteAd(id: number) {
    Modal.confirm({
      title: t("coach_ads_remove_confirm") || "Delete ad?",
      content: t("delete_ad_warning") || "This will permanently remove this ad.",
      onOk: async () => {
        try {
          await axios.delete(`${API}/api/ads/ads/${id}`, { headers });
          message.success(t("coach_ads_removed") || "Ad deleted");
          fetchAds();
        } catch (e: any) { message.error(e?.response?.data?.message || "Delete failed"); }
      },
    });
  }

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Title level={3}>{t("my_ads") || "My Ads"}</Title>
      <Table dataSource={ads} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} columns={[
        { title: t("name") || "Name", dataIndex: "name", render: (v: any, r: any) => (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {r.media_url && <img src={r.media_url} alt="" style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6 }} />}
            <div><Text strong>{v}</Text>{r.headline && <div><Text type="secondary" style={{ fontSize: 11 }}>{r.headline}</Text></div>}</div>
          </div>
        )},
        { title: t("status") || "Status", dataIndex: "status", render: (v: any) => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
        { title: t("impressions") || "Impressions", dataIndex: "impressions", sorter: (a: any, b: any) => (a.impressions || 0) - (b.impressions || 0) },
        { title: t("clicks") || "Clicks", dataIndex: "clicks", sorter: (a: any, b: any) => (a.clicks || 0) - (b.clicks || 0) },
        { title: t("spend") || "Spend", dataIndex: "spend", render: (v: any) => `${parseFloat(v || 0).toFixed(2)} EGP` },
        { title: t("created") || "Created", dataIndex: "created_at", render: (v: any) => v ? new Date(v).toLocaleDateString() : "-" },
        { title: t("actions") || "Actions", render: (_: any, r: any) => (
          <Tooltip title={t("delete")}><Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteAd(r.id)} /></Tooltip>
        )},
      ]} />
    </div>
  );
}
