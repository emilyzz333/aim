/**
 * 将 UTC 时间字符串转换为上海时间显示
 * 输入: "2026-04-15T06:28:06.083255Z" 或 "2026-04-15T06:28:06"
 * 输出: "2026-04-15 14:28:06"
 */
export function toShanghaiTime(utcStr: string | null | undefined, format: 'datetime' | 'date' | 'minute' = 'minute'): string {
  if (!utcStr) return '';
  const d = new Date(utcStr.endsWith('Z') || utcStr.includes('+') ? utcStr : utcStr + 'Z');
  if (isNaN(d.getTime())) return utcStr.slice(0, 16).replace('T', ' ');
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    ...(format === 'datetime' ? { second: '2-digit' } : {}),
    hour12: false,
  };
  return new Intl.DateTimeFormat('zh-CN', opts)
    .format(d)
    .replace(/\//g, '-')
    .replace(',', '');
}
