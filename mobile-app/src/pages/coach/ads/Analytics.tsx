import React, { useEffect, useState, useCallback } from "react";
import { Card, Table, Row, Col, Statistic, Typography } from "antd";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";

const { Title } = Typography;
const API = getApiBase();

export default function CoachAdsAnalytics() {
  const { token } = useAuth();
  const { t } = useI18n();
  const headers = { Authorization: `Bearer ${token}` };

  const [stats, setStats] = useState<any>({});
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [ads, setAds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<string>("30d");

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, analyticsRes, adsRes] = await Promise.all([
        axios.get(`${API}/api/ads/analytics/stats`, { headers }),
        axios.get(`${API}/api/ads/analytics/daily`, { headers }),
        axios.get(`${API}/api/ads/ads`, { headers }),
      ]);
      setStats(statsRes.data);
      setAnalytics(analyticsRes.data.analytics || []);
      setAds(adsRes.data.ads || []);
    } catch {} finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchAll(); }, []);

  const chartData = analytics.map((d: any) => ({
    date: new Date(d.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
    impressions: d.impressions || 0,
    clicks: d.clicks || 0,
    conversions: d.conversions || 0,
    spend: parseFloat(d.spend || 0),
  }));

  const topAds = [...ads]
    .sort((a: any, b: any) => (b.impressions || 0) - (a.impressions || 0))
    .slice(0, 5);

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Title level={3}>{t("analytics") || "Analytics"}</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}><Card><Statistic title={t("total_impressions") || "Total Impressions"} value={stats.total_impressions || 0} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title={t("total_clicks") || "Total Clicks"} value={stats.total_clicks || 0} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title={t("total_conversions") || "Total Conversions"} value={stats.total_conversions || 0} /></Card></Col>
        <Col xs={12} sm={6}><Card><Statistic title={t("total_spend") || "Total Spend"} value={stats.total_spend || 0} prefix="EGP" precision={2} /></Card></Col>
      </Row>

      <Card title={t("performance_over_time") || "Performance Over Time"} style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <RTooltip />
            <Legend />
            <Line type="monotone" dataKey="impressions" stroke="#1890ff" name={t("impressions") || "Impressions"} />
            <Line type="monotone" dataKey="clicks" stroke="#52c41a" name={t("clicks") || "Clicks"} />
            <Line type="monotone" dataKey="conversions" stroke="#faad14" name={t("conversions") || "Conversions"} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card title={t("top_performing_ads") || "Top Performing Ads"}>
        <Table dataSource={topAds} rowKey="id" size="small" pagination={false} columns={[
          { title: t("ad_name") || "Ad Name", dataIndex: "name" },
          { title: t("impressions") || "Impressions", dataIndex: "impressions", defaultSortOrder: "descend" as const, sorter: (a: any, b: any) => (a.impressions || 0) - (b.impressions || 0) },
          { title: t("clicks") || "Clicks", dataIndex: "clicks", sorter: (a: any, b: any) => (a.clicks || 0) - (b.clicks || 0) },
          { title: t("ctr_label") || "CTR", render: (_: any, r: any) => r.impressions ? `${((r.clicks / r.impressions) * 100).toFixed(2)}%` : "0%" },
          { title: t("conversions") || "Conversions", dataIndex: "conversions" },
          { title: t("spend") || "Spend", dataIndex: "spend", render: (v: any) => `${parseFloat(v || 0).toFixed(2)} EGP` },
        ]} />
      </Card>
    </div>
  );
}
