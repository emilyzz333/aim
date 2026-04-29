export const ROLES = {
  PRODUCT_MANAGER: 'product_manager',
  DEVELOPER: 'developer',
  TESTER: 'tester',
  PROJECT_MANAGER: 'project_manager',
  PRODUCT_TL: 'product_tl',
  DEVELOPER_TL: 'developer_tl',
  TESTER_TL: 'tester_tl',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
} as const;

// 各左侧菜单项的可见角色列表
// 不在列表中的角色不渲染该菜单项（非隐藏，是不渲染）
export const MENU_PERMISSIONS: Record<string, string[]> = {
  // 主页、仪表盘：全员可见（不需要配置，默认渲染）
  projectManagement: [
    'tester', 'tester_tl', 'product_tl', 'developer_tl', 'admin', 'super_admin',
  ],
  testManagement: [
    'tester', 'tester_tl', 'admin', 'super_admin',
  ],
  userManagement: [
    'admin', 'super_admin',
  ],
  integration: [
    'admin', 'super_admin',
  ],
};

export const canAccess = (menuKey: keyof typeof MENU_PERMISSIONS, role: string): boolean => {
  const allowed = MENU_PERMISSIONS[menuKey];
  if (!allowed) return true; // 未配置的菜单默认全员可见
  return allowed.includes(role);
};
