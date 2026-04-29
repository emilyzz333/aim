import { useState, useCallback, useEffect, useRef } from 'react';
import { Drawer, Button, Input, Upload, message } from 'antd';
import { PlusOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import request from '@/services/request';

interface ImageItem {
  id: string;
  file: File;
  preview: string;
}

interface Block {
  id: string;
  images: ImageItem[];
  text: string;
}

interface ScreenshotInputDrawerProps {
  open: boolean;
  onClose: () => void;
  requirementId: number;
  understandType: string;
  onSaved?: () => void;
}

const genId = () => Math.random().toString(36).slice(2);

function BlockCard({
  block,
  index,
  total,
  onChange,
  onRemove,
}: {
  block: Block;
  index: number;
  total: number;
  onChange: (updated: Block) => void;
  onRemove: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const addImage = (file: File) => {
    const id = genId();
    const reader = new FileReader();
    reader.onload = (ev) => {
      onChange({
        ...block,
        images: [...block.images, { id, file, preview: ev.target?.result as string }],
      });
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (imgId: string) => {
    onChange({ ...block, images: block.images.filter(i => i.id !== imgId) });
  };

  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) addImage(file);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('paste', handlePaste);
    return () => container.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      style={{
        background: '#ffffff',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        border: '1px solid rgba(0,0,0,0.06)',
        outline: 'none',
      }}
      onFocus={(e) => {
        e.currentTarget.style.border = '1px solid #007aff';
      }}
      onBlur={(e) => {
        e.currentTarget.style.border = '1px solid rgba(0,0,0,0.06)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#1d1d1f' }}>
          功能点 {index + 1}
        </span>
        {total > 1 && (
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={onRemove}
            style={{ color: 'rgba(0,0,0,0.35)', fontSize: 12 }}
          />
        )}
      </div>

      {/* Image area */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {block.images.map(img => (
          <div key={img.id} style={{ position: 'relative' }}>
            <img
              src={img.preview}
              alt=""
              style={{
                width: 90,
                height: 90,
                objectFit: 'cover',
                borderRadius: 8,
                border: '1px solid rgba(0,0,0,0.1)',
              }}
            />
            <CloseOutlined
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                fontSize: 11,
                background: '#ff3b30',
                color: '#ffffff',
                borderRadius: '50%',
                padding: 3,
                cursor: 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }}
              onClick={() => removeImage(img.id)}
            />
          </div>
        ))}
        <Upload
          accept="image/*"
          multiple
          showUploadList={false}
          beforeUpload={(file) => { addImage(file); return false; }}
        >
          <div style={{
            width: 90,
            height: 90,
            border: '1.5px dashed rgba(0,0,0,0.18)',
            borderRadius: 8,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'rgba(0,0,0,0.35)',
            fontSize: 12,
            gap: 4,
            background: '#fafafa',
          }}>
            <PlusOutlined style={{ fontSize: 18 }} />
            <span>上传图片</span>
          </div>
        </Upload>
      </div>

      {/* Text area */}
      <Input.TextArea
        value={block.text}
        onChange={e => onChange({ ...block, text: e.target.value })}
        placeholder="功能描述（也可在此 Ctrl+V 粘贴多截图）..."
        autoSize={{ minRows: 2, maxRows: 5 }}
        style={{
          resize: 'none',
          border: '1px solid rgba(0,0,0,0.1)',
          borderRadius: 8,
          fontSize: 13,
          fontFamily: 'SF Pro Text, SF Pro Icons, Helvetica Neue, Helvetica, Arial, sans-serif',
        }}
      />
    </div>
  );
}

export default function ScreenshotInputDrawer({
  open,
  onClose,
  requirementId,
  understandType,
  onSaved,
}: ScreenshotInputDrawerProps) {
  const [blocks, setBlocks] = useState<Block[]>([{ id: genId(), images: [], text: '' }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setBlocks([{ id: genId(), images: [], text: '' }]);
    }
  }, [open]);

  const updateBlock = (id: string, updated: Block) => {
    setBlocks(prev => prev.map(b => b.id === id ? updated : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  const addBlock = () => {
    setBlocks(prev => [...prev, { id: genId(), images: [], text: '' }]);
  };

  const handleSave = async () => {
    const hasContent = blocks.some(b => b.images.length > 0 || b.text.trim());
    if (!hasContent) {
      message.warning('请至少输入一张截图或文字描述');
      return;
    }

    setSaving(true);
    try {
      // Build text_content: merge all blocks with [图片N] placeholders inline
      let imgCounter = 1;
      const textParts: string[] = [];
      const allImages: File[] = [];

      for (const block of blocks) {
        const parts: string[] = [];
        if (block.text.trim()) {
          parts.push(block.text.trim());
        }
        if (block.images.length > 0) {
          const placeholders = block.images.map(() => `[图片${imgCounter++}]`).join(' ');
          parts.push(placeholders);
          block.images.forEach(img => allImages.push(img.file));
        }
        if (parts.length > 0) {
          textParts.push(parts.join('\n'));
        }
      }

      const text_content = textParts.join('\n\n');

      const fd = new FormData();
      fd.append('source_type', 'screenshot_input');
      fd.append('understand_type', understandType);
      fd.append('text_content', text_content);
      allImages.forEach(file => fd.append('images', file));

      await request.post(`/requirements/${requirementId}/fetch-md/`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      message.success('截图内容已保存');
      onSaved?.();
      onClose();
    } catch (err: any) {
      message.error(err?.response?.data?.detail || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const UNDERSTAND_LABELS: Record<string, string> = {
    req_md: '需求解析',
    tech_md: '技术方案',
    ui_design: 'UI设计稿',
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={680}
      title="输入 截图与文本"
      styles={{
        body: {
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          background: '#f5f5f7',
        },
      }}
      extra={
        <Button type="primary" size="small" loading={saving} onClick={handleSave}>
          确认保存
        </Button>
      }
    >
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
        <div style={{
          fontSize: 13,
          color: 'rgba(0,0,0,0.45)',
          marginBottom: 12,
          padding: '10px 14px',
          background: 'rgba(0,113,227,0.06)',
          borderRadius: 8,
          border: '1px solid rgba(0,113,227,0.15)',
          lineHeight: 1.6,
        }}>
          每个功能点可单独上传多张截图和描述，支持 Ctrl+V 粘贴多截图，最后统一保存；
          <br />
          也可多功能点一起输入后保存
        </div>

        {blocks.map((block, index) => (
          <BlockCard
            key={block.id}
            block={block}
            index={index}
            total={blocks.length}
            onChange={(updated) => updateBlock(block.id, updated)}
            onRemove={() => removeBlock(block.id)}
          />
        ))}

        <Button
          type="dashed"
          block
          icon={<PlusOutlined />}
          onClick={addBlock}
          style={{
            borderRadius: 10,
            height: 44,
            fontSize: 14,
            color: '#0071e3',
            borderColor: 'rgba(0,113,227,0.35)',
            background: 'rgba(0,113,227,0.04)',
          }}
        >
          添加功能点
        </Button>
      </div>
    </Drawer>
  );
}
