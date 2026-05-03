import React, { useEffect, useState, useCallback } from "react";
import { Card, Table, Row, Col, Statistic, Typography, Tag, Divider, Alert } from "antd";
import {
  WalletOutlined, MobileOutlined, BankOutlined, CopyOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";

const { Title, Text, Paragraph } = Typography;
const API = getApiBase();

const WALLETS = [
  { key: "vodafone", label: "Vodafone Cash", icon: "📱", color: "#e60000", number: "01012345678" },
  { key: "orange", label: "Orange Money", icon: "🍊", color: "#ff6600", number: "01287654321" },
  { key: "we", label: "WE Pay", icon: "🟣", color: "#7b2d8e", number: "01556781234" },
  { key: "fawry", label: "Fawry", icon: "🏪", color: "#f5a623", number: "FawryPay Code: 78945" },
  { key: "instapay", label: "InstaPay", icon: "⚡", color: "#1890ff", number: "instapay@fitwayhub" },
];

export default function CoachAdsWallet() {
  const { token } = useAuth();
  const { t } = useI18n();
  const headers = { Authorization: `Bearer ${token}` };

  const [wallet, setWallet] = useState<any>({});
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState("");

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/ads/wallet`, { headers });
      setWallet(res.data.wallet || res.data || {});
      setLedger(res.data.ledger || []);
    } catch {} finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchWallet(); }, []);

  const copyNumber = (num: string, key: string) => {
    navigator.clipboard.writeText(num).then(() => { setCopied(key); setTimeout(() => setCopied(""), 2000); }).catch(() => {});
  };

  const TXN_COLORS: Record<string, string> = {
    deposit: "green", charge: "red", refund: "blue", bonus: "gold",
  };

  return (
    <div style={{ padding: 24, maxWidth: 1100, margin: "0 auto" }}>
      <Title level={3}>{t("wallet") || "Wallet"}</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card><Statistic title={t("current_balance") || "Current Balance"} value={wallet.balance || 0} prefix="EGP" precision={2} valueStyle={{ color: "#3f8600" }} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title={t("total_deposited") || "Total Deposited"} value={wallet.total_deposited || 0} prefix="EGP" precision={2} /></Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card><Statistic title={t("total_spent") || "Total Spent"} value={wallet.total_spent || 0} prefix="EGP" precision={2} valueStyle={{ color: "#cf1322" }} /></Card>
        </Col>
      </Row>

      <Card title={<><MobileOutlined /> {t("deposit_methods") || "Deposit — Payment Methods"}</>} style={{ marginBottom: 24 }}>
        <Alert message={t("deposit_instruction") || "Send payment to the wallet number below, then share the screenshot with support to credit your balance."} type="info" showIcon style={{ marginBottom: 16 }} />
        <Row gutter={[16, 16]}>
          {WALLETS.map(w => (
            <Col xs={24} sm={12} md={8} key={w.key}>
              <Card size="small" hoverable style={{ borderLeft: `4px solid ${w.color}`, height: "100%" }}
                onClick={() => copyNumber(w.number, w.key)}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 28 }}>{w.icon}</span>
                  <div style={{ flex: 1 }}>
                    <Text strong style={{ fontSize: 14, display: "block" }}>{w.label}</Text>
                    <Text copyable={{ text: w.number }} style={{ fontSize: 15, fontFamily: "monospace", color: w.color, fontWeight: 600 }}>{w.number}</Text>
                  </div>
                  {copied === w.key && <Tag color="green">{t("copied") || "Copied!"}</Tag>}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card title={t("transaction_history") || "Transaction History"}>
        <Table dataSource={ledger} rowKey="id" loading={loading} pagination={{ pageSize: 15 }} locale={{ emptyText: t("no_transactions") || "No transactions yet" }} columns={[
          { title: t("date") || "Date", dataIndex: "created_at", render: (v: any) => v ? new Date(v).toLocaleString() : "-" },
          { title: t("type") || "Type", dataIndex: "type", render: (v: any) => <Tag color={TXN_COLORS[v] || "default"}>{v}</Tag> },
          { title: t("amount") || "Amount", dataIndex: "amount", render: (v: any) => `${parseFloat(v || 0).toFixed(2)} EGP` },
          { title: t("description") || "Description", dataIndex: "description", ellipsis: true },
          { title: t("balance_after") || "Balance After", dataIndex: "balance_after", render: (v: any) => v != null ? `${parseFloat(v).toFixed(2)} EGP` : "-" },
        ]} />
      </Card>
    </div>
  );
}
