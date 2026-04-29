import { useState, useRef } from 'react';
import { Button, Input, Space, message, Dropdown } from 'antd';
import { LinkOutlined, UploadOutlined, DeleteOutlined, EnterOutlined, FileOutlined, FolderOutlined, DownOutlined, PictureOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import request from '@/services/request';
import ScreenshotInputDrawer from './ScreenshotInputDrawer';

interface MdSourceInputProps {
  requirementId: number;
  understandType: string;
  onSubmit?: () => void;
}

interface LinkRow {
  id: string;
  url: string;
  submitting: boolean;
}

export default function MdSourceInput({ requirementId, understandType, onSubmit }: MdSourceInputProps) {
  const [linkRows, setLinkRows] = useState<LinkRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [screenshotOpen, setScreenshotOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const addLinkRow = () => {
    setLinkRows(prev => [...prev, { id: Math.random().toString(36).slice(2), url: '', submitting: false }]);
  };

  const updateLinkUrl = (id: string, url: string) => {
    setLinkRows(prev => prev.map(r => r.id === id ? { ...r, url } : r));
  };

  const removeLinkRow = (id: string) => {
    setLinkRows(prev => prev.filter(r => r.id !== id));
  };

  const isFigmaUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.hostname === 'www.figma.com' || parsed.hostname === 'figma.com';
    } catch {
      return false;
    }
  };

  const submitLink = async (row: LinkRow) => {
    if (!row.url.trim()) { message.warning('请输入URL'); return; }
    const figma = isFigmaUrl(row.url.trim());
    setLinkRows(prev => prev.map(r => r.id === row.id ? { ...r, submitting: true } : r));
    if (figma) {
      message.loading({ content: '正在从 Figma 拉取内容…', key: 'figma-fetch', duration: 0 });
    }
    try {
      const resp = await request.post(`/requirements/${requirementId}/fetch-md/`, {
        source_type: 'url_fetch',
        understand_type: understandType,
        source_ref: row.url.trim(),
      });
      if (figma) {
        const imgCount = (resp.data?.file_paths?.images || []).length;
        message.success({ content: `Figma 拉取成功${imgCount ? `，共提取 ${imgCount} 张图片` : ''}`, key: 'figma-fetch' });
      } else {
        message.success('添加成功，文件内容抓取中...');
      }
      setLinkRows(prev => prev.filter(r => r.id !== row.id));
      onSubmit?.();
    } catch (err: any) {
      const detail = err?.response?.data?.detail || '操作失败';
      if (figma) {
        message.error({ content: detail, key: 'figma-fetch', duration: 5 });
      } else {
        message.error(detail);
      }
      setLinkRows(prev => prev.map(r => r.id === row.id ? { ...r, submitting: false } : r));
    }
  };

  const handleFileUpload = async (fileList: FileList | File[]) => {
    setUploading(true);
    try {
      const files = Array.from(fileList);
      const fd = new FormData();
      fd.append('source_type', 'upload_file');
      fd.append('understand_type', understandType);

      // 支持多文件上传
      files.forEach(file => {
        fd.append('file', file);
      });

      await request.post(`/requirements/${requirementId}/fetch-md/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(`添加成功，文件内容抓取中...`);
      onSubmit?.();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFolderSelect = () => {
    if (folderInputRef.current) {
      folderInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
    // Reset input to allow selecting the same files again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFolderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
    // Reset input to allow selecting the same folder again
    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  };

  const uploadMenuItems: MenuProps['items'] = [
    {
      key: 'file',
      label: '选择文件',
      icon: <FileOutlined />,
      onClick: handleFileSelect,
    },
    {
      key: 'folder',
      label: '选择文件夹',
      icon: <FolderOutlined />,
      onClick: handleFolderSelect,
    },
  ];

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        style={{ display: 'none' }}
        accept=".md,.pdf,.docx,.doc,.txt,.png,.jpg,.jpeg"
        multiple
        onChange={handleFileChange}
      />
      <input
        ref={folderInputRef}
        type="file"
        style={{ display: 'none' }}
        // @ts-ignore - webkitdirectory is not in TypeScript types but is widely supported
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFolderChange}
      />
      <Space size={8} align="center">
        <span style={{ color: '#595959', fontSize: 13 }}>添加：</span>
        <Button
          size="small"
          icon={<LinkOutlined />}
          onClick={addLinkRow}
        >
          输入链接
        </Button>
        <Dropdown menu={{ items: uploadMenuItems }} trigger={['click']}>
          <Button
            size="small"
            icon={<UploadOutlined />}
            loading={uploading}
          >
            文件上传 <DownOutlined />
          </Button>
        </Dropdown>
        <Button
          size="small"
          icon={<PictureOutlined />}
          onClick={() => setScreenshotOpen(true)}
        >
          截图输入
        </Button>
      </Space>

      {/* Inline link input rows */}
      {linkRows.map(row => (
        <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
          <Input
            autoFocus
            prefix={<LinkOutlined style={{ color: '#bbb' }} />}
            placeholder="粘贴URL，如 https://example.com/doc.md 或 Figma 链接"
            value={row.url}
            onChange={e => updateLinkUrl(row.id, e.target.value)}
            onPressEnter={() => submitLink(row)}
            style={{ flex: 1 }}
            disabled={row.submitting}
          />
          <Button
            type="primary"
            size="small"
            icon={<EnterOutlined />}
            loading={row.submitting}
            onClick={() => submitLink(row)}
          >
            抓取
          </Button>
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => removeLinkRow(row.id)}
            disabled={row.submitting}
          />
        </div>
      ))}

      {/* Screenshot Input Drawer */}
      <ScreenshotInputDrawer
        open={screenshotOpen}
        onClose={() => setScreenshotOpen(false)}
        requirementId={requirementId}
        understandType={understandType}
        onSaved={() => onSubmit?.()}
      />
    </div>
  );
}
