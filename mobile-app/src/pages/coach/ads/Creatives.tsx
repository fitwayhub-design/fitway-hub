import React, { useEffect, useState, useCallback } from "react";
import {
  Button, Table, Modal, Input, Select, Upload,
  message, Form, Tag, Space, Typography, Tooltip,
} from "antd";
import {
  PlusOutlined, DeleteOutlined, UploadOutlined,
} from "@ant-design/icons";
import axios from "axios";
import { useAuth } from "@/context/AuthContext";
import { useI18n } from "@/context/I18nContext";
import { getApiBase } from "@/lib/api";

const { Title } = Typography;
const API = getApiBase();

const STATUS_COLORS: Record<string, string> = {
  active: "green", paused: "orange", draft: "default", pending_review: "blue",
  rejected: "red", archived: "gray", expired: "volcano",
};

export default function CoachAdsCreatives() {
  const { token } = useAuth();
  const { t } = useI18n();
  const headers = { Authorization: `Bearer ${token}` };

  const [creatives, setCreatives] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creativeModal, setCreativeModal] = useState(false);
  const [creativeForm] = Form.useForm();

  const fetchCreatives = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/ads/creatives`, { headers });
      setCreatives(res.data.creatives || []);
    } catch {} finally { setLoading(false); }
  }, [token]);

  useEffect(() => { fetchCreatives(); }, []);

  async function saveCreative() {
    try {
      const vals = await creativeForm.validateFields();
      const fd = new FormData();
      fd.append("name", vals.name || "");
      fd.append("format", vals.format || "image");
      fd.append("headline", vals.headline || "");
      fd.append("body", vals.body || "");
      fd.append("cta_text", vals.cta_text || "");
      fd.append("cta_url", vals.cta_url || "");
      if (vals.file?.fileList?.[0]?.originFileObj) {
        fd.append("file", vals.file.fileList[0].originFileObj);
      }
      await axios.post(`${API}/api/ads/creatives`, fd, {
        headers: { ...headers, "Content-Type": "multipart/form-data" },
      });
      message.success(t("creative_created") || "Creative created");
      setCreativeModal(false);
      creativeForm.resetFields();
      fetchCreatives();
    } catch (e: any) { message.error(e?.response?.data?.message || t("failed_save")); }
  }

  async function deleteCreative(id: number) {
    Modal.confirm({
      title: t("coach_ads_remove_confirm") || "Delete creative?",
      onOk: async () => {
        try {
          await axios.delete(`${API}/api/ads/creatives/${id}`, { headers });
          message.success(t("coach_ads_removed") || "Creative deleted");
          fetchCreatives();
        } catch (e: any) { message.error(e?.response?.data?.message || t("failed_save")); }
      },
    });
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>{t("creatives") || "Creatives"}</Title>
      <Button type="primary" icon={<PlusOutlined />} onClick={() => { creativeForm.resetFields(); setCreativeModal(true); }} style={{ marginBottom: 16 }}>
        {t("upload_creative") || "Upload Creative"}
      </Button>
      <Table dataSource={creatives} rowKey="id" loading={loading} pagination={{ pageSize: 10 }} columns={[
        { title: t("name") || "Name", dataIndex: "name" },
        { title: t("format") || "Format", dataIndex: "format", render: (v: any) => <Tag>{v}</Tag> },
        { title: t("status") || "Status", dataIndex: "status", render: (v: any) => <Tag color={STATUS_COLORS[v]}>{v}</Tag> },
        { title: t("preview") || "Preview", dataIndex: "media_url", render: (v: any) => v ? <img src={v} alt="" style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 4 }} /> : "-" },
        { title: t("headline") || "Headline", dataIndex: "headline", ellipsis: true },
        { title: t("created") || "Created", dataIndex: "created_at", render: (v: any) => v ? new Date(v).toLocaleDateString() : "-" },
        { title: t("actions") || "Actions", render: (_: any, r: any) => (
          <Tooltip title={t("delete")}><Button size="small" danger icon={<DeleteOutlined />} onClick={() => deleteCreative(r.id)} /></Tooltip>
        )},
      ]} />

      <Modal open={creativeModal} title={t("upload_creative") || "Upload Creative"} onCancel={() => setCreativeModal(false)} onOk={saveCreative} okText={t("upload") || "Upload"} width={600}>
        <Form form={creativeForm} layout="vertical">
          <Form.Item name="name" label={t("creative_name") || "Creative Name"} rules={[{ required: true }]}><Input placeholder="e.g. Summer Banner" /></Form.Item>
          <Form.Item name="format" label={t("format") || "Format"} initialValue="image">
            <Select>
              <Select.Option value="image">Image</Select.Option>
              <Select.Option value="video">Video</Select.Option>
              <Select.Option value="carousel">Carousel</Select.Option>
              <Select.Option value="text">Text Only</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="file" label={t("media_file") || "Media File"}><Upload beforeUpload={() => false} maxCount={1}><Button icon={<UploadOutlined />}>{t("select_file") || "Select File"}</Button></Upload></Form.Item>
          <Form.Item name="headline" label={t("headline") || "Headline"}><Input placeholder="e.g. Get Fit Today!" /></Form.Item>
          <Form.Item name="body" label={t("description") || "Body"}><Input.TextArea rows={3} placeholder={t("coach_ads_description_placeholder") || "Creative body text..."} /></Form.Item>
          <Form.Item name="cta_text" label={t("call_to_action") || "CTA Text"}><Input placeholder={t("coach_ads_cta_placeholder") || "e.g. Book Now"} /></Form.Item>
          <Form.Item name="cta_url" label={t("cta_url") || "CTA URL"}><Input placeholder="https://..." /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
